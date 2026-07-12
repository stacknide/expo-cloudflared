import { CloudflaredError } from './errors'
import type { Options, Protocol, ResolvedConfig, TunnelMode } from './types'

export const ENV_TUNNEL_TOKEN = 'CLOUDFLARED_TUNNEL_TOKEN'
export const ENV_TUNNEL_NAME = 'CLOUDFLARED_TUNNEL_NAME'
export const ENV_TUNNEL_HOSTNAME = 'CLOUDFLARED_TUNNEL_HOSTNAME'
export const ENV_METRICS_URL = 'CLOUDFLARED_METRICS_URL'

export const DEFAULT_PORT = 3000
export const DEFAULT_START_TIMEOUT_MS = 30_000

const VALID_PROTOCOLS: readonly string[] = ['http', 'https', 'tcp', 'ssh']
const VALID_LOG_LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error', 'fatal']

/**
 * Normalizes the polymorphic `connect()` argument into an `Options` object.
 *
 *   connect()          → {}
 *   connect(8081)      → { addr: 8081 }
 *   connect("8081")    → { addr: "8081" }
 *   connect({ ... })   → as-is
 */
export function normalizeOptions(opts?: number | string | Options | null): Options {
	if (opts === undefined || opts === null) return {}
	if (typeof opts === 'number' || typeof opts === 'string') return { addr: opts }
	return opts
}

/** Throws `ERR_INVALID_OPTION` on unsupported enum values. */
export function validateOptions(opts: Options): void {
	if (opts.proto !== undefined && !VALID_PROTOCOLS.includes(opts.proto)) {
		throw new CloudflaredError(
			'ERR_INVALID_OPTION',
			`Invalid proto "${opts.proto}". Valid values: ${VALID_PROTOCOLS.join(', ')}`
		)
	}
	if (opts.logLevel !== undefined && !VALID_LOG_LEVELS.includes(opts.logLevel)) {
		throw new CloudflaredError(
			'ERR_INVALID_OPTION',
			`Invalid logLevel "${opts.logLevel}". Valid values: ${VALID_LOG_LEVELS.join(', ')}`
		)
	}
}

const isPortLike = (value: number | string): boolean =>
	typeof value === 'number' || /^\d+$/.test(value)

/**
 * Resolves options + environment into a full tunnel configuration.
 *
 * Mode precedence:
 * 1. Explicit options beat env vars: `token` → token mode, `tunnelName` → name
 *    mode (both at once is an error).
 * 2. Env vars (loaded by Expo CLI from the project's `.env` files):
 *    `CLOUDFLARED_TUNNEL_NAME` → name mode, else `CLOUDFLARED_TUNNEL_TOKEN` →
 *    token mode. When both are set, name mode wins — it routes the tunnel to
 *    the actual dev-server port, while token-mode ingress is fixed in the
 *    Cloudflare dashboard.
 * 3. Otherwise: quick tunnel (random trycloudflare.com URL).
 *
 * `opts.hostname` is only trusted when the mode was explicitly selected via
 * options — Expo CLI passes an ngrok-specific `*.exp.direct` hostname that
 * must never be mistaken for a Cloudflare hostname.
 */
export function resolveConfig(
	opts?: number | string | Options | null,
	env: NodeJS.ProcessEnv = process.env,
	warn: (message: string) => void = defaultWarn
): ResolvedConfig {
	const o = normalizeOptions(opts)
	validateOptions(o)

	// ── Mode ────────────────────────────────────────────────────────────────
	let mode: TunnelMode
	let explicitMode = false
	let token: string | null = null
	let tunnelName: string | null = null

	const envToken = env[ENV_TUNNEL_TOKEN]?.trim() || null
	const envName = env[ENV_TUNNEL_NAME]?.trim() || null

	if (o.token !== undefined && o.tunnelName !== undefined) {
		throw new CloudflaredError(
			'ERR_CONFLICTING_OPTIONS',
			'Both `token` and `tunnelName` were provided — pass only one. ' +
				'Use `token` for dashboard-managed tunnels, `tunnelName` for locally-managed ones.'
		)
	} else if (o.token !== undefined) {
		mode = 'token'
		token = o.token
		explicitMode = true
	} else if (o.tunnelName !== undefined) {
		mode = 'name'
		tunnelName = o.tunnelName
		explicitMode = true
	} else if (envName) {
		mode = 'name'
		tunnelName = envName
		if (envToken) {
			warn(
				`Both ${ENV_TUNNEL_NAME} and ${ENV_TUNNEL_TOKEN} are set — using the named tunnel "${envName}" ` +
					`and ignoring the token (name mode routes to the actual dev-server port).`
			)
		}
	} else if (envToken) {
		mode = 'token'
		token = envToken
	} else {
		mode = 'quick'
	}

	// ── Hostname (named modes only) ─────────────────────────────────────────
	// Expo CLI passes hostname like "<random>-<user>-8081.exp.direct" — an
	// ngrok artifact. Only trust opts.hostname when the mode itself came from
	// explicit options (i.e. the caller is not Expo CLI).
	let hostname: string | null = null
	if (mode !== 'quick') {
		hostname = (explicitMode ? o.hostname : undefined) ?? env[ENV_TUNNEL_HOSTNAME]?.trim() ?? null
		if (hostname === '') hostname = null
	}

	// ── Local origin ────────────────────────────────────────────────────────
	const proto: Protocol = o.proto ?? 'http'
	const rawAddr = o.addr ?? o.port ?? o.host
	const originExplicit = rawAddr !== undefined
	const addr = rawAddr ?? DEFAULT_PORT
	const originUrl = isPortLike(addr) ? `${proto}://localhost:${addr}` : String(addr)

	if (mode === 'token' && originExplicit) {
		warn(
			`Token-mode tunnels route via your Cloudflare dashboard ingress — make sure it points at ${originUrl}. ` +
				`For a tunnel that follows the local port automatically, use a named tunnel (${ENV_TUNNEL_NAME}).`
		)
	}

	// ── Metrics ─────────────────────────────────────────────────────────────
	const metricsUrl = o.metricsUrl ?? env[ENV_METRICS_URL]?.trim() ?? null
	let metricsHostPort: string | null = null
	if (metricsUrl) {
		try {
			metricsHostPort = new URL(metricsUrl).host
		} catch {
			throw new CloudflaredError(
				'ERR_INVALID_OPTION',
				`Invalid metricsUrl "${metricsUrl}" — expected a URL like "http://127.0.0.1:20241"`
			)
		}
	}

	return {
		hostname,
		logLevel: o.logLevel ?? null,
		metricsHostPort,
		metricsUrl,
		mode,
		onLogEvent: o.onLogEvent,
		onStatusChange: o.onStatusChange,
		originExplicit,
		originUrl,
		startTimeoutMs: o.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS,
		token,
		tunnelName,
	}
}

const defaultWarn = (message: string): void => {
	console.warn(`[expo-cloudflared] Warning: ${message}`)
}
