/**
 * Example API — replace this with your package's real implementation.
 *
 * The build (tsup) emits ESM + CJS + `.d.ts` types for everything exported
 * from this file. Add more entry points in `tsup.config.ts` and `exports`
 * in `package.json` if you want to expose additional subpaths.
 *
 * @param name - Who to greet.
 * @returns A friendly greeting.
 *
 * @example
 * greet("world") // → "Hello, world!"
 */
export const greet = (name: string): string => `Hello, ${name}!`

/**
 * Adds two numbers. Another throwaway example — delete it.
 *
 * @example
 * add(2, 3) // → 5
 */
export const add = (a: number, b: number): number => a + b
