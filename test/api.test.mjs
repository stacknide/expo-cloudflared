import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)

test('Expo CLI access pattern: require() + .connect / .kill?.()', () => {
	// Exactly what @expo/cli does after resolving node_modules/@expo/ngrok
	const instance = require('expo-cloudflared')
	assert.equal(typeof instance.connect, 'function')
	assert.equal(typeof instance.kill, 'function')
	assert.equal(typeof instance.disconnect, 'function')
	assert.equal(typeof instance.getUrl, 'function')
	assert.equal(typeof instance.getActiveProcess, 'function')
	assert.equal(typeof instance.getApi, 'function')
	assert.equal(typeof instance.getVersion, 'function')
	assert.equal(typeof instance.authtoken, 'function')
	assert.equal(typeof instance.CloudflaredError, 'function')
	assert.equal(typeof instance.CloudflaredClientError, 'function')
})

test("version guardrail: package version must satisfy Expo CLI's ^4.1.0 range", () => {
	// @expo/cli NgrokResolver: semver.satisfies(version, '^4.1.0'). If this
	// test fails, `expo start --tunnel` will refuse the package — breaking
	// changes must ship as 4.x minors, never as a 5.0.0 major.
	const { version } = require('expo-cloudflared/package.json')
	const [major, minor] = version.split('.').map(Number)
	assert.equal(major, 4, `major version must stay 4 (got ${version})`)
	assert.ok(minor >= 1, `minor version must be >= 1 (got ${version})`)
})

test('kill() when idle resolves quickly and getUrl() is null', async () => {
	const instance = require('expo-cloudflared')
	assert.equal(instance.getUrl(), null)
	assert.equal(instance.getActiveProcess(), null)
	assert.equal(instance.getApi(), null)
	await instance.kill() // Expo calls stopAsync() before the first connect too
})

test('authtoken() is a no-op that resolves', async () => {
	const instance = require('expo-cloudflared')
	await instance.authtoken('anything')
})

test('ESM named imports work too', async () => {
	const esm = await import('expo-cloudflared')
	assert.equal(typeof esm.connect, 'function')
	assert.equal(typeof esm.kill, 'function')
})
