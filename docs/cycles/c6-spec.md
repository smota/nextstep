# C6-S — `pipeline status`: projeção de portfólio somente leitura

| Campo | Valor |
|---|---|
| Ciclo | C-6 |
| Entrada | C5 |
| Estado | Aprovada e implementada |

Todo comando existente (`readiness --subject`, `application-attempt submission-plan --id`) é escopado a um único assunto. Duas revisões independentes de coaching (executivo e recrutamento) sobre o produto convergiram, sem combinação prévia, na mesma lacuna: uma busca executiva real com 15-30 candidaturas paralelas não tem nenhuma visão agregada do portfólio — nem contagem por estágio, nem sinal de quais candidaturas ficaram silenciosas. `pipeline status` fecha essa lacuna como uma projeção `advisory`, sem lock e sem mutação, seguindo exatamente o padrão de três arquivos (`commands.mjs` + `cli.mjs` + `command-catalog.mjs`) que todo outro comando de leitura já usa.

O desenho passou por uma revisão de arquitetura e não-funcionais (Grok, `--permission-mode plan`, somente leitura) que corrigiu a reivindicação de complexidade original e forçou decisões que o rascunho inicial deixava implícitas — ver "Decisões fechadas" abaixo.

## Decisões fechadas nesta proposta

- **Escopo por `interaction_ids`, não por filtro repetido.** `opportunity.interaction_ids`/`attempt.interaction_ids` (mantidos por `rebuildBacklinks`) já atribuem corretamente interações somente-de-tentativa à oportunidade-mãe via `interactionTouchesOpportunity`. O agregador faz um único mapa `id -> interaction` e caminha os `interaction_ids` de cada assunto — custo `O(interações + oportunidades + tentativas)`, sem cópia do padrão de `latestDecision` (que é `O((O+A)·I)` e ignora interações somente-de-tentativa).
- **Relógio injetado.** `pipelineStatus(paths, { staleAfterDays = 14, now = () => new Date().toISOString() })`. `generatedAt = now()`; todo cálculo de dias deriva desse único valor (diferença de dia-calendário UTC, nunca métodos de data local).
- **Política de "nunca confirmado" fixada.** Assunto sem interação confirmada: `lastConfirmedAt: null`, `daysSinceLastConfirmed: null`, `stale: false`. "Nunca tocado" e "foi tocado e esfriou" são falhas diferentes; não podem colapsar em um único booleano.
- **Contradição prosa/JSON resolvida a favor da lista compacta.** A saída inclui um array `subjects` (id, tipo, `opportunityId` quando aplicável, status, `lastConfirmedAt`, `lastConfirmedInteractionId`, `daysSinceLastConfirmed`, `stale`), ordenado por `daysSinceLastConfirmed` decrescente (nulos por último) e depois `id` — ordem documentada e testada, não implícita.
- **Rollup ativo/fechado separado.** `byStatus` para oportunidades e tentativas é dividido em `activeTotal`/`closedTotal` + mapas por status; histórico fechado (rejeitado/retirado/não perseguido) não deve afogar o formato do pipeline vivo.
- **`status` permanece `'ok'` sempre.** `'degraded'` é vocabulário reservado a `doctor`/integração (saúde de instalação); staleness não é uma falha de saúde.
- **`evidenceBoundary: 'confirmed-events-only'`** — reaproveita exatamente a string já usada por `evaluateStrategy`/`evaluateExperiment`.
- **Concorrência documentada, não ignorada.** Sem lock (leitura, como `readiness`/`get`), mas o invariante do catálogo declara explicitamente que a leitura pode observar um estado parcial (torn read) durante uma mutação concorrente com escritas sequenciais por arquivo — mesmo contrato implícito que `readiness` já aceita, agora dito em voz alta.
- **Validação de `--stale-after-days` espelha `run list`:** `Number.isInteger(value) && value >= 0`, senão `INVALID_COMMAND`. `0` é um valor válido.

## Matriz obrigatória

- interação com `evidence_state: 'planned'` nunca conta para staleness;
- `occurred_at` somente-data (`temporal_precision: 'date'`) misturado com datetime no mesmo assunto usa diferença de dia-calendário UTC, não comparação léxica;
- interação somente-de-tentativa envelhece a oportunidade-mãe via `opportunity.interaction_ids`;
- outreach somente-pessoa/empresa (sem `opportunity_id`/`application_attempt_id`) não envelhece uma oportunidade não relacionada;
- assuntos fechados (rejeitado/retirado/não perseguido/closed) aparecem em `closedByStatus`, nunca em `stale: true`, independente da idade;
- assunto nunca confirmado: `daysSinceLastConfirmed: null`, `stale: false`;
- fronteira do limiar: `daysSinceLastConfirmed === staleAfterDays` não é stale; só `>`;
- `occurred_at` no futuro não produz dias negativos;
- `--stale-after-days` não inteiro ou negativo retorna `INVALID_COMMAND`; `0` é aceito;
- nenhum lock, nenhuma escrita em `.nextstep/`, nenhuma entrada de ledger (mesmo padrão de asserção já usado para `readiness`);
- listagem dupla: oportunidade e sua tentativa aparecem separadamente em `subjects`, com `opportunityId` presente na linha da tentativa;
- ordem de `subjects` (dias decrescente, nulos por último, depois `id`) testada explicitamente;
- catálogo, `ROUTES` e `capabilities().commands` incluem `'pipeline status'`; texto de `help()` também atualizado (não coberto pelo teste existente de contrato catálogo↔rotas);
- suíte completa (`npm test`) e `command describe --command "pipeline status" --json` retornam um contrato válido.

Todos os casos usam fixtures sintéticas, seguindo o padrão de `test/cli.test.mjs`. C6 não acessa a instância privada. A implementação só começa após aprovação desta proposta.
