/**
 * expo-cloudflared — Cloudflare Tunnel for Expo.
 *
 * A drop-in replacement for `@expo/ngrok`: install it at
 * `node_modules/@expo/ngrok` via your package manager's override/resolution
 * feature and `expo start --tunnel` will transparently use a Cloudflare
 * Tunnel. Also usable directly:
 *
 *   const cloudflared = require('expo-cloudflared')
 *
 *   // Quick tunnel — no Cloudflare account needed
 *   const url = await cloudflared.connect(8081) // https://xxxx.trycloudflare.com
 *
 *   // Named tunnel — stable URL (see README for the one-time setup)
 *   const url = await cloudflared.connect({ tunnelName: 'my-tunnel', hostname: 'dev.example.com' })
 *
 *   await cloudflared.kill()
 */
import type { ChildProcess } from 'node:child_process'
import { ensureBinary, getBinaryVersion, isInstalled } from './binary'
import { CloudflaredClient } from './client'
import { CloudflaredError } from './errors'
import { resolveConfig } from './options'
import { TunnelManager } from './tunnel'
import type { Options } from './types'

const manager = new TunnelManager()
let client: CloudflaredClient | null = null

/**
 * Starts a Cloudflare Tunnel and returns its public HTTPS URL.
 *
 * Accepts the full `@expo/ngrok` options shape so Expo CLI can call this
 * transparently; ngrok-specific fields (`authtoken`, `configPath`,
 * `subdomain`, `region` and the `*.exp.direct` hostname) are ignored.
 */
export async function connect(opts?: number | string | Options): Promise<string> {
	const config = resolveConfig(opts)
	const url = await manager.start(config)

	const metricsUrl = manager.getMetricsUrl()
	client = metricsUrl ? new CloudflaredClient(metricsUrl) : null

	console.log(`[expo-cloudflared] Tunnel URL: ${url}`)
	return url
}

/**
 * Stops the active tunnel. The `url` argument is accepted for `@expo/ngrok`
 * API compatibility and ignored — cloudflared runs one tunnel per process.
 */
export async function disconnect(_url?: string): Promise<void> {
	await kill()
}

/** Kills the cloudflared process (called by Expo CLI before each connect). */
export async function kill(): Promise<void> {
	await manager.stop()
	client = null
}

/** The active public tunnel URL, or null. */
export function getUrl(): string | null {
	return manager.getUrl()
}

/** The active cloudflared ChildProcess handle, or null. */
export function getActiveProcess(): ChildProcess | null {
	return manager.getActiveProcess()
}

/**
 * Client for cloudflared's local metrics/health server, or null when no
 * tunnel is running. The metrics address is auto-discovered from cloudflared's
 * startup logs, so this works without configuring `metricsUrl`.
 */
export function getApi(): CloudflaredClient | null {
	if (client) return client
	const metricsUrl = manager.getMetricsUrl()
	client = metricsUrl ? new CloudflaredClient(metricsUrl) : null
	return client
}

/** Version of the installed cloudflared binary, e.g. "2026.6.0". */
export async function getVersion(): Promise<string> {
	if (!isInstalled()) {
		throw new CloudflaredError(
			'ERR_BINARY_INSTALL',
			'cloudflared binary is not installed yet — run `npx expo-cloudflared install` ' +
				'or start a tunnel once with connect().'
		)
	}
	return getBinaryVersion()
}

/**
 * No-op stub — Cloudflare quick tunnels need no auth token. Present so code
 * written against the `@expo/ngrok` API surface works without changes.
 */
export async function authtoken(_token?: string): Promise<void> {
	// intentional no-op
}

export { ensureBinary, isInstalled }
export { CloudflaredClient } from './client'
export type { CloudflaredErrorCode } from './errors'
export { CloudflaredClientError, CloudflaredError } from './errors'
export type {
	LogLevel,
	Options,
	Protocol,
	TunnelMode,
	TunnelStatus,
} from './types'
