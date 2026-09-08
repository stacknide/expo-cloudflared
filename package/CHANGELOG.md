# expo-cloudflared

## 4.2.2

### Patch Changes

- ccb003b: Setup is now a single `@expo/ngrok` alias dependency that works identically on npm, yarn (v1 and Berry), pnpm, and bun — replacing the four per-package-manager recipes.

  The old recipe (`dependencies: expo-cloudflared` + `overrides`/`resolutions: @expo/ngrok`) never created `node_modules/@expo/ngrok` in a normal Expo app: those fields only rewrite an _existing_ dependency edge, and nothing depends on `@expo/ngrok` (Expo fetches it lazily at runtime). Expo therefore fell back to real ngrok. Declaring the alias as a direct dependency is what guarantees the path exists right after `install`. Also documents the monorepo case — the alias goes in the workspace you run `expo start` from — including the yarn-Berry gotcha that `resolutions` is honored only at the workspace root.

## 4.2.1

### Patch Changes

- 1cd3664: CLI / env docs corrections
