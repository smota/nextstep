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
NEXTSTEP_SKILLS_ROOT=C:\optional\path\to\compatible-skills
HOLOSELF_EXECUTABLE=C:\path\to\holoself\bin\holoself.mjs
```

`NEXTSTEP_DATA_ROOT` is required and must be outside this repository. `NEXTSTEP_STATE_ROOT` defaults to `.nextstep` inside the data root. Skills are project-local generated dependencies under `.agents/skills`; install the locked upstream set with `npm run skills:install`. `NEXTSTEP_SKILLS_ROOT` optionally selects another compatible collection without changing Nextstep. AI actions remain unavailable when their required skill is absent. Holoself is optional; core vault features remain available without it.

Nextstep also owns three complete product skills: `application-pipeline-manager`, `company-profile-research`, and `people-profile-research`. They are versioned with the product; installed ResumeSkills dependencies are not.

## Develop and test

```text
npm install
npm run skills:install
npm test
npm run build
npm run dev
```

The server binds to `127.0.0.1` by default. See `docs/development.md`, `docs/architecture.md`, and `docs/data-layout.md`.

## Privacy

Never copy a real Nextstep or Holoself data root into this repository. Tests and examples must use synthetic fixtures. See `SECURITY.md`.

## License

MIT
