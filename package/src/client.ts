import { CloudflaredClientError } from './errors'

/**
 * Client for cloudflared's local metrics/health server.
 *
 * Unlike ngrok (which exposes a full REST API at http://127.0.0.1:4040),
 * cloudflared exposes only a lightweight metrics endpoint:
 *
 *   GET /metrics     — Prometheus-format metrics
 *   GET /healthcheck — 200 if cloudflared is alive
 *   GET /ready       — 200 if the tunnel is registered and ready
 *
 * cloudflared always starts this server (default 127.0.0.1:20241–20245); the
 * tunnel manager discovers the address from the startup logs, so `getApi()`
 * works even when no `metricsUrl` was configured.
 */
export class CloudflaredClient {
	readonly metricsUrl: string

	constructor(metricsUrl: string) {
		this.metricsUrl = metricsUrl
	}

	private async request(pathname: string): Promise<Response> {
		const url = new URL(pathname, this.metricsUrl)
		try {
			return await fetch(url, { signal: AbortSignal.timeout(5000) })
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			throw new CloudflaredClientError(message)
		}
	}

	/** Raw Prometheus-format metrics. */
	async getMetrics(): Promise<string> {
		const res = await this.request('/metrics')
		const body = await res.text()
		if (!res.ok) {
			throw new CloudflaredClientError(`GET /metrics failed: HTTP ${res.status}`, res, body)
		}
		return body
	}

	/** True if cloudflared is alive. */
	async healthcheck(): Promise<boolean> {
		try {
			const res = await this.request('/healthcheck')
			return res.ok
		} catch {
			return false
		}
	}

	/** True if the tunnel is registered and ready to accept traffic. */
	async ready(): Promise<boolean> {
		try {
			const res = await this.request('/ready')
			return res.status === 200
		} catch {
			return false
		}
	}
}
