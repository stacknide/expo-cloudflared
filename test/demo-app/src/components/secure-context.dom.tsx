'use dom'

/**
 * A DOM component (runs as web code inside a WebView on native, and as-is on web).
 *
 * It demonstrates that a WebView can only reach **Secure Context** web APIs
 * (Web Crypto's `crypto.subtle`, `navigator.mediaDevices`, etc.) when the page
 * is served over HTTPS. On a plain LAN dev URL (`http://192.168.x.x:8081`) the
 * browser marks the context insecure and hides those APIs.
 *
 * Starting Expo with `--tunnel` — powered here by the local `expo-cloudflared`
 * package — serves the dev bundle over `https://*.trycloudflare.com`, which
 * flips `window.isSecureContext` to `true` and unlocks the gated APIs.
 *
 * This is the mechanism the real FaceLivenessDetector camera flow relies on.
 */

import { useCallback, useEffect, useState } from 'react'

type ThemeName = 'light' | 'dark'

interface Props {
	themeName?: ThemeName
	/** Bubbles the secure-context result back to the native side (bridge demo). */
	onStatus?: (secure: boolean) => Promise<void>
	dom?: import('expo/dom').DOMProps
}

const palette = {
	dark: {
		accent: '#3c87f7',
		bad: '#f85149',
		bg: '#212225',
		border: '#2E3135',
		codeBg: '#000000',
		muted: '#B0B4BA',
		ok: '#3fb950',
		text: '#ffffff',
	},
	light: {
		accent: '#3c87f7',
		bad: '#d1242f',
		bg: '#F0F0F3',
		border: '#E0E1E6',
		codeBg: '#ffffff',
		muted: '#60646C',
		ok: '#1a7f37',
		text: '#000000',
	},
} as const

export default function SecureContextDom({ themeName = 'light', onStatus }: Props) {
	const c = palette[themeName]

	// These reads are safe on both native WebViews and web.
	const isSecure = typeof window !== 'undefined' && window.isSecureContext === true
	const origin =
		typeof location !== 'undefined' ? `${location.protocol}//${location.host}` : 'unknown'
	const hasSubtleCrypto = typeof crypto !== 'undefined' && !!crypto.subtle
	const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices

	const [digest, setDigest] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Let the native side know whether the WebView landed in a secure context.
	useEffect(() => {
		onStatus?.(isSecure).catch(() => {})
	}, [isSecure, onStatus])

	const runWebCrypto = useCallback(async () => {
		setError(null)
		setDigest(null)
		try {
			// `crypto.subtle` is `undefined` outside a Secure Context, so this
			// throws on a plain http:// LAN URL and succeeds over the https tunnel.
			const bytes = new TextEncoder().encode(`expo-cloudflared @ ${origin}`)
			const hashed = await crypto.subtle.digest('SHA-256', bytes)
			const hex = Array.from(new Uint8Array(hashed))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('')
			setDigest(hex)
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		}
	}, [origin])

	return (
		<div
			style={{
				background: c.bg,
				border: `1px solid ${c.border}`,
				borderRadius: 16,
				boxSizing: 'border-box',
				color: c.text,
				fontFamily:
					'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
				padding: 20,
			}}
		>
			<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Secure Context probe</div>
			<div style={{ color: c.muted, fontSize: 13, marginBottom: 16 }}>
				Running inside a WebView via a DOM component.
			</div>

			<Row c={c} label="window.isSecureContext" ok={isSecure} value={String(isSecure)} />
			<Row c={c} label="Origin" mono value={origin} />
			<Row
				c={c}
				label="crypto.subtle (Web Crypto)"
				ok={hasSubtleCrypto}
				value={hasSubtleCrypto ? 'available' : 'undefined'}
			/>
			<Row
				c={c}
				label="navigator.mediaDevices (camera)"
				ok={hasMediaDevices}
				value={hasMediaDevices ? 'available' : 'undefined'}
			/>

			<button
				onClick={runWebCrypto}
				style={{
					background: c.accent,
					border: 'none',
					borderRadius: 10,
					color: '#ffffff',
					cursor: 'pointer',
					fontSize: 15,
					fontWeight: 600,
					marginTop: 16,
					padding: '12px 16px',
					width: '100%',
				}}
				type="button"
			>
				Hash a message with
				<br />
				SubtleCrypto Web API
			</button>

			{digest && (
				<div style={{ marginTop: 14 }}>
					<div style={{ color: c.ok, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
						✓ SHA-256 computed — Web Crypto works over the tunnel
					</div>
					<code
						style={{
							background: c.codeBg,
							border: `1px solid ${c.border}`,
							borderRadius: 8,
							color: c.muted,
							display: 'block',
							fontSize: 11,
							lineHeight: 1.5,
							padding: 10,
							wordBreak: 'break-all',
						}}
					>
						{digest}
					</code>
				</div>
			)}

			{error && (
				<div style={{ marginTop: 14 }}>
					<div style={{ color: c.bad, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
						✗ Web Crypto failed — this origin is not a Secure Context
					</div>
					<code
						style={{
							background: c.codeBg,
							border: `1px solid ${c.border}`,
							borderRadius: 8,
							color: c.bad,
							display: 'block',
							fontSize: 11,
							lineHeight: 1.5,
							padding: 10,
							wordBreak: 'break-all',
						}}
					>
						{error}
					</code>
				</div>
			)}

			<div style={{ color: c.muted, fontSize: 12, lineHeight: 1.6, marginTop: 16 }}>
				On a plain <code style={{ color: c.text }}>http://…:8081</code> LAN URL these APIs are
				hidden. Start Expo with <code style={{ color: c.text }}>--tunnel</code> (served over HTTPS
				by <code style={{ color: c.text }}>expo-cloudflared</code>) to unlock them.
			</div>
		</div>
	)
}

function Row({
	c,
	label,
	value,
	ok,
	mono,
}: {
	c: (typeof palette)[ThemeName]
	label: string
	value: string
	ok?: boolean
	mono?: boolean
}) {
	return (
		<div
			style={{
				alignItems: 'center',
				borderBottom: `1px solid ${c.border}`,
				display: 'flex',
				gap: 12,
				justifyContent: 'space-between',
				padding: '8px 0',
			}}
		>
			<span style={{ color: c.muted, fontSize: 13 }}>{label}</span>
			<span
				style={{
					color: ok === undefined ? c.text : ok ? c.ok : c.bad,
					fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
					fontSize: 13,
					fontWeight: 600,
					textAlign: 'right',
					wordBreak: 'break-all',
				}}
			>
				{ok === undefined ? '' : ok ? '✓ ' : '✗ '}
				{value}
			</span>
		</div>
	)
}
