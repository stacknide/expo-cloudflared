import { defineConfig } from 'tsup'

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig([
	{
		clean: !isDev,
		dts: true,
		entry: {
			index: 'src/index.ts',
			internal: 'src/internal.ts',
		},
		format: ['cjs', 'esm'],
		// Deliberately unminified — this is a tunnel shim people will read and
		// debug inside node_modules/@expo/ngrok; size is irrelevant.
		minify: false,
		platform: 'node',
		// __dirname in the ESM build (binary.ts locates the bin/ dir with it)
		shims: true,
		sourcemap: isDev,
		target: 'node18',
		watch: isDev,
	},
	{
		// CLI entry — CJS only, no dts. `clean: false` so it doesn't wipe the
		// main config's output; esbuild preserves the source hashbang.
		clean: false,
		dts: false,
		entry: {
			cli: 'src/cli.ts',
		},
		format: ['cjs'],
		minify: false,
		platform: 'node',
		sourcemap: isDev,
		target: 'node18',
		watch: isDev,
	},
])
