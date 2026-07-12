#!/usr/bin/env node
/**
 * npx expo-cloudflared <command>
 *
 * Commands:
 *   install                  Download the cloudflared binary (happens lazily on first tunnel otherwise)
 *   version                  Print the installed cloudflared version
 *   setup                    Guided named-tunnel setup (login → create → route dns → env vars)
 *   tunnel [port]            Start a quick tunnel on [port] (default: 3000)
 *   tunnel --token <token>   Start a token-based named tunnel
 *   tunnel --name <name>     Start a locally-managed named tunnel
 */
import { spawn } from 'node:child_process'
import readline from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { buildTunnelArgs } from './args'
import { binaryPath, ensureBinary, getBinaryVersion, isInstalled } from './binary'
import { CloudflaredError } from './errors'
import { ENV_TUNNEL_HOSTNAME, ENV_TUNNEL_NAME, ENV_TUNNEL_TOKEN, resolveConfig } from './options'

const HELP = `
  expo-cloudflared — Cloudflare Tunnel for Expo

  Usage:
    npx expo-cloudflared <command> [options]

  Commands:
    install                  Download the cloudflared binary (also happens lazily on first tunnel)
    version                  Print the installed cloudflared version
    setup                    Guided setup — create a named tunnel with a stable URL
    tunnel [port]            Start a quick tunnel (no Cloudflare account needed)
    tunnel --token <token>   Start a named tunnel using a Cloudflare Tunnel token
    tunnel --name <name>     Start a locally-managed named tunnel (needs \`setup\` once)

  Options:
    --force                  (install) Re-download even if already installed
    --hostname <host>        (tunnel) Public hostname, printed as the tunnel URL
    --help, -h               Show this help message

  Examples:
    npx expo-cloudflared install
    npx expo-cloudflared tunnel 8081
    npx expo-cloudflared tunnel --token eyJh...
    npx expo-cloudflared tunnel 8081 --name my-expo-tunnel --hostname dev.example.com
    npx expo-cloudflared setup
`

async function cmdInstall(force: boolean): Promise<void> {
	await ensureBinary({ force })
	console.log(`cloudflared ${await getBinaryVersion()}`)
}

async function cmdVersion(): Promise<void> {
	if (!isInstalled()) {
		console.error('cloudflared binary not installed. Run `npx expo-cloudflared install` first.')
		process.exitCode = 1
		return
	}
	console.log(`cloudflared ${await getBinaryVersion()}`)
}

/** Spawns the cloudflared binary with inherited stdio and mirrors its exit code. */
function runCloudflared(args: string[]): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(binaryPath(), args, { stdio: 'inherit', windowsHide: true })
		// Forward Ctrl-C / kill to cloudflared and exit with its code
		const forward = (signal: NodeJS.Signals) => (): void => {
			child.kill(signal)
		}
		const onInt = forward('SIGINT')
		const onTerm = forward('SIGTERM')
		process.on('SIGINT', onInt)
		process.on('SIGTERM', onTerm)
		child.on('error', reject)
		child.on('exit', (code) => {
			process.off('SIGINT', onInt)
			process.off('SIGTERM', onTerm)
			resolve(code ?? 0)
		})
	})
}

async function cmdTunnel(positionals: string[], values: TunnelFlags): Promise<void> {
	await ensureBinary()

	const port = positionals.find((arg) => /^\d+$/.test(arg))
	const config = resolveConfig({
		...(port !== undefined && { addr: Number(port) }),
		...(values.token !== undefined && { token: values.token }),
		...(values.name !== undefined && { tunnelName: values.name }),
		...(values.hostname !== undefined && { hostname: values.hostname }),
	})

	if (config.mode === 'quick') {
		console.log(`[expo-cloudflared] Starting quick tunnel → ${config.originUrl}`)
	} else {
		console.log(
			`[expo-cloudflared] Starting named tunnel (${config.tunnelName ?? 'token'})` +
				(config.hostname ? ` → https://${config.hostname}` : '')
		)
	}

	process.exitCode = await runCloudflared(buildTunnelArgs(config))
}

