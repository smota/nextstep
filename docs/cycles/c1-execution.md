# C1 — execução e gate

## Candidato aceito

- Base Git: `baae1363398b3ce668aea5a40659b5888a245a06`
- Manifesto SHA-256 dos 17 arquivos centrais segundo QA independente: `8dd5d5d49eba1e865e76e3eff2bd121792f7df94321efaf6546fa4f4cc7f8293`
- `src/integration.mjs`: `f8dfe1c557f681e6f6d3710e6e319f5adbcac7a1971f022c8c5009fa7c9b38fe`
- `test/integration.test.mjs`: `8bb40f5f1d90b776f535ef189bd74f8501a35a14a9dc25698861a6884af53842`
- `bin/nextstep.mjs` preservado: `D0F54C08CB4C0F1A545B6EFFBD37EED6622AE47246A3A8ED6FE3851A9780D5D0`

## Resultado

C1-R foi aprovado após uma rodada de correções. A QA independente encontrou e fez corrigir: remoção externa controlada por registro adulterado, escape por junction intermediária, unlink com drift físico, runtime validado depois da escrita, journal sem precondições e prioridade incorreta entre preflight e recuperação. O candidato final passou C1-01..14.

- `npm test`: 56/56 passed.
- `npm run check`: passed.
- `git diff --check`: passed, com avisos de normalização LF/CRLF.
- Probes adicionais: external junction preservada; escape rejeitado; drift bloqueia unlink; Node 19.9 não cria profile; journal registra precondições; `status` é somente leitura; `link_published` resulta em `INTEGRATION_RECOVERY_REQUIRED`.
- Dados privados, perfil real, PATH real, skills e ambientes de agente não foram acessados no C-1.

## Gate C1-G

`passed` em 2026-09-24. C-2 está liberado. O aceite vale para instalação vinculada sintética no Windows e Node 20+; não certifica ainda descoberta de skills ou integração pessoal.
