import { defineConfig } from 'tsup'

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig([
	{
		clean: !isDev,
		// tsup injects `baseUrl: "."` into the dts build, which TypeScript 6
		// rejects as deprecated (TS5101) — silence it until tsup stops doing that.
		// migrate to tsdown later: https://github.com/egoist/tsup/issues/1388#issuecomment-4545676598 when we decide to use TSgo v7
		dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
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
