// Publish guard: Expo CLI's NgrokResolver only accepts the package installed
// at node_modules/@expo/ngrok when its version satisfies ^4.1.0. A 5.x major
// would silently break `expo start --tunnel` for every user — breaking
// changes must ship as 4.x minors instead.
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const [major, minor] = pkg.version.split('.').map(Number)

if (major !== 4 || minor < 1) {
	console.error(
		`✖ expo-cloudflared@${pkg.version} does not satisfy Expo CLI's required range ^4.1.0.\n` +
			'  Expo CLI (NgrokResolver) refuses @expo/ngrok replacements outside >=4.1.0 <5.0.0.\n' +
			'  Never select "major" in `yarn changeset` — ship breaking changes as 4.x minors.'
	)
	process.exit(1)
}
console.log(`✓ expo-cloudflared@${pkg.version} satisfies Expo CLI's ^4.1.0 range`)
