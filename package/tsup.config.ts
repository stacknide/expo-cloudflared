import { defineConfig } from 'tsup'

export default defineConfig((options) => {
	const isDev = process.env.NODE_ENV === 'development'
	console.debug('isDev:', isDev, 'options.env:', options.env)
	return {
		clean: isDev,
		dts: true,
		entry: {
			index: 'src/index.ts',
			// Add more entry points here to expose extra subpaths, e.g.
			//   utils: 'src/utils.ts',
			// then mirror them under `exports` in package.json.
		},
		format: ['cjs', 'esm'], // Output formats
		minify: !isDev,
		sourcemap: isDev,
		watch: isDev,
	}
})
