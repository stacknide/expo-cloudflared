# Tests

## Unit tests

```sh
yarn test        # from the repo root: builds the package, then runs node:test
yarn test:only   # skip the rebuild when dist/ is fresh
```

Suites (all import the **built** artifact — `expo-cloudflared` / `expo-cloudflared/internal`):

- `options.test.mjs` — option/env resolution matrix (modes, precedence, Expo's `*.exp.direct` hostname ignored, conflicts, metrics)
- `args.test.mjs` — exact cloudflared argv per mode (global flags between `tunnel` and `run`)
- `parser.test.mjs` — real captured cloudflared log lines + chunk-split line reassembly
- `tunnel.test.mjs` — TunnelManager lifecycle with a fake spawn (kill-while-pending, `closed` suppression on deliberate stop, crash emission, dedupe)
- `api.test.mjs` — the exact Expo CLI access pattern (`require()` + `.connect`/`.kill?.()`) and the **4.x version guardrail**

## Manual e2e checklist (demo-app)

The demo app installs the local build at `node_modules/@expo/ngrok` via
`"@expo/ngrok": "portal:../../package"`. Remember: restart `expo start` after
rebuilding the package (Expo caches the resolved module per process).

### Quick tunnel

1. `yarn demo:tunnel` (first run: watch the cloudflared binary download lazily — no postinstall).
2. Expo prints `Tunnel ready.` and a QR code; `[expo-cloudflared] Tunnel URL: https://*.trycloudflare.com` appears.
3. Open the app via the QR in Expo Go / dev-client over the tunnel.
4. `curl <tunnel-url>` returns the dev-server response.
5. Restart `expo start --tunnel` — no red "Tunnel connection has been closed" banner (Expo kills the tunnel before each attempt; we must not report that as `closed`).
6. `kill -9 $(pgrep -x cloudflared)` mid-session — Expo prints the closed error once; restarting works.
7. Ctrl-C Expo — `pgrep -x cloudflared` prints nothing (no orphans).

### Named tunnels (needs a Cloudflare account + domain)

1. `npx expo-cloudflared setup` — wizard: login → create → route dns → prints env vars.
2. Copy `.env.local.example` → `.env.local`, fill `CLOUDFLARED_TUNNEL_NAME` + `CLOUDFLARED_TUNNEL_HOSTNAME`; `yarn demo:tunnel` serves at `https://<hostname>` every session.
3. Token mode: set `CLOUDFLARED_TUNNEL_TOKEN` (+ hostname) instead; verify the dashboard ingress warning mentions the dev-server port.
4. Temporarily move `~/.cloudflared/cert.pem` away — name mode fails with the actionable `ERR_CERT_MISSING` message.

### Failure modes

1. Offline first run (no binary cached): `connect()` fails with `ERR_BINARY_INSTALL` pointing at `npx expo-cloudflared install`.
2. Offline with binary cached: quick tunnel fails with `ERR_TUNNEL_START` (cloudflared can't reach trycloudflare).

### CLI

1. `npx expo-cloudflared install | version | tunnel 8081 | setup` all work from `test/demo-app`.
