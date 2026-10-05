# Backlog: Holoself consolidation (nextstep)

Created 2026-10-03. Local working file: it contains personal paths, so keep it out of commits (see `AGENTS.md`). The flat product backlog stays in `docs/backlog.md`.

**Goal.** Nextstep reads Samuel's self through Holoself and keeps only its own domain: candidatures, CVs, letters, job-search guides. The product (`code\nextstep`) leaves lens choice to Holoself and indexes its own files itself. The private instance `WF\nextstep-sam` keeps only Nextstep data. This repo owns code changes here and the Holoself-related data changes in `WF\nextstep-sam`.

## Decisions (Samuel, 2026-10-03)

- **Q2** Lens choice lives in the self (`HS\lenses\bindings.json`, built in HS-3). Nextstep and `nextstep-sam\.holoself\link.yaml` carry no lens.
- **Q10** Lens `career` is renamed `professional` (HS-4/HS-6). Code here names no lens at all, so it survives the rename.
- **Q6** Nextstep stops indexing its own files through Holoself (`project_context.include` becomes empty). Holoself holds only the self; Nextstep does its own indexing.
- **Q5** Remove `WF\nextstep-sam\Master\Archive\pre-holoself-migration-2026-09-27\` once the migration is confirmed.
- **Q1** LinkedIn moves to Move the Needle (`WF\movetheneedle\channels\linkedin-personal`); the LinkedIn profile text leaves `nextstep-sam`.

## Cross-repo order

Three agents (holoself, nextstep, movetheneedle) start today in parallel. In each repo, the `-1` item (backup + baseline) runs before any data change in that repo.

| Start now (parallel) | Waits for |
|---|---|
| HS-1, HS-2, HS-3, HS-4, HS-5, HS-7, HS-9, HS-10 | HS-6 ← HS-3 + HS-4 + Samuel's release OK · HS-8 ← HS-7 · HS-11 ← every other item |
| NS-1, NS-2, NS-3, NS-6, NS-8, NS-10 | NS-4 ← HS-5 · NS-5 ← HS-6 · NS-7 ← HS-8 · NS-9 ← NS-8 + Samuel's confirmation |
| MTN-1, MTN-2, MTN-3, MTN-7 | MTN-4 ← HS-5 · MTN-5 ← MTN-4 · MTN-6 ← MTN-2 + MTN-5 · MTN-8 ← MTN-7 + Samuel's confirmation · MTN-9 ← HS-8 · MTN-10 ← HS-6 + MTN-4 |

The same table appears in all three backlogs: `C:\Users\samue\code\{holoself,nextstep,movetheneedle}\docs\backlog\2026-10-03-holoself-consolidation.md`.

## Paths

| Name | Path |
|---|---|
| `WF` | `C:\Users\samue\OneDrive\1._WorkingFolder` |
| `HS` (canonical self) | `WF\holoself-sam` |
| `BK` (backups, outside OneDrive) | `C:\Users\samue\backups\holoself-consolidation-2026-10-03\` |
| `RUN` (baselines, handoffs, reports) | `WF\grok-bot\work\admin-2026-10-03\holoself-consolidation\` |
| Source analysis (pt-BR, IDs L/K/C/P/Q) | `RUN\claude-report.md` |

## Rules

- **Code holds only the application.** Everything under `C:\Users\samue\code` is app code; data, links (`.holoself/`) and generated state live in the OneDrive data folders under `WF`.
- **Canonical self changes go through Holoself.** Use `holoself propose` (Samuel approves) or `holoself knowledge cleanup` (dry-run → plan → apply with `--digest`). Files outside the canonical Markdown (`scripts/`, `tmp/`, `output/`, `coaching/`) can be moved directly.
- **Zip-first.** Before any data move, edit or delete, write a dated zip of what you touch to `BK` (`<repo>-<item>-<yyyyMMdd-HHmm>.zip`) and check it opens. Data folders rely on OneDrive sync, so the zip is the only rollback (Q7: no git in data folders).
- **Samuel confirms every folder deletion** (named in the item). Prepare the evidence, then wait.
- **Verify every item.** Data items are done when V (below) is green; code items when the repo's tests pass. Record the result in `RUN\verification\<item>.txt`.
- Move files in short windows; if OneDrive shows a sync conflict, stop and report it.

### V (standard verification)

```powershell
$HS = 'C:\Users\samue\OneDrive\1._WorkingFolder\holoself-sam'
holoself lens validate --root $HS
holoself validate --root $HS
holoself link status --project <project>; holoself link doctor --project <project>
$c = holoself context --project <project> --self-only --json | ConvertFrom-Json
"$($c.lens) $($c.validation.status) $($c.self.documents.Count)"
```

Green: `validation.status` is `ok`, no `unknown lens` error, `link doctor` reports no `degraded`, and the self document count matches the item's baseline (or differs by exactly what the item removed).

## Items

### NS-1 Backup and baseline
- **Goal:** a restorable starting point.
- **Do:** zip `WF\nextstep-sam\.holoself` (skip `index\`, it is generated) and `WF\nextstep-sam\Master` to `BK`. Run V for `WF\nextstep-sam` and `npm test` in `code\nextstep`. Save the output to `RUN\baseline\ns\`.
- **Done when:** both zips open and list their files; the baseline output is saved.
- **Verify:** `RUN\baseline\ns\` holds the V output and the `npm test` log.
- **Depends on:** none.

### NS-2 Code: lens resolved by Holoself (L11, Q2)
- **Goal:** Holoself resolves the lens from the self; Nextstep calls `context --self-only` without `--lens`.
- **Do:** in `src/holoself.mjs:63` and `src/candidate-profile.mjs:48`, drop the `lens = 'career'` default and stop passing `--lens`. Keep `--self-only`. Surface the lens Holoself reports (`data.lens`) in the result, as today. Update tests (`test/cli.test.mjs` ~L704 fake output) and any doc that names a Holoself lens. Nextstep's own review lenses (`recruiter-scan`, `candidate`, `reader` in `src/review-evidence.mjs`) are a separate concept and stay.
- **Done when:** `rg -n "lens\s*=\s*'career'|--lens" src` is empty.
- **Verify:** `npm test`; a real profile command against `WF\nextstep-sam` returns the self context with lens `career` today (`professional` after HS-6).
- **Depends on:** none. Works today because Holoself falls back to the link's `default_lens`.

### NS-3 Data: absolute link path and stale backups (L7, L10)
- **Goal:** `nextstep-sam` links to the self like every other project.
- **Do:** in `WF\nextstep-sam\.holoself\link.yaml`, set `self_context.path` from `../holoself-sam` to `C:/Users/samue/OneDrive/1._WorkingFolder/holoself-sam`. Run `holoself link repair --project WF\nextstep-sam`. Zip-first delete `link.yaml.bak-20260902-path-migration` and `link.yaml.bak-windows-path`.
- **Done when:** `link status` shows the absolute path; no `link.yaml.bak-*` remains.
- **Verify:** V; the self document count and lens equal the NS-1 baseline.
- **Depends on:** NS-1.

### NS-4 Data: stop indexing Nextstep files through Holoself (Q6)
- **Goal:** the Holoself link carries only the self.
- **Do:** first confirm that Nextstep covers its own lookups for `Master/**` and `Candidatures/**` without the Holoself index (`rg -n "holoself" src`: only `context --self-only` should remain). Then set `project_context.include: []` in `link.yaml`, keeping `exclude`. Run `holoself link repair`. Zip-first delete the generated `.holoself\index\index.json` (13.7 MB) if repair does not regenerate it smaller.
- **Done when:** `link.yaml` has `include: []`; `holoself context --project WF\nextstep-sam --json` returns no project documents.
- **Verify:** V; `npm test`; a real profile command still works.
- **Depends on:** NS-3, HS-5 (`RUN\handoff\HS-5.md` confirms `include: []` is supported).

### NS-5 Data: lens leaves link.yaml (Q2)
- **Goal:** the lens for nextstep-sam is decided only in `HS\lenses\bindings.json`.
- **Do:** check `holoself lens bindings` lists `WF\nextstep-sam` → `professional`. Remove `default_lens`/`secondary_lenses` from `link.yaml` if `link repair` has not already. Run `holoself link repair`.
- **Done when:** `link.yaml` has no lens keys; V shows lens `professional`.
- **Verify:** V; `npm test`; a real profile command.
- **Depends on:** HS-6 (`RUN\handoff\HS-6.md`), NS-4.

### NS-6 Data: LinkedIn profile → Move the Needle (K11)
- **Goal:** the LinkedIn channel artifact lives in the LinkedIn domain.
- **Do:** run `rg -n "LinkedIn_Profile" WF\nextstep-sam` to find references. Move `WF\nextstep-sam\Master\Samuel_Guedes_Mota_LinkedIn_Profile.md` → `WF\movetheneedle\channels\linkedin-personal\Context\linkedin-profile.md`; stop and report if that target already exists. Repoint the references, or leave a one-line pointer file if a workflow reads the old path.
- **Done when:** the file exists only at the target.
- **Verify:** `rg -n "LinkedIn_Profile" WF\nextstep-sam` finds no live reference; V for nextstep-sam.
- **Depends on:** NS-1. MTN-7 writes to the same folder under other names.

### NS-7 Data: receive job-search content from holoself-sam (C3, C5, C8)
- **Goal:** job-search guides and career metrics that left the self land in Nextstep.
- **Do:** read `RUN\handoff\nextstep\MANIFEST.md`. Place each block in `WF\nextstep-sam\Master\`: merge into an existing guide when one covers the topic, otherwise create `Master\job-search-guide.md`. Drop empty templates.
- **Done when:** every manifest row is marked placed (with its path) or dropped (with a reason) in `RUN\handoff\nextstep\MANIFEST.md`.
- **Verify:** each "placed" path exists and contains its block; V for nextstep-sam.
- **Depends on:** HS-8.

### NS-8 Self knowledge from nextstep-sam (K7, K15)
- **Goal:** facts about Samuel live in the self; Nextstep keeps renderings.
- **Do:** compare `Master\Samuel_Guedes_Mota_Baseline_CV.md` with `HS\context\career.md` and `claims.md` using `holoself context --self-only` (read Holoself only through its CLI). Raise `holoself propose` for each missing fact. Check whether `.holoself\proposals\2026-08-28-career-materials-and-iam-evidence.md` was processed; if not, convert it to the proposal schema and propose it. Add a header to the CV marking it a rendering of Holoself facts.
- **Done when:** every fact gap is listed in `RUN\handoff\NS-8.md` with a proposal ID or "already in self"; Samuel has decided each proposal.
- **Verify:** `holoself proposals list` shows each listed ID; after approval, `context --self-only` contains the facts.
- **Depends on:** NS-1.

### NS-9 Data: remove the pre-migration archive (Q5)
- **Goal:** no duplicate personal knowledge (including compensation) in Nextstep.
- **Do:** for each file in `Master\Archive\pre-holoself-migration-2026-09-27\`, record in `RUN\handoff\NS-9.md` where its content now lives (`HS` path/ID or current `Master\` file). Ask Samuel to confirm. Then zip to `BK` (restricted content: keep the zip outside OneDrive) and delete the folder.
- **Done when:** Samuel has confirmed; the folder is gone; the zip opens.
- **Verify:** V; `rg -n "pre-holoself-migration" WF\nextstep-sam` returns only historical notes.
- **Depends on:** NS-8, Samuel's confirmation.

### NS-10 Docs: name review lenses "review perspectives" (optional)
- **Goal:** two meanings of "lens" no longer collide.
- **Do:** in user-facing docs, call Nextstep's review lenses (`recruiter-scan`, `candidate`, `reader`) "review perspectives". Schema and field names stay (`lenses` in review payloads).
- **Done when:** docs use the new term.
- **Verify:** `npm test`; `rg -n "review lens" docs` is empty.
- **Depends on:** none.

## Open questions for Samuel

Until he answers, the default in brackets applies.

1. Three LinkedIn folders exist in MTN data: `channels\linkedin-personal` (workspace and history), `knowledge\company\channels\linkedin-personal` (channel profile, editorial guidelines) and `knowledge\company\content\channels\linkedin-personal` (README only). Merge them? [Keep all three; strategy and structure files go to `channels\linkedin-personal\Context\`.]
2. Under Q10, does `private` stay an owner-exclusive special lens? [Yes.]
3. Does `public-voice` keep the public-safety filters `publishing` has today (compensation redaction, `publication_allowed`)? [Yes, as lens-definition properties.]
4. `WF\nextstep-sam\.holoself\proposals\` includes approved proposal 63110f2e with compensation data in plain text. Keep it? [Keep; it is the project-side proposal record.]
5. The grok-bot briefings (`WF\grok-bot\briefings\escritor.txt`, `linkedin.txt`) point to `linkedin-sam`. They sit outside these three repos: who repoints them before MTN-8? [Samuel or the grok-bot admin agent.]
6. Version number for the Holoself release that carries HS-3/HS-4, and who installs it globally? [Samuel approves; HS agent installs in HS-6.]

## Samuel's answers to the open questions (3 Oct 2026, 18:26) - these win over the defaults above

1. linkedin-personal: merge the three folders into one. linkedin-sam holds the most recent LinkedIn work and holoself-sam the most recent knowledge about Samuel; when versions conflict, prefer those.
2. Lens `private`: leave it as it is for now (the owner is always the operator).
3. Lens `public-voice`: keep it simple; do NOT carry over the publishing safety filters (compensation, publication_allowed). Refine later only when needed.
4. Compensation data may stay in the data folders (including proposal 63110f2e); security is handled by the machine and folder, not by Holoself. No special handling.
5. Bot briefings (grok-bot) that point to linkedin-sam: Miles updates them after MTN-8 is done and Samuel confirms. Not part of this backlog.
6. Holoself release: the next version, after the whole backlog runs in one go.
