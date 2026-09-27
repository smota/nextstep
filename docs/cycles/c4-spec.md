# C4-S — cobertura completa das intenções Nextstep

| Campo | Valor |
|---|---|
| Ciclo | C-4 |
| Entrada | C3-G e C3-A aprovados |
| Skills novas | `nxt-opportunity`, `nxt-networking`, `nxt-review` |
| Estado | Aprovada e implementada |

## Fronteiras de ativação

- `nxt-opportunity` governa análise de vaga/oportunidade, evidências, lacunas e decisão. Análise permanece read-only; só registra decisão quando solicitada. Nunca cria ApplicationAttempt como pré-requisito.
- `nxt-networking` governa pessoas, conversas, relacionamento e outreach. Conversa ou rascunho não prova envio; outreach confirmado pode ser registrado sem ApplicationAttempt.
- `nxt-review` governa revisão transversal da busca, estratégias, experimentos e próximos passos. Estratégia e experimento são opcionais e somente são aplicados quando selecionados ou ativos e pertinentes.

Precedência: pacote/artefato/submissão/outcome de candidatura usa `nxt-application`; diagnóstico/contexto geral usa `nxt-context`; oportunidade sem candidatura usa `nxt-opportunity`; pessoa/outreach usa `nxt-networking`; estratégia/experimento e revisão global usam `nxt-review`.

## Referências

As skills usam somente `../references/*` da fonte única:

| Skill | Referências |
|---|---|
| `nxt-opportunity` | context, workflow-support, interactions, validation |
| `nxt-networking` | context, entities, interactions, artifacts, validation |
| `nxt-review` | context, strategies, experiments, workflow-support, validation |

Nenhuma referência, ferramenta ou skill é copiada. A junction raiz do Anti-Gravity expõe automaticamente as novas skills. Uma nova execução de `integration link` cria somente as junctions Codex faltantes e preserva as existentes e externas.

## Aceite

- C4-TR-01: inventário contém exatamente as cinco skills `nxt-*`, sem router antigo, inválidas ou duplicadas.
- C4-LK-01: relink de uma instalação C3 cria apenas três junctions Codex novas; `references` e as duas skills existentes mantêm identidade.
- C4-LK-02: unlink remove as cinco skills e o suporte gerenciados e preserva `holoself`/objetos externos.
- Quick validation passa nas cinco skills.
- Cada host lista exatamente as cinco skills em sessão nova.
- Cada combinação host × skill nova executa um smoke positivo com leitura de manifesto e referência; cada host executa um negativo alheio a Nextstep.
- E2E determinístico comprova: oportunidade analisada sem gravação; decisão explícita pelo motor; networking sem ApplicationAttempt; rascunho sem evento; outreach confirmado; estratégia opcional; experimento governado; ausência de submissão inferida.
- Suíte completa, check e diff-check passam. A instância privada permanece intocada em C4.

O corpus estatístico permanece caracterização externa conforme C3-A e não bloqueia o produto.
