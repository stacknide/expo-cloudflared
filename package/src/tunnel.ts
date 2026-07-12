import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildTunnelArgs } from './args'
import { ensureBinary as defaultEnsureBinary, type EnsureBinaryOptions } from './binary'
import { CloudflaredError } from './errors'
import { createLineBuffer, parseLogLine } from './parser'
import type { ResolvedConfig } from './types'

export interface TunnelManagerDeps {
	ensureBinary?: (options?: EnsureBinaryOptions) => Promise<string>
	spawn?: typeof nodeSpawn
}

interface TunnelState {
	child: ChildProcess
	config: ResolvedConfig
	/** Metrics server address discovered from cloudflared's startup logs. */
	metricsAddress: string | null
	url: string
}

const KILL_TIMEOUT_MS = 3000

/**
 * Spawns and supervises a single cloudflared process.
 *
 * Lifecycle rules (shaped by how Expo CLI drives us — see AsyncNgrok in
 * @expo/cli: `kill?.()` before every connect attempt, 10s timeout, 3 retries):
 *
 * - `start()` while a start is pending returns the same promise.
 * - `start()` while a tunnel with the same config is active returns its URL.
 * - `stop()` is a fast no-op when idle, kills a still-registering process
 *   (the child is tracked from the moment of spawn), and never triggers a
 *   `closed` status — that callback is reserved for unexpected crashes,
 *   because Expo prints a red error banner when it fires.
 */
export class TunnelManager {
	private readonly ensureBinary: (options?: EnsureBinaryOptions) => Promise<string>
	private readonly spawn: typeof nodeSpawn

	private pending: Promise<string> | null = null
	private current: TunnelState | null = null
	private active = false
	private stopping = false
	private exitHookInstalled = false

	constructor(deps: TunnelManagerDeps = {}) {
		this.ensureBinary = deps.ensureBinary ?? defaultEnsureBinary
		this.spawn = deps.spawn ?? nodeSpawn
	}

	getUrl(): string | null {
		return this.active ? (this.current?.url ?? null) : null
	}

	getActiveProcess(): ChildProcess | null {
		return this.active ? (this.current?.child ?? null) : null
	}

	/** Metrics server URL of the running tunnel (configured or log-discovered). */
	getMetricsUrl(): string | null {
		if (!this.active || !this.current) return null
		if (this.current.config.metricsUrl) return this.current.config.metricsUrl
		return this.current.metricsAddress ? `http://${this.current.metricsAddress}` : null
	}

	async start(config: ResolvedConfig): Promise<string> {
		if (this.pending) return this.pending
		if (this.active && this.current) {
			if (sameTunnel(this.current.config, config)) return this.current.url
			await this.stop() // different target — replace the running tunnel
		}

		this.pending = this.doStart(config).finally(() => {
			this.pending = null
		})
		return this.pending
	}

	async stop(): Promise<void> {
		const child = this.current?.child
		if (!child || child.exitCode !== null || child.killed) {
			this.current = null
			this.active = false
			return
		}

		this.stopping = true
		try {
			await new Promise<void>((resolve) => {
				const timer = setTimeout(() => {
					child.kill('SIGKILL')
				}, KILL_TIMEOUT_MS)
				timer.unref()
				child.once('exit', () => {
					clearTimeout(timer)
					resolve()
				})
				child.kill()
			})
		} finally {
			this.stopping = false
			this.current = null
			this.active = false
		}
	}

	private async doStart(config: ResolvedConfig): Promise<string> {
		const binPath = await this.ensureBinary()
		assertNamedTunnelCert(config)

		const child = this.spawn(binPath, buildTunnelArgs(config), {
			env: { ...process.env },
			windowsHide: true,
		})

		// Track the child before the URL resolves so stop() can kill a tunnel
		// that is still registering (Expo calls kill() between its retries).
		const state: TunnelState = { child, config, metricsAddress: null, url: '' }
		this.current = state
		this.installExitHook()

		try {
			state.url = await this.awaitTunnelUrl(state)
			this.active = true
			return state.url
		} catch (error) {
			this.active = false
			if (this.current === state) this.current = null
			if (child.exitCode === null && !child.killed) child.kill()
			throw error
		}
	}

