# Nextstep

Nextstep is a local-first career opportunity workspace. The application is public and shareable; private career records and runtime state live in a separate data directory.

## Requirements

- Node.js 20 or newer
- npm, using the committed `package-lock.json`
- A compatible private data root containing `Candidatures/`, `Master/`, and `.coordination/`

## Configure

Copy `.env.example` to a local `.env` or set the variables in the process environment:

```text
NEXTSTEP_DATA_ROOT=C:\path\to\private-nextstep-data
NEXTSTEP_STATE_ROOT=C:\path\to\private-nextstep-data\.nextstep
HOLOSELF_EXECUTABLE=C:\path\to\holoself\bin\holoself.mjs
```

`NEXTSTEP_DATA_ROOT` is required and must be outside this repository. `NEXTSTEP_STATE_ROOT` defaults to `.nextstep` inside the data root. Holoself is optional; core vault features remain available without it.

## Develop and test

```text
npm install
npm test
npm run build
npm run dev
```

The server binds to `127.0.0.1` by default. See `docs/development.md`, `docs/architecture.md`, and `docs/data-layout.md`.

## Privacy

Never copy a real Nextstep or Holoself data root into this repository. Tests and examples must use synthetic fixtures. See `SECURITY.md`.

## License

MIT

