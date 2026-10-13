# src/next: the new UI

Written from scratch (2026-10). It shares nothing visual with the old UI (`src/ui`, `src/kit`, the components
and CSS under `src/screens`). It is opened with `?ui=next` (remembered on the device; `?ui=old` goes back).

## What it may use from the rest of the app (logic, never looks)

- data: `src/api/*` (runCommand, types, views.gen.ts), `src/state/*` (useSession, useScreen, store, useSync),
  `src/village/*` (the 3D engine and village data), `src/lib/*`, `src/support/*` (logic only)
- words: `t()` / `hasKey()` / `refusalText()` / `noticeText()` from `src/i18n`
- the data hooks in `src/ui/v6/hooks.ts` and the number helpers in `src/ui/v6/format.ts` (`fa`, `faNum`, `cashCompact`,
  `clock`), `money()` / `splitMoney()` / `formatNumber()` / `hms()` in `src/screens/native/kit/format.ts`,
  `actionLabel()` in `src/screens/village/wording.ts`, `parseText()` / `factsFor()` in `src/screens/basic`
- NEVER: any component or stylesheet from `src/ui`, `src/kit`, `src/screens/**` (`*.tsx` components, `*.css`)

## Parts (`ui.tsx`, styled in `next.css`)

`Page` (a screen: large title, optional `sub`, `art` icon, `end`), `Section`, `SectionLink`, `Card`, `Hero`,
`Tiles`/`Tile` (big 3D tiles, two a row; `three` for three), `Now` (something running, time left large),
`List`/`Rows`/`Row` (icon well or avatar, title, sub, end), `Stats`/`Stat`, `Strip` (three figures), `KV`, `Meter`,
`Steps`, `Chip`, `Button` (`primary` = the ONE orange per screen, `cyan`, `ghost`, `danger`, `text`), `Buttons`,
`Segmented` (tabs), `Pills` (filters), `Note`, `Empty`, `Loading`, `Sheet`, `Confirm`, `Icon` (amber 3D set,
`public/icons3d/amber/<name>.webp`), `hueOf`/`letterOf` (avatars). Add a part to `ui.tsx` + `next.css` only when
two screens need it; a screen's one-off layout goes in its own `<area>.css` with an `n-<area>-` prefix.

## Screens

An area is `screens/<area>/index.ts` exporting `{ server, local }` (see `registry.ts`): `server` keyed by the
`screen` name in a command's answer, `local` by a client-only name. The registry collects areas by itself.
A screen gets `{ response, loading, args }`; it navigates and runs actions with `useNav()`:
`run(cmd, args)`, `open(local, args)`, `act(action)` (asks first for danger/confirm and for input values),
`back()`, `reload()`. A server screen with no component is drawn by `screens/Generic.tsx`.

## Rules

- Persian first, RTL; digits through `fa`/`faNum`/`formatNumber`; money through `money()`.
- Show what the server sends; never invent a figure. A missing fact is not shown.
- One orange primary per screen. Touch targets >= 44 px. Real `<button>`s. Icon-only buttons get `aria-label`.
- New words: APPEND to `src/i18n/ui.src.txt` with `cat >> src/i18n/ui.src.txt <<'EOF'` (never rewrite the file),
  keys prefixed `n.<area>.`, then `python3 scripts/gen-i18n.py`.
- Check: `npx tsc -b`, then the screen in mock mode: `/v2/?mock=1&ui=next&open=<command>` or `open=local:<name>`.
