# expo-cloudflared

Cloudflare Tunnel for Expo — a drop-in replacement for `@expo/ngrok`. Powers `expo start --tunnel` using Cloudflare Tunnel instead of ngrok.

- **Using the package?** Read [`package/README.md`](./package/README.md) — install, env vars, CLI, and API reference.
- **Working on the package?** Read [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) — repo layout, dev loop, tests, and the release process.

## Repo layout

This is a Yarn (v4) workspace monorepo:

- [`package/`](./package/) — the `expo-cloudflared` library that gets published to npm.
- [`test/`](./test/) — unit tests (node:test) that run against the built package via `workspace:*`.
- [`test/demo-app/`](./test/demo-app/) — Expo SDK 57 app wired to the local build for end-to-end testing of `expo start --tunnel`.

## Quick start (development)

```sh
yarn install
yarn dev     # watch-build the package
yarn test    # build + run all unit tests
```

See [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) for the full guide.

## License

[MIT](./LICENSE)
