# NXT-PLAN-001 — auditoria de conclusão

Data: 2026-09-24. Candidato do produto: `5ad08d0b7511b293d36cf373dd6b8e89c12ae41dad65970f5409128a1647f1b1`. `bin/nextstep.mjs` permaneceu byte a byte no hash `d0f54c08cb4c0f1a545b6effbd37eed6622ae47246a3a8ed6fe3851a9780d5d0`.

Ambiente observado: Windows `10.0.26200.0`, Node `26.10.0`, Codex CLI `0.154.0`, Anti-Gravity CLI `1.2.10`, Nextstep `2.0.0`. Codex Desktop continua uma combinação distinta e não herda o aceite do CLI.

## Rastreabilidade

| Requisito | Aceite | Evidência atual | Estado |
|---|---|---|---|
| R-01 links sem cópia | AC-01 | C1-01..14; launcher e skills são junctions para uma única árvore; rename/edição na fonte observados pelo mesmo link | passed |
| R-02 resolução em processo novo e subdiretório | AC-02 | C2-01..05 e C2-14; P-1 executado de `Candidatures/` resolveu `origin: marker`, PATH persistido e `healthy: true` | passed |
| R-03 cinco skills sem duplicata por host | AC-03 | C3-TR/CX, C4-TR/LK, quick validation; Codex CLI, Anti-Gravity e Codex Desktop listaram exatamente as cinco `nxt-*` e ativaram `nxt-context` | passed |
| R-04 configuração durável | AC-04 | `nextstep.yaml`, registro no perfil e C2-03..05/13/16; runtime descartável reconstruído sem perder configuração | passed |
| R-05 diagnóstico separado | AC-05 | C2-08/12 e C5; executable, PATH, links/skills gerenciadas, produto, instância, dados, Holoself e recovery têm estados próprios | passed |
| R-06 motor como autoridade de mutação | AC-06 | suíte de domínio cobre pacote, idempotência, revisão concorrente e snapshots; handoff C3 registrou pela CLI pública e releu no segundo host | passed |
| R-07 manutenção segura | AC-07 | C1/C2/C3/C5 cobrem relink, conflito, drift, broken source, journals, locks, PATH, rollback e unlink com canários | passed |
| R-08 equivalência entre hosts | AC-08 | handoff sintético Codex CLI → Anti-Gravity preservou IDs/revisões/hashes; smokes reais P-1 nesses hosts e no Codex Desktop | passed; resolução nominal Desktop ainda pendente em R-02/P1-G |
| R-09 privacidade e Holoself externo | AC-09 | fixtures sintéticas nos ciclos; P-1 somente leitura; três links Holoself preservados; 11 hashes privados de controle idênticos | passed |
| R-10 leitura e eventos delimitados | AC-10 | testes de análise sem gravação, draft sem evento, networking sem ApplicationAttempt e estratégia opcional; skills mantêm essas fronteiras | passed |

## Gates

| Gate | Evidência | Estado |
|---|---|---|
| C0-G | baseline B01..B10, QA e revisão registradas | passed |
| C1-G | `c1-execution.md`, C1-01..14 e revisão independente | passed |
| C2-G | `c2-execution.md`, C2-01..16 aplicáveis e probes de host | passed |
| C3-G | C3-A aprovada, C3-TR/CX, smokes 2 × 2, negativos e handoff real | passed |
| C4-G | cinco skills, smokes das três novas, negativos e regressão | passed |
| C5-G | matriz adversarial, revisão externa e QA independente sem bloqueadores | passed |
| P1-G | instalação real por links, marker, PATH, doctor, subdiretório, hashes e três hosts; Desktop descobriu/ativou skills e validou pelo launcher absoluto | pending reinício do Desktop para provar resolução bare `nextstep` |

## Checks do candidato final

- `npm test`: 98 passed, 0 failed.
- `npm run check`: passed.
- `git diff --check`: passed; somente avisos informativos LF/CRLF.
- `doctor --integration` em processo novo e subdiretório real: `healthy: true`.
- `validate --scope structure`: `valid: true`.
- Revisão independente final do delta C5: PASS, sem bloqueadores.

## Diferenças permitidas em P-1

Foram criados apenas `nextstep.yaml`, junctions gerenciadas do launcher/skills/referências, metadados locais do perfil e o segmento próprio no PATH do usuário. `AGENTS.md`, registros de carreira e links Holoself existentes permaneceram inalterados. Junctions em OneDrive são locais a esta máquina.

## Evidência ainda necessária

Reiniciar o Codex Desktop para que o processo herde o PATH persistido e repetir o prompt original em uma nova tarefa na instância privada. O novo probe precisa resolver `nextstep` sem caminho absoluto; todos os demais oráculos Desktop já passaram.
