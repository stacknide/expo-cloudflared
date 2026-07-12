import assert from 'node:assert/strict'
import test from 'node:test'
import { createLineBuffer, parseLogLine } from 'expo-cloudflared/internal'

// Real cloudflared output samples (stderr)
const QUICK_URL_LINE =
	'2026-07-12T10:00:01Z INF |  https://recommend-manor-priest-galaxy.trycloudflare.com                                   |'
const REGISTERED_LINE =
	'2026-07-12T10:00:02Z INF Registered tunnel connection connIndex=0 connection=6cbc9f42-6c33-4a4a-9a2b-0c0f6ab6c1d1 event=0 ip=198.41.200.23 location=sin06 protocol=quic'
const TOKEN_CONFIG_LINE =
	'2026-07-12T10:00:03Z INF Updated to new configuration config="{\\"ingress\\":[{\\"hostname\\":\\"dev.example.com\\",\\"originRequest\\":{},\\"service\\":\\"http://localhost:8081\\"},{\\"service\\":\\"http_status:404\\"}],\\"warp-routing\\":{\\"enabled\\":false}}" version=3'
const HOSTNAME_KV_LINE =
	'2026-07-12T10:00:04Z INF Route propagating, it may take up to 1 minute for your new route to become functional hostname=dev.example.com'
const METRICS_LINE = '2026-07-12T10:00:00Z INF Starting metrics server on 127.0.0.1:20241/metrics'
const ADDR_IN_USE_LINE =
	'2026-07-12T10:00:05Z ERR Failed to start the metrics server error="listen tcp 127.0.0.1:20241: bind: address already in use"'
const UNAUTHORIZED_LINE =
	'2026-07-12T10:00:06Z ERR Register tunnel error from server side error="Unauthorized: Failed to get tunnel"'
const CERT_MISSING_LINE =
	'2026-07-12T10:00:07Z ERR Cannot determine default origin certificate path. No file cert.pem in [~/.cloudflared ~/.cloudflare-warp ~/cloudflare-warp /etc/cloudflared /usr/local/etc/cloudflared]'
const BUFFER_WARNING_LINE =
	'2026-07-12T10:00:08Z WRN failed to sufficiently increase receive buffer size (was: 208 kiB, wanted: 2048 kiB, got: 416 kiB)'
const QUICK_FAIL_LINE =
	'2026-07-12T10:00:09Z ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": dial tcp: lookup api.trycloudflare.com: no such host'

test('extracts quick tunnel URL', () => {
	const events = parseLogLine(QUICK_URL_LINE)
	assert.deepEqual(events, [
		{ type: 'url', url: 'https://recommend-manor-priest-galaxy.trycloudflare.com' },
	])
})

test('detects registered connection', () => {
	const events = parseLogLine(REGISTERED_LINE)
	assert.ok(events.some((e) => e.type === 'registered'))
})

test('extracts hostname from token-mode ingress config JSON', () => {
	const events = parseLogLine(TOKEN_CONFIG_LINE)
	const hostname = events.find((e) => e.type === 'hostname')
	assert.equal(hostname?.hostname, 'dev.example.com')
})

test('extracts hostname from hostname= key-value', () => {
	const events = parseLogLine(HOSTNAME_KV_LINE)
	const hostname = events.find((e) => e.type === 'hostname')
	assert.equal(hostname?.hostname, 'dev.example.com')
})

test('wildcard/service-only hostnames are not usable', () => {
	const events = parseLogLine('config="{\\"hostname\\":\\"*\\"}"')
	assert.ok(!events.some((e) => e.type === 'hostname'))
})

test('extracts metrics server address', () => {
	const events = parseLogLine(METRICS_LINE)
	assert.deepEqual(events, [{ address: '127.0.0.1:20241', type: 'metrics' }])
})

test('address already in use → fatal ERR_ADDR_IN_USE', () => {
	const events = parseLogLine(ADDR_IN_USE_LINE)
	assert.equal(events[0]?.type, 'fatal')
	assert.equal(events[0]?.code, 'ERR_ADDR_IN_USE')
})

test('unauthorized → fatal ERR_AUTH', () => {
	const events = parseLogLine(UNAUTHORIZED_LINE)
	assert.equal(events[0]?.code, 'ERR_AUTH')
})

test('missing origin cert → fatal ERR_CERT_MISSING', () => {
	const events = parseLogLine(CERT_MISSING_LINE)
	assert.equal(events[0]?.code, 'ERR_CERT_MISSING')
})

test('failed quick tunnel request → fatal ERR_TUNNEL_START', () => {
	const events = parseLogLine(QUICK_FAIL_LINE)
	assert.equal(events[0]?.code, 'ERR_TUNNEL_START')
})

test('buffer size warning is ignored', () => {
	assert.deepEqual(parseLogLine(BUFFER_WARNING_LINE), [])
})

test('disconnected events detected', () => {
	const events = parseLogLine(
		'2026-07-12T10:00:10Z WRN Connection terminated error="..." connIndex=2'
	)
	assert.ok(events.some((e) => e.type === 'disconnected'))
})

test('line buffer reassembles a URL split across chunks', () => {
	const lines = []
	const buffer = createLineBuffer((line) => lines.push(line))
	buffer.push('INF |  https://split-across')
	buffer.push('-chunks.trycloudflare.com  |\nnext line\n')
	assert.equal(lines.length, 2)
	const events = parseLogLine(lines[0])
	assert.deepEqual(events, [{ type: 'url', url: 'https://split-across-chunks.trycloudflare.com' }])
})

test('line buffer flush emits trailing partial line', () => {
	const lines = []
	const buffer = createLineBuffer((line) => lines.push(line))
	buffer.push('no trailing newline')
	assert.equal(lines.length, 0)
	buffer.flush()
	assert.deepEqual(lines, ['no trailing newline'])
})

test('line buffer handles CRLF', () => {
	const lines = []
	const buffer = createLineBuffer((line) => lines.push(line))
	buffer.push('one\r\ntwo\r\n')
	assert.deepEqual(lines, ['one', 'two'])
})
