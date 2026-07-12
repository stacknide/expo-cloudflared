import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import zlib from 'node:zlib'
import { CloudflaredError } from './errors'

const execFileAsync = promisify(execFile)

/**
 * Lazy management of the official cloudflared binary.
 *
 * The binary (~40 MB) is downloaded from Cloudflare's GitHub releases on the
 * FIRST tunnel start — deliberately not in a postinstall hook, so installing
 * this package never slows down `yarn install` / `npm install`.
 *
 * Env overrides:
 *   CLOUDFLARED_BIN       — use an existing cloudflared binary at this path
 *   CLOUDFLARED_VERSION   — pin the release to download (e.g. "2026.6.0")
 *   CLOUDFLARED_PLATFORM  — override process.platform for asset selection
 *   CLOUDFLARED_ARCH      — override process.arch for asset selection
 */

const RELEASE_BASE = 'https://github.com/cloudflare/cloudflared/releases'

// Maps `${platform}-${arch}` → GitHub release asset name
const ASSET_MAP: Readonly<Record<string, string>> = {
	'darwin-arm64': 'cloudflared-darwin-arm64.tgz',
	'darwin-x64': 'cloudflared-darwin-amd64.tgz',
	'linux-arm': 'cloudflared-linux-arm',
	'linux-arm64': 'cloudflared-linux-arm64',
	'linux-x64': 'cloudflared-linux-amd64',
	'win32-arm64': 'cloudflared-windows-arm64.exe',
	'win32-x64': 'cloudflared-windows-amd64.exe',
}

// Binaries are cached in Expo's user-level settings directory (~/.expo — the
// same place Expo CLI keeps its ngrok.yml), NOT inside node_modules: one
// download per device, shared by every project and surviving node_modules
// wipes. Pinned versions get version-suffixed filenames so projects pinning
// different CLOUDFLARED_VERSIONs coexist without collisions:
//
//   ~/.expo/expo-cloudflared/cloudflared             ← unpinned ("latest")
//   ~/.expo/expo-cloudflared/cloudflared-2026.5.0    ← pinned
const BIN_DIR = path.join(os.homedir(), '.expo', 'expo-cloudflared')

const envVersion = (): string | undefined => process.env.CLOUDFLARED_VERSION?.trim() || undefined

/** Absolute path where the cloudflared binary lives (or will be installed). */
export function binaryPath(version: string | undefined = envVersion()): string {
	const override = process.env.CLOUDFLARED_BIN?.trim()
	if (override) return override
	const suffix = version && version !== 'latest' ? `-${version}` : ''
	const ext = process.platform === 'win32' ? '.exe' : ''
	return path.join(BIN_DIR, `cloudflared${suffix}${ext}`)
}

export function isInstalled(version: string | undefined = envVersion()): boolean {
	return fs.existsSync(binaryPath(version))
}

function getAssetName(): string {
	const platform = process.env.CLOUDFLARED_PLATFORM || process.platform
	const arch = process.env.CLOUDFLARED_ARCH || process.arch
	const key = `${platform}-${arch}`
	const asset = ASSET_MAP[key]
	if (!asset) {
		throw new CloudflaredError(
			'ERR_UNSUPPORTED_PLATFORM',
			`Unsupported platform "${key}". Supported: ${Object.keys(ASSET_MAP).join(', ')}. ` +
				'Install cloudflared yourself and point CLOUDFLARED_BIN at it.'
		)
	}
	return asset
}

function assetUrl(version: string | undefined): string {
	const asset = getAssetName()
	// `releases/latest/download/<asset>` redirects to the newest release —
	// no GitHub API call, so no rate limits.
	if (!version || version === 'latest') return `${RELEASE_BASE}/latest/download/${asset}`
	return `${RELEASE_BASE}/download/${version}/${asset}`
}

/**
 * Extracts the cloudflared binary from a .tgz buffer (macOS releases ship as
 * tarballs). Minimal ustar walk — finds the first regular-file entry.
 */
