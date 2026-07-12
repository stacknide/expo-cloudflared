export type CloudflaredErrorCode =
	| 'ERR_BINARY_INSTALL'
	| 'ERR_UNSUPPORTED_PLATFORM'
	| 'ERR_CONFLICTING_OPTIONS'
	| 'ERR_INVALID_OPTION'
	| 'ERR_ADDR_IN_USE'
	| 'ERR_AUTH'
	| 'ERR_CERT_MISSING'
	| 'ERR_NO_HOSTNAME'
	| 'ERR_TUNNEL_START'
	| 'ERR_TUNNEL_STOPPED'
	| 'ERR_TUNNEL_TIMEOUT'

/** Error thrown by this package. `code` allows programmatic handling. */
export class CloudflaredError extends Error {
	readonly code: CloudflaredErrorCode

	constructor(code: CloudflaredErrorCode, message: string) {
		super(message)
		this.name = 'CloudflaredError'
		this.code = code
	}
}

/**
 * Error thrown by {@link CloudflaredClient} metrics requests.
 * Name and `response`/`body` accessors are preserved from the original
 * `expo-cloudflared` prototype for consumers that catch tunnel errors.
 */
export class CloudflaredClientError extends Error {
	readonly response: Response | undefined
	readonly body: string | undefined

	constructor(message: string, response?: Response, body?: string) {
		super(message)
		this.name = 'CloudflaredClientError'
		this.response = response
		this.body = body
	}
}
