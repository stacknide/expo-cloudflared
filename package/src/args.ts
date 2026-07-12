import { CloudflaredError } from './errors'
import type { ResolvedConfig } from './types'

/**
 * Builds the cloudflared argv for a resolved config.
 *
 *   quick:  cloudflared tunnel --no-autoupdate [global flags] --url <origin>
 *   token:  cloudflared tunnel --no-autoupdate [global flags] run --token <token>
 *   name:   cloudflared tunnel --no-autoupdate [global flags] run --url <origin> <name>
 *
 * Global flags (`--loglevel`, `--metrics`) must appear between `tunnel` and
 * the `run` subcommand (per Cloudflare docs:
 * `cloudflared tunnel --metrics 127.0.0.1:60123 run my-tunnel`).
 */
export function buildTunnelArgs(config: ResolvedConfig): string[] {
	const args = ['tunnel', '--no-autoupdate']
	if (config.logLevel) args.push('--loglevel', config.logLevel)
	if (config.metricsHostPort) args.push('--metrics', config.metricsHostPort)

	switch (config.mode) {
		case 'quick':
			args.push('--url', config.originUrl)
			break
		case 'token':
			if (!config.token)
				throw new CloudflaredError('ERR_INVALID_OPTION', 'token mode requires a token')
			args.push('run', '--token', config.token)
			break
		case 'name':
			if (!config.tunnelName)
				throw new CloudflaredError('ERR_INVALID_OPTION', 'name mode requires a tunnelName')
			args.push('run', '--url', config.originUrl, config.tunnelName)
			break
	}
	return args
}