function extractTgz(buffer: Buffer): Buffer {
	const tar = zlib.gunzipSync(buffer)
	let offset = 0
	while (offset + 512 <= tar.length) {
		const header = tar.subarray(offset, offset + 512)
		if (header[0] === 0) break // end-of-archive
		const size = Number.parseInt(header.subarray(124, 136).toString().trim(), 8) || 0
		const typeFlag = String.fromCharCode(header[156] ?? 48)
		offset += 512
		if (typeFlag === '0' || typeFlag === '\0') {
			return tar.subarray(offset, offset + size)
		}
		offset += Math.ceil(size / 512) * 512
	}
	throw new Error('No file entry found in tgz archive')
}

async function download(url: string): Promise<Buffer> {
	const res = await fetch(url, {
		headers: { 'user-agent': 'expo-cloudflared' },
		redirect: 'follow',
	})
	if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`)
	return Buffer.from(await res.arrayBuffer())
}

export interface EnsureBinaryOptions {
	/** Re-download even when a binary is already installed. */
	force?: boolean
	/** Release to download, e.g. "2026.6.0". Defaults to CLOUDFLARED_VERSION or latest. */
	version?: string
}

const installPromises = new Map<string, Promise<string>>()

/**
 * Returns the path to a ready-to-run cloudflared binary, downloading it on
 * first use. Concurrent (and abandoned-then-retried) calls for the same
 * version share one in-flight download — Expo CLI retries `connect()` on a
 * 10s timeout, and restarting a 40 MB download on each attempt would never
 * converge on slow networks.
 */
export function ensureBinary(options: EnsureBinaryOptions = {}): Promise<string> {
	// A user-supplied binary is used as-is — never download over it.
	const override = process.env.CLOUDFLARED_BIN?.trim()
	if (override) {
		if (fs.existsSync(override)) return Promise.resolve(override)
		return Promise.reject(
			new CloudflaredError(
				'ERR_BINARY_INSTALL',
				`CLOUDFLARED_BIN points at "${override}", but no file exists there.`
			)
		)
	}

	const version = options.version?.trim() || envVersion()
	const target = binaryPath(version)

	if (!options.force && fs.existsSync(target)) return Promise.resolve(target)
	const inFlight = installPromises.get(target)
	if (inFlight) return inFlight

	const promise = installBinary(version, target).catch((error: unknown) => {
		installPromises.delete(target) // allow a retry after a transient failure
		const message = error instanceof Error ? error.message : String(error)
		if (error instanceof CloudflaredError) throw error
		throw new CloudflaredError(
			'ERR_BINARY_INSTALL',
			`Could not download the cloudflared binary: ${message}. ` +
				'Check your network and retry, or run `npx expo-cloudflared install` manually.'
		)
	})
	installPromises.set(target, promise)
	return promise
}

async function installBinary(version: string | undefined, target: string): Promise<string> {
	const url = assetUrl(version)

	console.log(`[expo-cloudflared] Downloading cloudflared (${version ?? 'latest'})…`)
	let buffer = await download(url)
	if (getAssetName().endsWith('.tgz')) buffer = extractTgz(buffer)

	fs.mkdirSync(path.dirname(target), { recursive: true })
	fs.writeFileSync(target, buffer)
	if (process.platform !== 'win32') fs.chmodSync(target, 0o755)

	console.log(`[expo-cloudflared] cloudflared installed at ${target}`)
	return target
}

/** Version string of the installed cloudflared binary, e.g. "2026.6.0". */
export async function getBinaryVersion(): Promise<string> {
	const { stdout, stderr } = await execFileAsync(binaryPath(), ['--version'])
	// Output: "cloudflared version 2026.6.0 (built ...)"
	const out = (stdout || stderr).trim()
	const match = out.match(/cloudflared version ([\d.]+)/)
	return match?.[1] ?? out
}
