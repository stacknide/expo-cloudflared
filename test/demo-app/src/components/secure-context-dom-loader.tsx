import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import SecureContextDom from './secure-context.dom'
import { ThemedText } from './themed-text'

/**
 * Native host for the {@link SecureContextDom} DOM component.
 *
 * The DOM component runs web code inside a WebView (`react-native-webview`),
 * which only exposes Secure Context web APIs when it is served over HTTPS. It
 * reports its secure-context result back here over the native bridge so we can
 * show it in a plain React Native `<Text>` alongside the web UI.
 *
 * Run `expo start --tunnel` (HTTPS via `expo-cloudflared`) to see the probe go
 * green; a plain LAN URL keeps it red.
 */
export function SecureContextWebview() {
	const scheme = useColorScheme()
	const themeName = scheme === 'dark' ? 'dark' : 'light'

	const [secure, setSecure] = useState<boolean | null>(null)
	const onStatus = useCallback(async (isSecure: boolean) => {
		setSecure(isSecure)
	}, [])

	return (
		<View style={styles.container}>
			<ThemedText themeColor="textSecondary" type="small">
				WebView reports:{' '}
				{secure === null ? 'waiting…' : secure ? 'Secure Context ✓' : 'not a Secure Context ✗'}
			</ThemedText>

			<SecureContextDom
				dom={{ scrollEnabled: false, style: styles.dom }}
				onStatus={onStatus}
				themeName={themeName}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		alignSelf: 'stretch',
		gap: Spacing.two,
	},
	dom: {
		height: 420,
		width: '100%',
	},
})
