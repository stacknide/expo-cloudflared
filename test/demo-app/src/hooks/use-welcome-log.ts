import { useEffect } from 'react'

const addGlobalThisUtils = () => {
	const dev: Record<string, unknown> = {
		get computed() {
			return Array.from({ length: 500 }, (_, i) => ({ i, sq: i * i }))
		},
		hint: 'Evaluate __dev__, expand it, or type __dev__. for autocomplete.',
		makeBig() {
			return new Array(100_000).fill(0).map((_, i) => ({ i, s: `row-${i}` }))
		},
		nested: { a: { b: { c: { d: { e: 'deep - expand me' } } } } },
		ticks: 0,
	}
	dev.self = dev
	;(globalThis as Record<string, unknown>).__dev__ = dev
}

addGlobalThisUtils()

export const useWelcomeLog = () => {
	useEffect(function showWelcomeLog() {
		console.log(
			'\x1b[45m\x1b[97m\x1b[1m Welcome \x1b[0m \x1b[35mto expo-cloudflared demo app!\x1b[0m Make sure you read the \x1b[4mdemo-app/README.md\x1b[0m'
		)
	}, [])
}
