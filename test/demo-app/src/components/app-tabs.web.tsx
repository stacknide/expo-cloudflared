import {
	TabList,
	type TabListProps,
	TabSlot,
	Tabs,
	TabTrigger,
	type TabTriggerSlotProps,
} from 'expo-router/ui'
import { SymbolView } from 'expo-symbols'
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native'
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme'
import { ExternalLink } from './external-link'
import { ThemedText } from './themed-text'
import { ThemedView } from './themed-view'

export default function AppTabs() {
	return (
		<Tabs>
			<TabSlot style={{ height: '100%' }} />
			<TabList asChild>
				<CustomTabList>
					<TabTrigger asChild href="/" name="home">
						<TabButton>Home</TabButton>
					</TabTrigger>
					<TabTrigger asChild href="/explore" name="explore">
						<TabButton>Explore</TabButton>
					</TabTrigger>
				</CustomTabList>
			</TabList>
		</Tabs>
	)
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
	return (
		<Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
			<ThemedView
				style={styles.tabButtonView}
				type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
			>
				<ThemedText themeColor={isFocused ? 'text' : 'textSecondary'} type="small">
					{children}
				</ThemedText>
			</ThemedView>
		</Pressable>
	)
}

export function CustomTabList(props: TabListProps) {
	const scheme = useColorScheme()
	const colors = Colors[scheme === 'unspecified' ? 'light' : scheme]

	return (
		<View {...props} style={styles.tabListContainer}>
			<ThemedView style={styles.innerContainer} type="backgroundElement">
				<ThemedText style={styles.brandText} type="smallBold">
					Expo Starter
				</ThemedText>

				{props.children}

				<ExternalLink asChild href="https://docs.expo.dev">
					<Pressable style={styles.externalPressable}>
						<ThemedText type="link">Docs</ThemedText>
						<SymbolView
							name={{ ios: 'arrow.up.right.square', web: 'link' }}
							size={12}
							tintColor={colors.text}
						/>
					</Pressable>
				</ExternalLink>
			</ThemedView>
		</View>
	)
}

const styles = StyleSheet.create({
	brandText: {
		marginRight: 'auto',
	},
	externalPressable: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: Spacing.one,
		justifyContent: 'center',
		marginLeft: Spacing.three,
	},
	innerContainer: {
		alignItems: 'center',
		borderRadius: Spacing.five,
		flexDirection: 'row',
		flexGrow: 1,
		gap: Spacing.two,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.five,
		paddingVertical: Spacing.two,
	},
	pressed: {
		opacity: 0.7,
	},
	tabButtonView: {
		borderRadius: Spacing.three,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.one,
	},
	tabListContainer: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'center',
		padding: Spacing.three,
		position: 'absolute',
		width: '100%',
	},
})
