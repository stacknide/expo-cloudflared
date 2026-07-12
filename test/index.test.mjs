import assert from 'node:assert/strict'
import test from 'node:test'
import { add, greet } from '@stacknide/expo-cloudflared'

test('greet', () => {
	assert.equal(greet('world'), 'Hello, world!')
})

test('add', () => {
	assert.equal(add(2, 3), 5)
})
