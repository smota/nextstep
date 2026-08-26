# Nextstep engineering contract

- Preserve the separation between application code, private data, runtime state, and Holoself canonical context.
- Never commit real career records, Holoself data, credentials, absolute personal paths, generated indexes, runs, or transaction journals.
- Use npm and the committed lockfile. Do not install dependencies globally.
- All vault mutations must use the existing lock, transaction, validation, and audit mechanisms.
- Holoself is an external dependency. Do not vendor or modify Holoself or its canonical personal data from this repository.
- Use synthetic fixtures for tests and fail closed on invalid paths, privacy metadata, or external-tool output.

