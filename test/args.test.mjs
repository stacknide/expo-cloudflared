import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTunnelArgs, resolveConfig } from 'expo-cloudflared/internal'

const noWarn = () => {}
const argsFor = (opts, env = {}) => buildTunnelArgs(resolveConfig(opts, env, noWarn))

test('quick tunnel argv', () => {
	assert.deepEqual(argsFor(8081), ['tunnel', '--no-autoupdate', '--url', 'http://localhost:8081'])
})

test('quick tunnel argv with logLevel and metrics (global flags before --url)', () => {
	assert.deepEqual(
		argsFor({ addr: 8081, logLevel: 'debug', metricsUrl: 'http://127.0.0.1:20241' }),
		[
			'tunnel',
			'--no-autoupdate',
			'--loglevel',
			'debug',
			'--metrics',
			'127.0.0.1:20241',
			'--url',
			'http://localhost:8081',
		]
	)
})

test('token tunnel argv', () => {
	assert.deepEqual(argsFor({ token: 'eyJabc' }), [
		'tunnel',
		'--no-autoupdate',
		'run',
		'--token',
		'eyJabc',
	])
})

test('name tunnel argv routes --url to the local port', () => {
	assert.deepEqual(argsFor({ port: 8081 }, { CLOUDFLARED_TUNNEL_NAME: 'my-tunnel' }), [
		'tunnel',
		'--no-autoupdate',
		'run',
		'--url',
		'http://localhost:8081',
		'my-tunnel',
	])
})

test('name tunnel argv with global flags between tunnel and run', () => {
	assert.deepEqual(
		argsFor({ logLevel: 'info', port: 8081 }, { CLOUDFLARED_TUNNEL_NAME: 'my-tunnel' }),
		[
			'tunnel',
			'--no-autoupdate',
			'--loglevel',
			'info',
			'run',
			'--url',
			'http://localhost:8081',
			'my-tunnel',
		]
	)
})
