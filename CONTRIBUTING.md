# Contributing

Thanks for taking the time.

## Setup

```bash
npm ci
npm run test:watch
```

Node 18+ is required for the toolchain. The published package targets browsers
(ES2020) and React 18/19.

## Checks

Everything CI runs, in order:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test -- --coverage
npm run build
npm run check:exports   # publint + are-the-types-wrong
npm run size            # bundle budget
```

## Playground

```bash
cd example && npm install && npm run dev
```

The example aliases the package to `src/`, so changes show up without a
rebuild. It is the place to reproduce anything involving real network
behaviour: toggle DevTools' offline mode, or block the probe URL under
Network → "Block request URL" while staying online — that is the
captive-portal case `navigator.onLine` cannot detect.

## Tests

`test/` runs under two Vitest projects:

- **dom** — jsdom. Everything except server rendering.
- **ssr** — real Node, no DOM globals. Files named `*.ssr.test.tsx`.

Some rules that exist because breaking them caused real bugs:

- `getSnapshot()` must return the **same reference** until something actually
  changes, and `getServerSnapshot()` must return a module constant. React 18
  throws and loops otherwise. There are tests for both — don't delete them.
- Guard the DOM with `readOnLine()` / `canUseDOM()` from `src/core/env.ts`.
  A bare `typeof navigator !== 'undefined'` is **not** sufficient: Node 21+
  defines `globalThis.navigator` without `onLine`.
- Every README example is executed in `test/readme.test.tsx`. If you change an
  example, change it there too.
- Probe tests inject `fetch` via `probe.fetch` and set `jitter: 0`. Never let a
  test make a real request.

## Releasing

We use [Changesets](https://github.com/changesets/changesets):

```bash
npx changeset          # describe the change and pick a bump
```

Merging to `master` opens a "Version Packages" PR. Merging *that* publishes to
npm with provenance.
