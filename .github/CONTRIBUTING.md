# Contributing

Thanks for your interest in `expo-cloudflared`! Bug reports, docs fixes, and pull
requests are all welcome. This guide covers the repo layout, the local dev loop,
and how releases work.

User-facing docs live in [`package/README.md`](../package/README.md) — that's the
file published to npm, so keep it in sync whenever you change behaviour, CLI
flags, or env vars.

## Repo layout

This is a Yarn (v4) workspace monorepo:

- [`package/`](../package/) — the `expo-cloudflared` library that gets published to npm.
- [`test/`](../test/) — unit tests (node:test) that run against the built package via `workspace:*`.
- [`test/demo-app/`](../test/demo-app/) — Expo SDK 57 app wired to the local build (`"@expo/ngrok": "portal:../../package"`) for end-to-end testing of `expo start --tunnel`.

## Development

```sh
yarn install
yarn dev              # watch-build the package

# Build and test
yarn build
yarn test             # build + run all unit tests (also runs on pre-push)
yarn test:only        # re-run tests without rebuilding

# End-to-end via the demo app
yarn demo:tunnel      # build, then `expo start --tunnel` in test/demo-app
yarn demo:tunnel:dev  # watch-build + expo start concurrently
```

> After rebuilding the package, restart `expo start` — Expo CLI caches the
> resolved tunnel module per process.

See [`test/README.md`](../test/README.md) for the manual e2e checklist
(quick tunnels, named tunnels, crash recovery, …).

## Code style

Formatting and linting are handled by [Biome](https://biomejs.dev/), enforced by
[lefthook](https://github.com/evilmartians/lefthook) git hooks:

- **pre-commit** — `biome check --write` on staged files (fixes are re-staged).
- **pre-push** — `yarn test`.

Run `yarn lefthook install` once after cloning so the hooks are active.

## Pull requests

- All submissions, including those from project members, go through a GitHub pull
  request review. See [GitHub Help](https://help.github.com/articles/about-pull-requests/)
  if you're new to PRs.
- Add a changeset for any user-visible change (see below).
- Update [`package/README.md`](../package/README.md) when behaviour changes.

## Releasing

Versioning and publishing are handled by [Changesets](https://github.com/changesets/changesets)
with npm **trusted publishing** (OIDC) — no npm token required.

```sh
yarn bump       # add a changeset describing your change
```

On merge to `main`, the [Release workflow](./workflows/changeset-publish.yml)
opens a "Version Packages" PR; merging that PR publishes to npm.

> **First-time setup:** on npmjs.com, configure this package's trusted publisher
> to point at `stacknide/expo-cloudflared` / `.github/workflows/changeset-publish.yml`.

⚠️ **Never publish a 5.x major.** Expo CLI only accepts an `@expo/ngrok`
replacement whose version satisfies `^4.1.0` — breaking changes ship as 4.x
minors. Enforced by `test/api.test.mjs` (pre-push) and
`package/scripts/assert-ngrok-range.mjs` (prepublishOnly).

## Community guidelines

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/)
as its Code of Conduct, and we expect all participants to adhere to it.