async function cmdSetup(): Promise<void> {
	console.log(`
┌─────────────────────────────────────────────────────────┐
│           expo-cloudflared — Setup Wizard               │
└─────────────────────────────────────────────────────────┘

Cloudflare Tunnel exposes your local Expo dev server with a
secure public HTTPS URL. There are TWO modes:

  1. Quick Tunnel (default — nothing to set up)
     • No Cloudflare account required
     • Random URL each session (https://xxxx.trycloudflare.com)
     • Just run: npx expo start --tunnel

  2. Named Tunnel (stable URL across sessions)
     • Requires a free Cloudflare account + a domain on Cloudflare
     • This wizard sets it up once
`)

	if (!isInstalled()) {
		console.log('  ⚠  cloudflared binary not found — downloading…\n')
		await ensureBinary()
	} else {
		console.log(`  ✓  cloudflared binary found (${await getBinaryVersion()})\n`)
	}

	if (!process.stdin.isTTY) {
		printManualSteps()
		return
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	try {
		const wantsNamed = await rl.question('Set up a named tunnel now? [y/N] ')
		if (!/^y(es)?$/i.test(wantsNamed.trim())) {
			console.log('\nNothing else needed — quick tunnels work out of the box. 🎉')
			return
		}

		console.log('\nStep 1/3 — Log in to Cloudflare (opens your browser)…\n')
		if ((await runCloudflared(['tunnel', 'login'])) !== 0) {
			console.error('\nLogin failed — fix the issue above and re-run `npx expo-cloudflared setup`.')
			process.exitCode = 1
			return
		}

		const name = (await rl.question('\nStep 2/3 — Tunnel name (e.g. my-expo-tunnel): ')).trim()
		if (!name) {
			console.error('No tunnel name given — aborting.')
			process.exitCode = 1
			return
		}
		// "create" fails harmlessly if the tunnel already exists
		await runCloudflared(['tunnel', 'create', name])

		const hostname = (
			await rl.question(
				'\nStep 3/3 — Public hostname on your Cloudflare domain (e.g. dev.example.com): '
			)
		).trim()
		if (!hostname) {
			console.error('No hostname given — aborting.')
			process.exitCode = 1
			return
		}
		if ((await runCloudflared(['tunnel', 'route', 'dns', name, hostname])) !== 0) {
			console.error(
				'\nRouting failed — the hostname may already be taken. Delete the old DNS record ' +
					'in your Cloudflare dashboard or choose a different subdomain, then re-run setup.'
			)
			process.exitCode = 1
			return
		}

		console.log(`
✅ Done! Add these to your Expo project's .env.local:

  ${ENV_TUNNEL_NAME}=${name}
  ${ENV_TUNNEL_HOSTNAME}=${hostname}

Then start Expo as usual:

  npx expo start --tunnel

Your dev server will be reachable at https://${hostname} every session.

Alternative (dashboard-managed "token mode"): run
  ${binaryPath()} tunnel token ${name}
and set ${ENV_TUNNEL_TOKEN}=<token> instead — but note token-mode ingress is
fixed in the Cloudflare dashboard, so the named (${ENV_TUNNEL_NAME}) mode above
is recommended for Expo, where the dev-server port can change.
`)
	} finally {
		rl.close()
	}
}

function printManualSteps(): void {
	console.log(`
── Named tunnel setup (manual steps) ─────────────────────

  Step 1: Log in to Cloudflare (opens a browser)
    ${binaryPath()} tunnel login

  Step 2: Create a tunnel
    ${binaryPath()} tunnel create my-expo-tunnel

  Step 3: Route a DNS hostname to it
    ${binaryPath()} tunnel route dns my-expo-tunnel dev.yourdomain.com

  Step 4: Add to your Expo project's .env.local
    ${ENV_TUNNEL_NAME}=my-expo-tunnel
    ${ENV_TUNNEL_HOSTNAME}=dev.yourdomain.com

  Step 5: npx expo start --tunnel  →  https://dev.yourdomain.com 🎉
`)
}

interface TunnelFlags {
	hostname?: string
	name?: string
	token?: string
}

async function main(): Promise<void> {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: {
			force: { type: 'boolean' },
			help: { short: 'h', type: 'boolean' },
			hostname: { type: 'string' },
			name: { type: 'string' },
			token: { type: 'string' },
		},
	})

	const [command, ...rest] = positionals

	if (values.help || !command) {
		console.log(HELP)
		return
	}

	switch (command) {
		case 'install':
			await cmdInstall(values.force ?? false)
			break
		case 'version':
			await cmdVersion()
			break
		case 'setup':
			await cmdSetup()
			break
		case 'tunnel':
			await cmdTunnel(rest, values)
			break
		default:
			console.error(`Unknown command "${command}". Run with --help for usage.`)
			process.exitCode = 1
	}
}

main().catch((error: unknown) => {
	const message =
		error instanceof CloudflaredError
			? error.message
			: error instanceof Error
				? error.message
				: String(error)
	console.error(`[expo-cloudflared] ${message}`)
	process.exit(1)
})
