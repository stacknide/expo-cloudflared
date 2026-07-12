/**
 * Internal building blocks, exposed as `expo-cloudflared/internal` so the
 * pure logic (option resolution, argv building, log parsing) can be
 * unit-tested against the built artifact. Not covered by semver — do not
 * depend on this subpath in application code.
 */
export { buildTunnelArgs } from './args'
export type { CloudflaredErrorCode } from './errors'
export { CloudflaredClientError, CloudflaredError } from './errors'
export {
	DEFAULT_PORT,
	DEFAULT_START_TIMEOUT_MS,
	ENV_METRICS_URL,
	ENV_TUNNEL_HOSTNAME,
	ENV_TUNNEL_NAME,
	ENV_TUNNEL_TOKEN,
	normalizeOptions,
	resolveConfig,
	validateOptions,
} from './options'
export type { LineBuffer, LogEvent } from './parser'
export { createLineBuffer, parseLogLine } from './parser'
export type { TunnelManagerDeps } from './tunnel'
export { TunnelManager } from './tunnel'
export type {
	LogLevel,
	Options,
	Protocol,
	ResolvedConfig,
	TunnelMode,
	TunnelStatus,
} from './types'
