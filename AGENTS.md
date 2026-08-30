# AGENTS.md — React Native App (Expo SDK 54 + NativeWind)

## Stack

- **Expo SDK 54** (React Native 0.81, React 19.1)
- **NativeWind v4** (Tailwind CSS 3.x for React Native)
- **Expo Router v6** (file-based routing)
- **TypeScript**

## Commands

```bash
# Start dev server
npx expo start

# Start web
npx expo start --web

# Start for specific platform
npx expo start --android
npx expo start --ios
```

## Project Structure

- `app/` — Expo Router pages (file-based routing)
  - `_layout.tsx` — Root layout (imports `global.css`, wraps `<Stack>`)
  - `index.tsx` — Landing page
- `components/` — Reusable components
- `global.css` — Tailwind CSS imports (`@tailwind base/components/utilities`)
- `nativewind-env.d.ts` — NativeWind type definitions

## NativeWind Setup (Critical)

NativeWind v4 requires specific config files. All must be present:

1. **`metro.config.js`** — Uses `withNativeWind(config, { input: "./global.css" })`
2. **`babel.config.js`** — Uses `babel-preset-expo` with `jsxImportSource: "nativewind"` + `nativewind/babel` preset
3. **`tailwind.config.js`** — Must include `presets: [require("nativewind/preset")]` and scan `./app/**` + `./components/**`
4. **`global.css`** — Imported in root layout (`_layout.tsx`)
5. **`nativewind-env.d.ts`** — `/// <reference types="nativewind/types" />`

### NativeWind Usage

Use `className` prop (not `style`) for Tailwind classes:

```tsx
<View className="flex-1 items-center justify-center bg-white">
  <Text className="text-xl font-bold">Hello</Text>
</View>
```

## Known Gotchas

- **react-dom must match react version** — Both are pinned to `19.1.0` with npm overrides
- **New Architecture enabled** — `newArchEnabled: true` in `app.json`
- **Expo Router v6** — Entry point is `"main": "expo-router/entry"` in package.json
- If NativeWind classes don't apply, clear cache: `npx expo start --clear`
- **react-native-css-interop version conflict** — NativeWind v4.2.x bundles its own `react-native-css-interop@0.2.6`. Do NOT add `react-native-css-interop` as a separate dependency in `package.json` unless you pin it to the exact version NativeWind requires. A mismatch (e.g. `0.1.22`) causes styling to work on web but fail silently on native/mobile. If this happens:
  1. Run `npm ls react-native-css-interop` — you should see only one version
  2. If two versions appear, remove the explicit one from `package.json`
  3. Run `npm install` then `npx expo start --clear`
- The `.gitignore` excludes `node_modules/`, `.expo/`, `dist/`

## Tech Notes

- Node.js 22+ required (minimum for SDK 54 is 20.19.4)
- Minimum Xcode 16.1 for iOS builds
- Android edge-to-edge is enabled by default in SDK 54
- Reanimated v4 is bundled (no separate install needed beyond package.json)
