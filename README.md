# @stacknide/expo-cloudflared

Cloudflare Tunnel for Expo — a drop-in replacement for `@expo/ngrok`. Powers `expo start --tunnel` using Cloudflare Tunnel instead of ngrok.

Read the [`package/README.md`](./package/README.md) for the published package docs.

## Repo layout

This is a Yarn (v4) workspace monorepo:

- [`package/`](./package/) — the library that gets published to npm.
- [`test/`](./test/) — runtime tests that import the built package via `workspace:*`.

## Development

```sh
yarn install
yarn dev        # watch-build the package

# Build and test
yarn build
yarn test
```

## Releasing

Versioning and publishing are handled by [Changesets](https://github.com/changesets/changesets)
with npm **trusted publishing** (OIDC) — no npm token required.

```sh
yarn bump       # add a changeset describing your change
```

On merge to `main`, the [Release workflow](./.github/workflows/changeset-publish.yml)
opens a "Version Packages" PR; merging that PR publishes to npm.

> **First-time setup:** on npmjs.com, configure this package's trusted publisher
> to point at `stacknide/expo-cloudflared` / `.github/workflows/changeset-publish.yml`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
