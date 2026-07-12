# @stacknide/expo-cloudflared

[![npm version](https://img.shields.io/npm/v/@stacknide/expo-cloudflared)](https://www.npmjs.com/package/@stacknide/expo-cloudflared)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@stacknide/expo-cloudflared)](https://bundlephobia.com/package/@stacknide/expo-cloudflared)
[![License](https://img.shields.io/npm/l/@stacknide/expo-cloudflared)](./LICENSE)

Cloudflare Tunnel for Expo — a drop-in replacement for `@expo/ngrok`. Powers `expo start --tunnel` using Cloudflare Tunnel instead of ngrok.

- Zero dependencies
- Full TypeScript support
- Tree-shakeable
- Ships ESM + CJS + type declarations

## Installation

```sh
npm install @stacknide/expo-cloudflared
# or
yarn add @stacknide/expo-cloudflared
# or
pnpm add @stacknide/expo-cloudflared
```

## Usage

```ts
import { greet, add } from '@stacknide/expo-cloudflared'

greet('world') // → "Hello, world!"
add(2, 3) // → 5
```

## API

### `greet(name)`

Returns a friendly greeting. Replace with your real API.

### `add(a, b)`

Adds two numbers. Replace with your real API.

---

> This package was scaffolded from a template. Replace the example API above
> with your real implementation, then update this README.