	/** Watches cloudflared's output until a public URL is known (or fails). */
	private awaitTunnelUrl(state: TunnelState): Promise<string> {
		const { child, config } = state

		return new Promise<string>((resolve, reject) => {
			let settled = false
			let connectedNotified = false
			let lastHostname: string | null = null

			const settle = (fn: () => void): void => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				fn()
			}

			const timer = setTimeout(() => {
				settle(() =>
					reject(
						new CloudflaredError(
							'ERR_TUNNEL_TIMEOUT',
							`cloudflared did not produce a tunnel URL within ${config.startTimeoutMs}ms`
						)
					)
				)
			}, config.startTimeoutMs)
			timer.unref()

			const resolveNamed = (): void => {
				const hostname = config.hostname ?? lastHostname
				if (hostname) {
					settle(() => resolve(`https://${hostname}`))
					return
				}
				settle(() =>
					reject(
						new CloudflaredError(
							'ERR_NO_HOSTNAME',
							'The named tunnel connected, but its public hostname is unknown. ' +
								'Set CLOUDFLARED_TUNNEL_HOSTNAME in your .env.local to the hostname you routed ' +
								'with `cloudflared tunnel route dns <tunnel> <hostname>`.'
						)
					)
				)
			}

			const onLine = (line: string): void => {
				config.onLogEvent?.(line)

				for (const event of parseLogLine(line)) {
					switch (event.type) {
						case 'url':
							settle(() => resolve(event.url))
							break
						case 'hostname':
							lastHostname ??= event.hostname
							break
						case 'metrics':
							state.metricsAddress = event.address
							break
						case 'registered':
							if (!connectedNotified) {
								connectedNotified = true
								config.onStatusChange?.('connected')
							}
							if (config.mode !== 'quick') resolveNamed()
							break
						case 'disconnected':
							// Transient edge reconnects — cloudflared recovers on its
							// own; reporting `closed` would make Expo print an error.
							break
						case 'fatal':
							settle(() => reject(new CloudflaredError(event.code, event.message)))
							break
					}
				}
			}

			// cloudflared logs to stderr by design; watch stdout for safety.
			const stderrBuffer = createLineBuffer(onLine)
			const stdoutBuffer = createLineBuffer(onLine)
			child.stderr?.on('data', (chunk: Buffer) => stderrBuffer.push(chunk))
			child.stdout?.on('data', (chunk: Buffer) => stdoutBuffer.push(chunk))

			child.on('error', (error) => {
				settle(() =>
					reject(
						new CloudflaredError(
							'ERR_TUNNEL_START',
							`Failed to spawn cloudflared: ${error.message}`
						)
					)
				)
			})

			child.on('exit', (code) => {
				stderrBuffer.flush()
				stdoutBuffer.flush()
				const wasActive = this.active
				if (this.current === state) {
					this.current = null
					this.active = false
				}
				if (this.stopping) {
					settle(() =>
						reject(
							new CloudflaredError('ERR_TUNNEL_STOPPED', 'Tunnel was stopped before it was ready')
						)
					)
					return
				}
				settle(() =>
					reject(
						new CloudflaredError(
							'ERR_TUNNEL_START',
							`cloudflared exited before the tunnel was ready (exit code ${code ?? 'unknown'})`
						)
					)
				)
				// Crash of an established tunnel — the one case Expo should hear about.
				if (wasActive) config.onStatusChange?.('closed')
			})
		})
	}

	private installExitHook(): void {
		if (this.exitHookInstalled) return
		this.exitHookInstalled = true
		process.on('exit', () => {
			const child = this.current?.child
			if (child && child.exitCode === null) child.kill()
		})
	}
}

const sameTunnel = (a: ResolvedConfig, b: ResolvedConfig): boolean =>
	a.mode === b.mode &&
	a.originUrl === b.originUrl &&
	a.token === b.token &&
	a.tunnelName === b.tunnelName

/** Name-mode tunnels need the cert.pem produced by `cloudflared tunnel login`. */
function assertNamedTunnelCert(config: ResolvedConfig): void {
	if (config.mode !== 'name') return
	const certPath =
		process.env.TUNNEL_ORIGIN_CERT?.trim() || path.join(os.homedir(), '.cloudflared', 'cert.pem')
	if (!fs.existsSync(certPath)) {
		throw new CloudflaredError(
			'ERR_CERT_MISSING',
			`Named tunnel "${config.tunnelName}" requires a Cloudflare origin certificate, ` +
				`but none was found at ${certPath}. Run \`npx expo-cloudflared setup\` ` +
				'(or `cloudflared tunnel login`) once to create it.'
		)
	}
}
