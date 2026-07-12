import assert from 'node:assert/strict'
import test from 'node:test'
import {
	ENV_TUNNEL_HOSTNAME,
	ENV_TUNNEL_NAME,
	ENV_TUNNEL_TOKEN,
	resolveConfig,
} from 'expo-cloudflared/internal'

const noWarn = () => {}
const resolve = (opts, env = {}) => resolveConfig(opts, env, noWarn)

test('no args → quick tunnel on port 3000', () => {
	const config = resolve()
	assert.equal(config.mode, 'quick')
	assert.equal(config.originUrl, 'http://localhost:3000')
	assert.equal(config.originExplicit, false)
	assert.equal(config.hostname, null)
})

test('number arg → quick tunnel on that port', () => {
	assert.equal(resolve(8081).originUrl, 'http://localhost:8081')
})

test('numeric string arg → quick tunnel on that port', () => {
	assert.equal(resolve('8081').originUrl, 'http://localhost:8081')
})

test('addr as full address string passes through', () => {
	assert.equal(resolve({ addr: 'http://192.168.1.5:8081' }).originUrl, 'http://192.168.1.5:8081')
})

test('proto is honored for numeric addr', () => {
	assert.equal(resolve({ addr: 8081, proto: 'https' }).originUrl, 'https://localhost:8081')
})

test('Expo CLI options shape → quick mode, exp.direct hostname ignored', () => {
	const config = resolve({
		authtoken: 'ngrok-token',
		configPath: '/home/user/.expo/ngrok.yml',
		hostname: 'abc12-anonymous-8081.exp.direct',
		onStatusChange: () => {},
		port: 8081,
	})
	assert.equal(config.mode, 'quick')
	assert.equal(config.originUrl, 'http://localhost:8081')
	assert.equal(config.hostname, null)
	assert.equal(typeof config.onStatusChange, 'function')
})

test('env token → token mode', () => {
	const config = resolve({ port: 8081 }, { [ENV_TUNNEL_TOKEN]: 'eyJhbGciOi' })
	assert.equal(config.mode, 'token')
	assert.equal(config.token, 'eyJhbGciOi')
})

test('env token + Expo exp.direct hostname → hostname ignored, env hostname wins', () => {
	const config = resolve(
		{ hostname: 'abc12-anonymous-8081.exp.direct', port: 8081 },
		{ [ENV_TUNNEL_HOSTNAME]: 'dev.example.com', [ENV_TUNNEL_TOKEN]: 'eyJhbGciOi' }
	)
	assert.equal(config.mode, 'token')
	assert.equal(config.hostname, 'dev.example.com')
})

test('env name + hostname → name mode', () => {
	const config = resolve(
		{ port: 8081 },
		{ [ENV_TUNNEL_HOSTNAME]: 'dev.example.com', [ENV_TUNNEL_NAME]: 'my-expo-tunnel' }
	)
	assert.equal(config.mode, 'name')
	assert.equal(config.tunnelName, 'my-expo-tunnel')
	assert.equal(config.hostname, 'dev.example.com')
	assert.equal(config.originUrl, 'http://localhost:8081')
})

test('both env vars set → name mode wins, warning emitted', () => {
	const warnings = []
	const config = resolveConfig(
		{ port: 8081 },
		{ [ENV_TUNNEL_NAME]: 'my-tunnel', [ENV_TUNNEL_TOKEN]: 'eyJ' },
		(msg) => warnings.push(msg)
	)
	assert.equal(config.mode, 'name')
	assert.equal(config.token, null)
	assert.equal(warnings.length, 1)
})

test('explicit token option beats env name', () => {
	const config = resolve({ token: 'explicit-token' }, { [ENV_TUNNEL_NAME]: 'my-tunnel' })
	assert.equal(config.mode, 'token')
	assert.equal(config.token, 'explicit-token')
})

test('explicit token + explicit hostname → hostname honored', () => {
	const config = resolve({ hostname: 'dev.example.com', token: 'eyJ' })
	assert.equal(config.hostname, 'dev.example.com')
})

test('explicit tunnelName → name mode', () => {
	const config = resolve({ addr: 8081, tunnelName: 'my-tunnel' })
	assert.equal(config.mode, 'name')
	assert.equal(config.tunnelName, 'my-tunnel')
})

test('explicit token + tunnelName → ERR_CONFLICTING_OPTIONS', () => {
	assert.throws(() => resolve({ token: 'x', tunnelName: 'y' }), { code: 'ERR_CONFLICTING_OPTIONS' })
})

test('empty env vars are treated as unset', () => {
	const config = resolve(8081, { [ENV_TUNNEL_NAME]: '', [ENV_TUNNEL_TOKEN]: '  ' })
	assert.equal(config.mode, 'quick')
})

test('metricsUrl → metricsHostPort derived', () => {
	const config = resolve({ metricsUrl: 'http://127.0.0.1:20241' })
	assert.equal(config.metricsHostPort, '127.0.0.1:20241')
	assert.equal(config.metricsUrl, 'http://127.0.0.1:20241')
})

test('invalid metricsUrl → ERR_INVALID_OPTION', () => {
	assert.throws(() => resolve({ metricsUrl: 'not a url' }), { code: 'ERR_INVALID_OPTION' })
})

test('invalid proto → ERR_INVALID_OPTION', () => {
	assert.throws(() => resolve({ proto: 'gopher' }), { code: 'ERR_INVALID_OPTION' })
})

test('invalid logLevel → ERR_INVALID_OPTION', () => {
	assert.throws(() => resolve({ logLevel: 'verbose' }), { code: 'ERR_INVALID_OPTION' })
})

test('token mode with explicit port → warns about dashboard ingress', () => {
	const warnings = []
	resolveConfig({ port: 8081 }, { [ENV_TUNNEL_TOKEN]: 'eyJ' }, (msg) => warnings.push(msg))
	assert.equal(warnings.length, 1)
	assert.match(warnings[0], /dashboard/)
})
