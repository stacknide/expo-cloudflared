export type Protocol = 'http' | 'https' | 'tcp' | 'ssh'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type TunnelStatus = 'connected' | 'closed'
export type TunnelMode = 'quick' | 'token' | 'name'

/**
 * Options accepted by {@link connect}.
 *
 * Supports both this package's own options and the full `@expo/ngrok` options
 * shape, so Expo CLI can call `connect()` transparently. ngrok-specific fields
 * (`authtoken`, `configPath`, `subdomain`, `region`) are accepted but ignored.
 */
export interface Options {
	/** Local port or address to expose (e.g. `8081` or `"http://localhost:8081"`). Default: `3000`. */
	addr?: number | string
	/** Protocol of the local service. Default: `"http"`. */
	proto?: Protocol
	/** Cloudflare Tunnel token — runs a named tunnel with dashboard-configured ingress. */
	token?: string
	/** Named tunnel to run (requires `cloudflared tunnel login` cert). Routes the tunnel to the local port. */
	tunnelName?: string
	/** Public hostname of the named tunnel, used as the returned URL (e.g. `"dev.example.com"`). */
	hostname?: string
	/** cloudflared log verbosity. */
	logLevel?: LogLevel
	/** cloudflared metrics server URL (e.g. `"http://127.0.0.1:20241"`) — passed as `--metrics`. */
	metricsUrl?: string
	/** How long to wait for the tunnel URL before failing. Default: 30 000 ms. */
	startTimeoutMs?: number
	/** Called for every cloudflared log line. */
	onLogEvent?: (line: string) => void
	/** Called on connection status changes. */
	onStatusChange?: (status: TunnelStatus) => void

	// ── @expo/ngrok compat ────────────────────────────────────────────────────
	/** Alias for `addr` — Expo CLI passes `port`. */
	port?: number | string
	/** Alias for `addr`. */
	host?: string
	/** ngrok authtoken — not applicable to Cloudflare Tunnel, ignored. */
	authtoken?: string
	/** ngrok config file path — ignored. */
	configPath?: string
	/** ngrok subdomain — ignored. */
	subdomain?: string
	/** ngrok region — ignored (cloudflared auto-selects). */
	region?: string
	/** Tolerate future/unknown ngrok fields. */
	[key: string]: unknown
}

/** Fully-resolved tunnel configuration produced by `resolveConfig()`. */
export interface ResolvedConfig {
	mode: TunnelMode
	/** Local origin to expose, e.g. `"http://localhost:8081"`. Unused in token mode (dashboard ingress). */
	originUrl: string
	/** Whether the caller explicitly provided a port/addr (vs the 3000 default). */
	originExplicit: boolean
	token: string | null
	tunnelName: string | null
	/** Trusted public hostname for named modes, or null to derive from logs. */
	hostname: string | null
	/** `host:port` for cloudflared's `--metrics` flag. */
	metricsHostPort: string | null
	/** Full URL for the metrics client. */
	metricsUrl: string | null
	logLevel: LogLevel | null
	startTimeoutMs: number
	onLogEvent: ((line: string) => void) | undefined
	onStatusChange: ((status: TunnelStatus) => void) | undefined
}
