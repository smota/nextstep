# Architecture

Nextstep has four boundaries:

1. **Application root** — this repository: React/Vite client, Express server, tests, and product skills.
2. **Data root** — private durable project artifacts such as candidatures, Master documents, coordination records, and audit logs.
3. **State root** — disposable indexes plus private settings, runs, intakes, receipts, journals, and migration state.
4. **Holoself** — optional external context dependency. A project-local metadata link belongs to the private data project; canonical personal context remains in its own Holoself root.

The server is the only mutation authority. Client requests never supply filesystem targets. Every durable mutation is mapped to a registered artifact, canonically contained, locked, journaled, validated, and audited.

Holoself is not vendored. Agent context may be available through the installed skill and `AFD_HOLOSELF_ROOT`; structured application operations use a configured CLI executable. Nextstep must degrade safely if either integration is unavailable.

