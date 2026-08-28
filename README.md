# Nextstep

Nextstep is a local-first backend for governed career opportunity data. It exposes a loopback-only JSON API; private career records, runtime state, and canonical Holoself context remain outside this repository.

## Requirements

- Node.js 20 or newer
- npm, using the committed `package-lock.json`
- An external data root containing `Candidatures/`, `Master/`, and `.coordination/`

## Configure

Copy `.env.example` to an ignored local `.env` and set:

```text
NEXTSTEP_DATA_ROOT=C:\path\to\private-nextstep-data
```

`NEXTSTEP_DATA_ROOT` is required, absolute, and outside this repository. Runtime state defaults to `.nextstep` inside that data root. Skills default to `.agents/skills` in this repository. `NEXTSTEP_STATE_ROOT`, `NEXTSTEP_SKILLS_ROOT`, `PORT`, and `HOLOSELF_EXECUTABLE` are optional overrides. Process environment values take precedence over `.env`.

## Run and test

```text
npm install
npm run skills:install
npm test
npm run dev
npm start
```

The API binds to `127.0.0.1:5175` by default. All product routes are under `/api`; unknown routes return JSON with status 404. There is no bundled browser client or static-file server.

## Capabilities

The backend provides governed application, company, people, analytics, network, document, action, intake, runtime, skill, coordination, and Holoself-profile APIs. Durable mutations remain canonically contained, locked, journaled, validated, and audited.

Three complete product skills are versioned with Nextstep: `application-pipeline-manager`, `company-profile-research`, and `people-profile-research`. Third-party skill implementations are restored from `skills-lock.json` and are not committed.

## Privacy

Never copy a real Nextstep or Holoself data root into this repository. Tests and examples use synthetic fixtures. See `SECURITY.md`.

## License

MIT
