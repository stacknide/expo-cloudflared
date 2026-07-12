# expo-cloudflared

[![npm](https://img.shields.io/npm/v/expo-cloudflared.svg)](https://www.npmjs.com/package/expo-cloudflared)
![TypeScript](https://img.shields.io/badge/typescript-first-brightgreen.svg)

Cloudflare Tunnel for Expo — a drop-in replacement for `@expo/ngrok`.
Powers `expo start --tunnel` using [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) instead of ngrok.

- **No ngrok account, no authtoken, no rate limits** — quick tunnels are free with no sign-up.
- **No postinstall delay** — the cloudflared binary downloads lazily on the first tunnel start, so `yarn install` stays fast.
- **Stable URLs (named tunnels)** — opt in with two env vars in `.env.local` if you own a domain on Cloudflare.

---

## How it works

Expo CLI's `--tunnel` flag looks for `@expo/ngrok` in your project's `node_modules`.
`expo-cloudflared` uses your package manager's **override / alias** feature to install
itself *at the path* `node_modules/@expo/ngrok`. Expo CLI finds it there, calls
`connect()` and `kill()` — which this package implements with the same API shape —
and gets a Cloudflare Tunnel URL back. Expo CLI never knows it isn't ngrok.

You do **not** need to install `@expo/ngrok` at all. If it's installed globally, the
local override takes priority.

---

## Setup for `expo start --tunnel`

Pick your package manager:

### npm / bun

```json
{
  "dependencies": {
    "expo-cloudflared": "^4.2.0"
  },
  "overrides": {
    "@expo/ngrok": "npm:expo-cloudflared@^4.2.0"
  }
}
```

```bash
npm install        # or: bun install
npx expo start --tunnel
```

### yarn (v1 classic and v2+)

```json
{
  "dependencies": {
    "expo-cloudflared": "^4.2.0"
  },
  "resolutions": {
    "@expo/ngrok": "npm:expo-cloudflared@^4.2.0"
  }
}
```

```bash
yarn install
yarn expo start --tunnel
```

### pnpm

```json
{
  "dependencies": {
    "expo-cloudflared": "^4.2.0"
  },
  "pnpm": {
    "overrides": {
      "@expo/ngrok": "npm:expo-cloudflared@^4.2.0"
    }
  }
}
```

```bash
pnpm install
pnpm expo start --tunnel
```

That's it — `expo start --tunnel` now prints an `https://xxxx.trycloudflare.com` URL.

---

## Stable URLs with named tunnels

Quick tunnels get a random URL each session. If you own a domain on Cloudflare
(free plan is fine), a **named tunnel** gives you the same URL every time — great
for OAuth callbacks, webhooks, or sharing a dev build with teammates.

One-time setup:

```bash
npx expo-cloudflared setup
```

The wizard logs you into Cloudflare, creates the tunnel, routes a DNS hostname,
and prints the two env vars to put in your Expo project's `.env.local`:

```sh
CLOUDFLARED_TUNNEL_NAME=my-expo-tunnel
CLOUDFLARED_TUNNEL_HOSTNAME=dev.yourdomain.com
```

Expo CLI loads `.env.local` automatically — the next `expo start --tunnel` serves
your dev server at `https://dev.yourdomain.com`, with **zero code changes**.

### Env vars reference

| Variable | Effect |
| --- | --- |
| `CLOUDFLARED_TUNNEL_NAME` | Run this named tunnel (**name mode** — needs the one-time `setup`/`cloudflared tunnel login`). Routes to the actual dev-server port automatically. |
| `CLOUDFLARED_TUNNEL_HOSTNAME` | The public hostname to report as the tunnel URL (e.g. `dev.yourdomain.com`). |
| `CLOUDFLARED_TUNNEL_TOKEN` | Run a dashboard-managed tunnel by token (**token mode**). Ingress is fixed in the Cloudflare dashboard — prefer name mode for Expo, where the port can change. |
| `CLOUDFLARED_VERSION` | Pin the cloudflared binary release to download. Pinned versions are cached side by side, so projects pinning different versions never conflict. |
| `CLOUDFLARED_BIN` | Use an existing cloudflared binary at this path instead of downloading. |

Precedence: explicit `connect()` options → `CLOUDFLARED_TUNNEL_NAME` → `CLOUDFLARED_TUNNEL_TOKEN` → quick tunnel.

### Where the binary lives

The cloudflared binary (~40 MB) is cached **once per device** in Expo's
user-level settings directory — `~/.expo/expo-cloudflared/` — not inside
`node_modules`. Every project on the machine shares it, and it survives
`node_modules` wipes, `rm -rf .expo`, and fresh installs. Pinned versions get
version-suffixed filenames (`cloudflared-2026.5.0`) alongside the shared
unpinned one.

---

## Direct usage (without Expo CLI)

```javascript
const cloudflared = require('expo-cloudflared')

// Quick tunnel — no Cloudflare account needed
const url = await cloudflared.connect(8081)
// https://xxxx.trycloudflare.com

// With options
const url2 = await cloudflared.connect({
  addr: 8081,
  proto: 'http',
  onStatusChange: (status) => console.log('Tunnel:', status), // "connected" | "closed"
  onLogEvent: (line) => console.log('[cf]', line),
})

// Named tunnel — stable URL
const url3 = await cloudflared.connect({
  tunnelName: 'my-expo-tunnel',
  hostname: 'dev.yourdomain.com',
})

// Named tunnel via dashboard token
const url4 = await cloudflared.connect({ token: process.env.CLOUDFLARED_TUNNEL_TOKEN })

await cloudflared.kill()
```

---

## CLI

```text
npx expo-cloudflared <command>

Commands:
  install                  Download the cloudflared binary (happens lazily on first tunnel otherwise)
  version                  Print the installed cloudflared version
  setup                    Guided named-tunnel setup (login → create → route DNS → env vars)
  tunnel [port]            Start a quick tunnel on [port] (default: 3000)
  tunnel --token <token>   Start a token-based named tunnel
  tunnel [port] --name <name> [--hostname <host>]
                           Start a locally-managed named tunnel
```

---

## API Reference

### `connect(options?)`

Returns `Promise<string>` — the public HTTPS URL.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `addr` | `number \| string` | `3000` | Local port or address to expose |
| `port` | `number` | — | Alias for `addr` (used by Expo CLI internally) |
| `proto` | `"http" \| "https" \| "tcp" \| "ssh"` | `"http"` | Protocol of the local service |
| `token` | `string` | — | Cloudflare Tunnel token (token mode) |
| `tunnelName` | `string` | — | Named tunnel to run (name mode) |
| `hostname` | `string` | — | Public hostname reported as the URL (named modes) |
| `logLevel` | `"debug" \| "info" \| "warn" \| "error" \| "fatal"` | — | cloudflared log verbosity |
| `metricsUrl` | `string` | auto | cloudflared metrics server URL (passed as `--metrics`) |
| `startTimeoutMs` | `number` | `30000` | How long to wait for the tunnel URL |
| `onLogEvent` | `(line: string) => void` | — | Called for every cloudflared log line |
| `onStatusChange` | `(status) => void` | — | `"connected"` \| `"closed"` (closed only fires on unexpected crashes) |

`@expo/ngrok` fields that don't apply to Cloudflare Tunnel are **accepted but ignored**:
`authtoken`, `configPath`, `subdomain`, `region` (and Expo's `*.exp.direct` hostname).

### Other exports

| Export | Description |
| --- | --- |
| `disconnect(url?)` / `kill()` | Stop the tunnel (the `url` arg is ngrok-compat, ignored) |
| `getUrl()` | Active public URL, or `null` |
| `getVersion()` | Installed cloudflared binary version string |
| `getActiveProcess()` | The cloudflared `ChildProcess`, or `null` |
| `getApi()` | `CloudflaredClient` for the local metrics server (auto-discovered), or `null` |
| `ensureBinary(options?)` / `isInstalled()` | Manage the binary programmatically |
| `authtoken()` | No-op ngrok-compat stub |
| `CloudflaredError` | Error class with a `code` (e.g. `ERR_CERT_MISSING`, `ERR_NO_HOSTNAME`) |

```javascript
const api = cloudflared.getApi()
await api.healthcheck() // boolean
await api.ready()       // boolean
await api.getMetrics()  // Prometheus-format string
```

---

## Two tunnel modes

|                             | Quick Tunnel                     | Named Tunnel                           |
|-----------------------------|----------------------------------|----------------------------------------|
| Cloudflare account required | No                               | Yes (free) + a domain                  |
| URL stability               | Random each session              | Permanent                              |
| Setup                       | None                             | One-time `npx expo-cloudflared setup`  |
| How to use with Expo        | `expo start --tunnel`            | + two env vars in `.env.local`         |
| Example URL                 | `https://xxxx.trycloudflare.com` | `https://dev.yourdomain.com`           |

---

## Versioning

Expo CLI only accepts an `@expo/ngrok` replacement whose version satisfies
`^4.1.0`. This package therefore stays on **4.x forever** — breaking changes
ship as minor bumps within 4.x, never as a 5.0.0.

## Requirements

Node.js ≥ 18.17. macOS (x64/arm64), Linux (x64/arm64/arm), Windows (x64/arm64).
