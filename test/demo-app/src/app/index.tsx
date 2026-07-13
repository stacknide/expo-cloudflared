import * as Device from 'expo-device'
import { Platform, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AnimatedIcon } from '@/components/animated-icon'
import { HintRow } from '@/components/hint-row'
import { SecureContextWebview } from '@/components/secure-context-dom-loader'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { WebBadge } from '@/components/web-badge'
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme'
import { useWelcomeLog } from '@/hooks/use-welcome-log'

export default function HomeScreen() {
	useWelcomeLog()
	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					style={styles.scroll}
				>
					<ThemedView style={styles.heroSection}>
						<AnimatedIcon />
						<ThemedText style={styles.title} type="subtitle">
							Welcome to{'\n'}
							<ThemedText style={styles.bigFont} type="code">
								expo-cloudflared
							</ThemedText>
						</ThemedText>
					</ThemedView>

					<SecureContextWebview />

					<ThemedText style={styles.code} type="code">
						https tunnel demo
					</ThemedText>

					{Platform.OS === 'web' && <WebBadge />}

					{/* <ThemedText style={styles.code} type="code">
						get started
					</ThemedText>

					<ThemedView style={styles.stepContainer} type="backgroundElement">
						<HintRow
							hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
							title="Try editing"
						/> */}
					<HintRow hint={getDevMenuHint()} title="Dev tools" />
					{/* 
						<HintRow
							hint={<ThemedText type="code">npm run reset-project</ThemedText>}
							title="Fresh start"
						/>
					</ThemedView>
					*/}
				</ScrollView>
			</SafeAreaView>
		</ThemedView>
	)
}

const styles = StyleSheet.create({
	bigFont: {
		fontSize: 30,
		fontWeight: 600,
	},
	code: {
		textTransform: 'uppercase',
	},
	container: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'center',
	},
	heroSection: {
		alignItems: 'center',
		gap: Spacing.four,
		justifyContent: 'center',
		paddingHorizontal: Spacing.four,
		paddingVertical: Spacing.five,
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		width: '100%',
	},
	scroll: {
		flex: 1,
	},
	scrollContent: {
		alignItems: 'center',
		gap: Spacing.three,
		paddingBottom: BottomTabInset + Spacing.three,
		paddingHorizontal: Spacing.four,
	},
	stepContainer: {
		alignSelf: 'stretch',
		borderRadius: Spacing.four,
		gap: Spacing.three,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.four,
	},
	title: {
		textAlign: 'center',
	},
})

function getDevMenuHint() {
	if (Platform.OS === 'web') {
		return <ThemedText type="small">use browser devtools</ThemedText>
	}
	if (Device.isDevice) {
		return (
			<ThemedText type="small">
				shake device or press <ThemedText type="code">m</ThemedText> in terminal
			</ThemedText>
		)
	}
	const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d'
	return (
		<ThemedText type="small">
			press <ThemedText type="code">{shortcut}</ThemedText>
		</ThemedText>
	)
}
