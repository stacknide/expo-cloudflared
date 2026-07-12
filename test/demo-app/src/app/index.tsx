import * as Device from 'expo-device'
import { Platform, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AnimatedIcon } from '@/components/animated-icon'
import { HintRow } from '@/components/hint-row'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { WebBadge } from '@/components/web-badge'
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme'

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

export default function HomeScreen() {
	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ThemedView style={styles.heroSection}>
					<AnimatedIcon />
					<ThemedText style={styles.title} type="title">
						Welcome to&nbsp;Expo
					</ThemedText>
				</ThemedView>

				<ThemedText style={styles.code} type="code">
					get started
				</ThemedText>

				<ThemedView style={styles.stepContainer} type="backgroundElement">
					<HintRow
						hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
						title="Try editing"
					/>
					<HintRow hint={getDevMenuHint()} title="Dev tools" />
					<HintRow
						hint={<ThemedText type="code">npm run reset-project</ThemedText>}
						title="Fresh start"
					/>
				</ThemedView>

				{Platform.OS === 'web' && <WebBadge />}
			</SafeAreaView>
		</ThemedView>
	)
}

const styles = StyleSheet.create({
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
		flex: 1,
		gap: Spacing.four,
		justifyContent: 'center',
		paddingHorizontal: Spacing.four,
	},
	safeArea: {
		alignItems: 'center',
		flex: 1,
		gap: Spacing.three,
		maxWidth: MaxContentWidth,
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
