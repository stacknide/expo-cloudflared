import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { resolveConfig, TunnelManager } from 'expo-cloudflared/internal'

const URL_LINE = 'INF |  https://fake-tunnel.trycloudflare.com  |'
const REGISTERED_LINE = 'INF Registered tunnel connection connIndex=0 ip=198.41.200.23'
const TOKEN_CONFIG_LINE =
	'INF Updated to new configuration config="{\\"ingress\\":[{\\"hostname\\":\\"dev.example.com\\",\\"service\\":\\"http://localhost:8081\\"}]}"'

class FakeChild extends EventEmitter {
	constructor() {
		super()
		this.stderr = new EventEmitter()
		this.stdout = new EventEmitter()
		this.exitCode = null
		this.killed = false
	}

	kill() {
		this.killed = true
		queueMicrotask(() => {
			this.exitCode = 0
			this.emit('exit', 0)
		})
		return true
	}

	// test helpers
	stderrLine(line) {
		this.stderr.emit('data', Buffer.from(`${line}\n`))
	}

	crash(code = 1) {
		this.exitCode = code
		this.emit('exit', code)
	}
}

const createManager = () => {
	const spawned = []
	const manager = new TunnelManager({
		ensureBinary: async () => '/fake/cloudflared',
		spawn: (...spawnArgs) => {
			const child = new FakeChild()
			spawned.push({ args: spawnArgs, child })
			return child
		},
	})
	return { manager, spawned }
}

const config = (opts, env = {}) => resolveConfig(opts, env, () => {})

test('quick mode resolves the trycloudflare URL', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config(8123))
	await null // let doStart spawn
	spawned[0].child.stderrLine(URL_LINE)
	assert.equal(await promise, 'https://fake-tunnel.trycloudflare.com')
	assert.equal(manager.getUrl(), 'https://fake-tunnel.trycloudflare.com')
	assert.ok(manager.getActiveProcess())
})

test('token mode with env hostname resolves on registered', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(
		config(
			{ port: 8123 },
			{ CLOUDFLARED_TUNNEL_HOSTNAME: 'dev.example.com', CLOUDFLARED_TUNNEL_TOKEN: 'eyJ' }
		)
	)
	await null
	spawned[0].child.stderrLine(REGISTERED_LINE)
	assert.equal(await promise, 'https://dev.example.com')
})

test('token mode without hostname falls back to ingress config from logs', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config({ port: 8123 }, { CLOUDFLARED_TUNNEL_TOKEN: 'eyJ' }))
	await null
	spawned[0].child.stderrLine(TOKEN_CONFIG_LINE)
	spawned[0].child.stderrLine(REGISTERED_LINE)
	assert.equal(await promise, 'https://dev.example.com')
})

test('token mode with no hostname anywhere rejects ERR_NO_HOSTNAME', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config({ port: 8123 }, { CLOUDFLARED_TUNNEL_TOKEN: 'eyJ' }))
	await null
	spawned[0].child.stderrLine(REGISTERED_LINE)
	await assert.rejects(promise, { code: 'ERR_NO_HOSTNAME' })
	assert.equal(manager.getUrl(), null)
})

test('fatal log line rejects with mapped code', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config(8123))
	await null
	spawned[0].child.stderrLine('ERR bind: address already in use')
	await assert.rejects(promise, { code: 'ERR_ADDR_IN_USE' })
})

test('exit before URL rejects ERR_TUNNEL_START', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config(8123))
	await null
	spawned[0].child.crash(1)
	await assert.rejects(promise, { code: 'ERR_TUNNEL_START' })
})

test('stop() while start is pending kills the child and rejects ERR_TUNNEL_STOPPED', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config(8123))
	promise.catch(() => {}) // Expo has already timed out and ignores it
	await null
	assert.equal(spawned.length, 1)
	await manager.stop()
	assert.ok(spawned[0].child.killed)
	await assert.rejects(promise, { code: 'ERR_TUNNEL_STOPPED' })
})

test('deliberate stop() does NOT emit closed status', async () => {
	const { manager, spawned } = createManager()
	const statuses = []
	const promise = manager.start(config({ onStatusChange: (s) => statuses.push(s), port: 8123 }))
	await null
	spawned[0].child.stderrLine(URL_LINE)
	spawned[0].child.stderrLine(REGISTERED_LINE)
	await promise
	assert.deepEqual(statuses, ['connected'])
	await manager.stop()
	assert.deepEqual(statuses, ['connected']) // no 'closed'
	assert.equal(manager.getUrl(), null)
})

test('crash of an established tunnel emits closed exactly once', async () => {
	const { manager, spawned } = createManager()
	const statuses = []
	const promise = manager.start(config({ onStatusChange: (s) => statuses.push(s), port: 8123 }))
	await null
	spawned[0].child.stderrLine(URL_LINE)
	spawned[0].child.stderrLine(REGISTERED_LINE)
	await promise
	spawned[0].child.crash(137)
	assert.deepEqual(statuses, ['connected', 'closed'])
	assert.equal(manager.getUrl(), null)
	assert.equal(manager.getActiveProcess(), null)
})

test('concurrent start() calls share one spawn', async () => {
	const { manager, spawned } = createManager()
	const p1 = manager.start(config(8123))
	const p2 = manager.start(config(8123))
	await null
	assert.equal(spawned.length, 1)
	spawned[0].child.stderrLine(URL_LINE)
	assert.equal(await p1, await p2)
})

test('start() with same config while active returns existing URL without respawn', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config(8123))
	await null
	spawned[0].child.stderrLine(URL_LINE)
	await promise
	const url = await manager.start(config(8123))
	assert.equal(url, 'https://fake-tunnel.trycloudflare.com')
	assert.equal(spawned.length, 1)
})

test('start() with different config replaces the running tunnel', async () => {
	const { manager, spawned } = createManager()
	const p1 = manager.start(config(8123))
	await null
	spawned[0].child.stderrLine(URL_LINE)
	await p1

	const p2 = manager.start(config(9999))
	// second spawn happens after the old child exits (stop → kill → exit event)
	await new Promise((resolve) => setImmediate(resolve))
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(spawned.length, 2)
	spawned[1].child.stderrLine('INF |  https://second-tunnel.trycloudflare.com  |')
	assert.equal(await p2, 'https://second-tunnel.trycloudflare.com')
	assert.ok(spawned[0].child.killed)
})

test('name mode without cert.pem rejects ERR_CERT_MISSING', async (t) => {
	const original = process.env.TUNNEL_ORIGIN_CERT
	process.env.TUNNEL_ORIGIN_CERT = '/nonexistent/cert.pem'
	t.after(() => {
		if (original === undefined) delete process.env.TUNNEL_ORIGIN_CERT
		else process.env.TUNNEL_ORIGIN_CERT = original
	})

	const { manager } = createManager()
	const promise = manager.start(
		config(
			{ port: 8123 },
			{ CLOUDFLARED_TUNNEL_HOSTNAME: 'dev.example.com', CLOUDFLARED_TUNNEL_NAME: 'my-tunnel' }
		)
	)
	await assert.rejects(promise, { code: 'ERR_CERT_MISSING' })
})

test('metrics address from logs is exposed via getMetricsUrl', async () => {
	const { manager, spawned } = createManager()
	const promise = manager.start(config(8123))
	await null
	spawned[0].child.stderrLine('INF Starting metrics server on 127.0.0.1:20241/metrics')
	spawned[0].child.stderrLine(URL_LINE)
	await promise
	assert.equal(manager.getMetricsUrl(), 'http://127.0.0.1:20241')
})
