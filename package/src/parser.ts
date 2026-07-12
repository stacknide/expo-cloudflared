import type { CloudflaredErrorCode } from './errors'

/**
 * Structured events extracted from cloudflared log lines.
 * cloudflared logs everything to stderr by design.
 */
export type LogEvent =
	| { type: 'url'; url: string }
	| { type: 'hostname'; hostname: string }
	| { type: 'registered' }
	| { type: 'disconnected' }
	| { type: 'metrics'; address: string }
	| { type: 'fatal'; code: CloudflaredErrorCode; message: string }

// Quick tunnel: "https://xxxx-xxxx.trycloudflare.com"
const QUICK_TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

// Named tunnel registered: "Registered tunnel connection connIndex=0 ..."
const REGISTERED = /registered tunnel connection|connection registered/i

// Edge connection lost (transient — cloudflared reconnects on its own)
const DISCONNECTED = /connection terminated|reconnecting/i

// Named tunnel hostname, either "hostname=dev.example.com" or the ingress
// config JSON logged in token mode: "Updated to new configuration
// config="{\"ingress\":[{\"hostname\":\"dev.example.com\", ..."
const HOSTNAME_KV = /hostname=([\w.-]+)/
const HOSTNAME_JSON = /\\?"hostname\\?"\s*:\s*\\?"([^"\\]+)\\?"/

// "Starting metrics server on 127.0.0.1:20241/metrics" — cloudflared always
// starts one (default port range 20241–20245), so we can offer getApi()
// even when --metrics wasn't configured.
const METRICS_SERVER = /starting metrics server on\s+(\S+)\/metrics/i

// Non-fatal noise that should never be interpreted further
const IGNORED = /failed to sufficiently increase receive buffer size/i

const FATAL_PATTERNS: ReadonlyArray<{ pattern: RegExp; code: CloudflaredErrorCode }> = [
	{ code: 'ERR_ADDR_IN_USE', pattern: /address already in use/i },
	{
		code: 'ERR_AUTH',
		pattern: /unauthorized|invalid tunnel secret|failed to parse token|invalid token/i,
	},
	{
		code: 'ERR_CERT_MISSING',
		pattern: /cannot determine default origin certificate path|origincert/i,
	},
	{
		code: 'ERR_TUNNEL_START',
		pattern:
			/failed to request quick tunnel|failed to unmarshal quick tunnel|failed to create tunnel/i,
	},
]

const isUsableHostname = (hostname: string): boolean =>
	hostname.includes('.') && !hostname.includes('*')

/** Parses a single cloudflared log line into zero or more structured events. */
export function parseLogLine(line: string): LogEvent[] {
	if (!line || IGNORED.test(line)) return []

	const events: LogEvent[] = []

	for (const { pattern, code } of FATAL_PATTERNS) {
		if (pattern.test(line)) {
			events.push({ code, message: line, type: 'fatal' })
			return events // a fatal line needs no further interpretation
		}
	}

	const urlMatch = line.match(QUICK_TUNNEL_URL)
	if (urlMatch) events.push({ type: 'url', url: urlMatch[0] })

	const hostMatch = line.match(HOSTNAME_KV) ?? line.match(HOSTNAME_JSON)
	if (hostMatch?.[1] && isUsableHostname(hostMatch[1])) {
		events.push({ hostname: hostMatch[1], type: 'hostname' })
	}

	const metricsMatch = line.match(METRICS_SERVER)
	if (metricsMatch?.[1]) events.push({ address: metricsMatch[1], type: 'metrics' })

	if (REGISTERED.test(line)) events.push({ type: 'registered' })
	else if (DISCONNECTED.test(line)) events.push({ type: 'disconnected' })

	return events
}

export interface LineBuffer {
	/** Feed a raw stream chunk; complete lines are emitted via `onLine`. */
	push(chunk: Buffer | string): void
	/** Emit any trailing partial line (call on stream end). */
	flush(): void
}

/**
 * Reassembles stream chunks into whole lines. cloudflared output arrives in
 * arbitrary chunks — a URL split across two chunks would otherwise be lost.
 */
export function createLineBuffer(onLine: (line: string) => void): LineBuffer {
	let pending = ''

	const emit = (line: string): void => {
		const trimmed = line.trim()
		if (trimmed) onLine(trimmed)
	}

	return {
		flush(): void {
			if (pending) {
				emit(pending)
				pending = ''
			}
		},
		push(chunk: Buffer | string): void {
			pending += chunk.toString()
			const lines = pending.split(/\r?\n/)
			pending = lines.pop() ?? ''
			for (const line of lines) emit(line)
		},
	}
}
