# Contributing

## Getting started

```bash
git clone https://github.com/smota/nextstep.git
cd nextstep
npm install
npm test
```

No external data root is needed to build, test, or explore the CLI's discovery commands
(`capabilities`, `command describe`, `workflow templates`, `strategy definitions`) — see the
README's quickstart. Only `doctor` and commands that need real records require pointing
`--data-root`/`NEXTSTEP_DATA_ROOT` at your own vault, which you should never commit.

`docs/cli.md` is the authoritative command reference; `docs/architecture.md` explains the four
boundaries (product, private vault, disposable state, Holoself). Read `AGENTS.md` before changing
anything — it's the binding engineering contract this codebase follows.

## Making a change

1. Keep unrelated user changes intact.
2. Use the committed lockfile and project-isolated runtime.
3. Add behavior-focused synthetic tests (see `test/cli.test.mjs`'s `fixture()`/`pipelineFixture()`
   helpers for the pattern — temp directories, never a real vault).
4. Run `npm test` and the CLI smoke commands you touched.
5. Confirm no private data, personal paths, credentials, context packets, or runtime state are
   tracked (`git status` before committing; `.gitignore` already excludes the common cases).

Changes to containment, transactions, locks, artifact snapshots, or Holoself integration require
focused security review — flag this explicitly in your PR description.

## Opening a pull request

Describe what changed and why, and how you tested it (`npm test` output is enough for most
changes). Small, focused PRs are easier to review than large ones. There's no formal issue
template yet — a clear PR description is enough.
