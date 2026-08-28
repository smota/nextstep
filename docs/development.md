# Development

Use Node.js 20+ and npm with the committed lockfile. Configure a synthetic external data root for development and tests; never use private production data in CI.

Commands:

```text
npm test
npm run dev
npm start
```

There is no frontend build. `npm run dev` watches only the backend.

Before committing, search tracked files for credentials, absolute personal paths, context packets, `.env` files, and runtime state. Running tests or the service must not change tracked files.

Use `npm run skills:install` to restore project-local third-party skills from `skills-lock.json`. Do not commit generated copies. Tests exercising actions must create synthetic external skill and data fixtures.

Changes to vault writes, containment, transactions, locks, startup recovery, public DTOs, or Holoself integration require explicit security-focused review.
