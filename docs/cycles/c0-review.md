# C0-R — revisão independente

Claude Sonnet 4.6 Thinking via Anti-Gravity CLI, duas sessões novas em 2026-09-19. Texto fornecido explicitamente, sem ferramentas e sem auditoria autônoma do código. Parecer inicial seguido por correções do coordenador e reavaliação antes de C0-D.

Especificação aprovada SHA-256: `8ea5faa9ccd0bbc243c6a546a07fa04e0598dbca3fbaa22dd413109359948bd7`.

Adjudicação CO: na observação não bloqueante sobre B04, Claude inverteu os rótulos. O contrato permanece: ambiente recebido aponta a `fixtureB`; argumento e seleção apontam a `fixtureA`. B08 mantém ID principal e observações identificadas de PATH e execução absoluta. A sugestão inicial de tratar divergência de exit64 como not_run foi rejeitada com evidência do código, e o parecer final aprovou essa correção.

## Parecer inicial
## Revisão C0-R — Decisão: `changes_required`

Três achados requerem correção antes da liberação do harness. Nenhum invalida a arquitetura geral; todos são endereçáveis sem redesenho.

---

| finding_id | severidade | requisito violado | problema identificado | correção exigida | teste de verificação |
|---|---|---|---|---|---|
| **F-01** | **Alta** | §4.2 isolamento + C0-B04 | B04 especifica `NEXTSTEP_DATA_ROOT=fixtureB` no ambiente do filho ao mesmo tempo que `--data-root <fixtureA>` no argv. O §4.2 item 3 ordena remoção de *todas* as variáveis `NEXTSTEP_*` antes de criar o filho, com adição apenas das explicitamente definidas pelo caso. B04 é um dos casos que define explicitamente `NEXTSTEP_DATA_ROOT`; isso é coerente. **O problema:** a spec não indica que o probe interno (import de `resolvePaths`) deve receber o mesmo ambiente controlado que o processo-filho CLI. Se o probe rodar no processo pai (sem limpeza de `NEXTSTEP_*`), o oráculo "argumento vence ambiente" pode ser satisfeito espuriamente por ausência de variável, não por precedência real. | Exigir que o probe de `resolvePaths` seja sempre executado como processo-filho separado com o mesmo environment snapshot explícito do caso; proibir import direto no processo do harness para casos B02–B06. | Evidência JSON de B04 deve registrar o environment snapshot exato passado ao probe; revisão confirma que `NEXTSTEP_DATA_ROOT` aparece no snapshot e o oráculo ainda passa. |
| **F-02** | **Média** | §5 C0-B07 + §4.1 saída estruturada | B07 especifica exit `64` e `error.code === USAGE` para comando inexistente. Exit code `64` é convencional (BSD `EX_USAGE`) mas não está documentado em nenhuma seção normativa da spec como contrato do produto. Se o produto retornar `1` ou outro código para comando desconhecido, B07 falhará por tooling mismatch, não por defeito de produto — exatamente a distinção que §5 fim exige preservar. Sem ancoragem normativa, o exit code vira oráculo não rastreável. | Adicionar em §4.1 ou §5 uma nota explícita: o exit `64` de B07 é o valor *observado* no candidato `baae1363`; se o valor efetivo diferir, o caso é `tooling_mismatch` / `not_run`, não `failed` de produto, e a limitação fica registrada na evidência. | Evidência de B07 deve distinguir o campo `oracle_source: observed_candidate` do campo `oracle_source: contract`; C0-R verifica que ambos existem no schema de saída. |
| **F-03** | **Baixa** | §3 matriz + §7 retorno | A matriz lista "Anti-Gravity CLI (`agy`), Gemini 3.8 Flash, medium" com hash de binário observado, mas §4.1 item 4 do harness afirma explicitamente que "o harness não chama… `agy`". A combinação cria uma linha de matriz cujas versões observadas nunca podem ser preenchidas pelo harness automatizado — apenas por C0-T em operação externa. A spec não separa formalmente quais linhas da matriz são preenchidas pelo harness versus por C0-T, criando risco de que C0-G avalie a linha `agy` como `not_run` de produto em vez de `external_observation`. | Segmentar a tabela §3 em duas sub-tabelas: **"Preenchido pelo harness"** (OS, Node, produto/commit) e **"Observação externa C0-T"** (Codex CLI, `agy`/Gemini); indicar que linhas externas podem conter `unavailable` sem bloquear C0-G. | C0-G checklist deve listar explicitamente que linhas externas com `unavailable` não constituem falha do gate; C0-R verifica a presença dessa cláusula no documento de gate antes de `approved` final. |

