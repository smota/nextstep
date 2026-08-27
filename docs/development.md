# Development

Use Node.js 20+ and npm with the committed lockfile. Configure a synthetic data root for development and tests; never use private production data in CI.

Commands:

```text
npm test
npm run build
npm run dev
npm start
```

Before committing, search tracked files for credentials, absolute personal paths, context packets, `.env` files, and runtime state. Running tests or the application must not change tracked files.

Run `npm run skills:install` to restore the project-local third-party skills from `skills-lock.json`. Do not commit the generated copies under `.agents/skills`. Tests that exercise action execution must create synthetic external skill fixtures. `NEXTSTEP_SKILLS_ROOT` can point development at another compatible collection.
