# Maintaining the Hebri setup guide

The guide reuses the production desktop provider overlay. It does not enable the experimental model-driven guest onboarding, change provider/account policy, or import Lab features.

## Content ownership

- `apps/desktop/src/components/onboarding/getting-started.tsx`: four deterministic pages and replay dialog.
- `apps/desktop/src/store/getting-started.ts`: installation-wide seen preference. Existing configured/skipped installations are not forced through the new introduction.
- `apps/desktop/src/i18n/getting-started-copy.ts`: all ten registered locales. Screenshots are English examples, explicitly identified in each translation.
- `apps/desktop/public/getting-started/`: actual desktop screenshots shared by the bundled guide and these docs.
- `README.md` and `README.it.md` in this directory: English and Italian user instructions.

Retain the existing provider picker, credential validation, OAuth polling and profile routing. Dismissal only records a presentation preference. It never selects a provider, enables sharing, changes permissions or submits an agent task. Existing `hermes_*` compatibility keys and modules remain intact.

## Reproduce screenshots and validate

Install repository dependencies normally. From `apps/desktop`, build the renderer with `vite build`, then `node scripts/bundle-electron-main.mjs --dev`. Vite clears the output directory, so bundle Electron **after** Vite.

From the repository root:

```text
node scripts/desktop-getting-started-smoke.mjs /absolute/path/to/python --capture
```

Use a Python environment with Hebri's dependencies. The script uses this checkout as `PYTHONPATH` and the source backend root. It creates a disposable OS-temp profile, overrides desktop/agent/auth/config homes, and inherits only OS plumbing. It does not copy credentials or invoke inference, pairing or updates. The backend may fetch its ordinary public catalog/update metadata. The app must never use a production profile for screenshots.

Inspect all four generated screenshots for readability and private data. The script takes them through the real renderer against a fresh backend, with device sharing off. It also tests first-run navigation, manual replay, small-window navigation, settings links and persisted dismissal. Artifacts/failure screenshots stay in its printed temp directory.

Rebuild after capture to include the new images. Run the same command **without `--capture`** to verify the bundled images load and repeat the interaction checks. Do not refresh screenshots merely to hide an error state; fix or accurately document it first.

Focused UI regression tests, from `apps/desktop`:

```text
npx vitest run src/components/onboarding/getting-started.test.tsx src/components/onboarding/index.test.tsx src/store/onboarding.test.ts --project ui
npx tsc -p . --noEmit
```

The desktop smoke test exercises the local platform. Windows screenshots and this rehearsal do not qualify macOS/Linux packaging, a real API key, GPU runtime, or a two-computer connection. Those retain their existing release checks.

## Upstream provenance

Consulted the official [Hermes desktop guide](https://hermes-agent.nousresearch.com/docs/user-guide/desktop) for the shared concepts: native desktop, the same underlying agent, provider setup and skipping setup. User instructions here are original, checked against this Hebri branch. Do not copy newer upstream features or Nous-specific account defaults into Hebri's documentation. Preserve the repository MIT license and copyright attribution.

Hebri-specific additions cover Synapsek, Bits, embedded-browser permissions, local/remote device pairing and desktop updates. Local Lab verification contracts and its Kanban experiments are intentionally outside this production guide.