---

### Pontos aprovados sem ressalva

- Sentinela de teardown (§4.2 item 4): mecanismo robusto e suficiente para C0.
- Sanitização de paths absolutos na evidência JSON (§4.1): adequada e não exige PII handling adicional em C0.
- Separação C0-B09 (inventário de fonte ≠ ativação): corretamente limita AC-03 sem alegar C3+.
- Escopo de arquivos exclusivos (`c0-baseline.mjs` / `c0-baseline.test.mjs`): fronteira bem definida; não há risco de contaminação de fixtures existentes desde que C0-D siga §4.2 item 1.
- `not_reproduced` como resultado válido (§6/Q-01): tratamento correto; não bloqueia cenário sintético.

**Decisão:** `changes_required` — F-01 deve ser endereçado antes de C0-D iniciar o harness; F-02 e F-03 podem ser resolvidos em paralelo com o desenvolvimento, mas devem estar fechados antes de C0-G.

## Parecer após correções
**C0-R — Revisão independente**

**Decisão: `approved`**

---

Nenhum bloqueante identificado. As três findings anteriores estão encerradas:

- **F01** — Snapshot compartilhado: §4.2 item 3 impõe limpeza de `NEXTSTEP_*` antes de cada filho e adição exclusiva das variáveis do caso; §4.1 exige que probe de `resolvePaths` receba o mesmo snapshot controlado do filho CLI correspondente. Isolamento suficiente.

- **F02** — Rastreio de exit 64: âncora em `src/cli.mjs:174–176` (`error.code === 'USAGE' ? 64 : 1`) está correta. A especificação distingue três categorias: `failed` (oráculo de produto diverge), `tooling_denied`/`not_run` (falha de iniciar processo), e disponibilidade de ferramentas externas. B07 usa `oracleSource: observed_candidate`; reclassificação automática para `not_run` está proibida. Coerente.

- **F03** — Coleta externa separada: §3 e §5 separam explicitamente a suíte determinística B01..B10 (produto, automatizada) das observações de host fresco (Codex CLI, `agy`) como operações externas de C0-T/QA. Linhas externas com `unavailable`/`tooling_denied` não bloqueam C0-G. Separação clara.

**Observações sem bloqueio** (para registro de C0-D):

- B04 exige que a evidência registre o rótulo `fixtureA` para `NEXTSTEP_DATA_ROOT` mesmo que o filho receba `fixtureB`; confirmar que o snapshot registrado é o do filho (não do pai) para evitar ambiguidade na leitura do relatório.
- B08 é o único caso que admite dois resultados válidos para o mesmo ID; C0-D deve emitir dois `caseId` distintos (`B08-path` e `B08-abs`) para facilitar rastreio automatizado.
- Sentinela C0 (§4.2 item 4) deve ser verificada *antes* de qualquer leitura do filho, não apenas antes do `rm`, para que B10 consiga registrar rejeição pré-leitura como exigido.

**Status dos gates:**

| Gate | Estado |
|---|---|
| C0-R | **approved** |
| C0-D | Aguarda aprovação (esta revisão libera) |
| C1+ | Bloqueado até C0-G fechado |

