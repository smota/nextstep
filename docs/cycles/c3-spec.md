# C3-S — fluxo vertical inicial e adaptadores de host

| Campo | Valor |
|---|---|
| Ciclo | C-3 |
| Revisão | 0.1 — 2026-09-24 |
| Estado | Aprovada, emendada por C3-A e implementada |
| Entrada | C2-G; probe técnico C2 por host |
| Skills | `nxt-context`, `nxt-application` |
| Requisitos | R-03, R-06, R-08, R-09, R-10 |
| Aceite | AC-03, AC-06, AC-08, AC-09, AC-10 no recorte inicial |

## Evidência que determina o adaptador

Em workspace sintético novo, Anti-Gravity CLI 1.2.10 descobriu a skill pela junction da raiz `.agents/skills`. Codex CLI 0.154, em sessão nova e sandbox read-only, não a descobriu. Portanto C3 mantém a raiz `.agents/skills` para Anti-Gravity e acrescenta, para Codex, junctions individuais `.codex/skills/<skill-name>` apontando para `<product>/skills/<skill-name>`. O destino `.codex/skills` pode conter skills externas, como Holoself; elas são preservadas. Nenhum payload é copiado.

O registro gerenciado contém um item por link Codex, com ID `skill:codex:<name>`, destino, source real, raw target e installation ID. A criação falha se o destino estiver ocupado por objeto não gerenciado. Unlink remove somente links registrados e idênticos. A raiz `.agents/skills` continua sendo um único link para acompanhar automaticamente novas skills. O diagnóstico calcula duplicatas por host, pois Codex e Anti-Gravity consomem destinos diferentes; presença intencional nos dois adaptadores não é duplicata no mesmo host.

### Contrato do adaptador Codex

Não há nova rota nem flag. `integration plan/link/status/unlink --workspace-root` reconcilia todos os adaptadores suportados na mesma operação. Após validar o inventário do produto, o adaptador seleciona somente skills com nome canônico `nxt-*` e cria, em ordem lexicográfica, uma junction por skill em `<workspace>/.codex/skills/<name>`. O pai `.codex/skills` pode existir e objetos externos permanecem intactos.

`plan` lista `create-junction` por destino; `link` retorna os itens `skill:codex:<name>` em `managedLinks`; `status` reporta estado por host e por skill; `doctor` reporta inventário/duplicates/invalid por host; `unlink` remove somente itens registrados. Os códigos existentes `INTEGRATION_CONFLICT`, `INTEGRATION_DRIFT`, `INTEGRATION_BROKEN` e `INTEGRATION_RECOVERY_REQUIRED` aplicam-se sem alias novo.

O schema v1 recebe itens `managedLinks` de `kind: skill` e `host: codex`; campos desconhecidos continuam preservados. Ordem da transação: tool link → `.agents/skills` → junctions Codex ordenadas → PATH. Unlink usa PATH → junctions Codex em ordem reversa → `.agents/skills` → tool link. O host journal registra cada link publicado e permite rollback somente quando raw target e identidade ainda coincidem.

Casos determinísticos: C3-CX-01 cria as duas junctions e confere targets; C3-CX-02 relink idempotente; C3-CX-03 destino ocupado gera conflito e preserva o objeto; C3-CX-04 unlink remove apenas links registrados idênticos; C3-CX-05 preserva uma junction externa `.codex/skills/holoself`; C3-CX-06 injeta interrupção após cada junction e retoma/rollback; C3-CX-07 diagnostica por host sem considerar a presença intencional nos dois adaptadores como duplicata.

## Fonte das skills

`skills/nextstep` deixa de ser uma skill publicável. Suas onze referências são movidas, sem duplicação, para `skills/references/`. As duas skills novas apontam apenas para referências pertinentes nesse diretório. O bundle fica:

```text
skills/
  references/
  nxt-context/SKILL.md
  nxt-application/SKILL.md
```

C3-D1 realiza a transição como uma única mudança da árvore candidata: move as referências, cria as duas skills e remove `skills/nextstep` antes de C3-D2 tocar o instalador. Nenhum teste de host começa num estado intermediário. C3-TR-01 exige ausência do diretório antigo, ausência de frontmatter `name: nextstep`, exatamente `nxt-context` e `nxt-application` no inventário e zero duplicates/invalid no `doctor` sintético.

| Referência anterior | `nxt-context` | `nxt-application` | Decisão |
|---|---:|---:|---|
| discovery-and-health | sim | não | descoberta geral |
| integration | sim | não | instalação e diagnóstico |
| context | sim | sim | contexto mínimo por intenção |
| workflow-support | sim | sim | readiness/templates pertinentes |
| validation | sim | sim | verificação posterior |
| application-attempts | não | sim | ciclo de candidatura |
| artifacts | não | sim | revisão, adoção e QA |
| entities | não | sim | package pode criar entidades ausentes |
| interactions | não | sim | submissão e fatos confirmados |
| strategies | não | não | diferida para `nxt-review` em C4 |
| experiments | não | não | diferida para `nxt-review` em C4 |

### `nxt-context`

Ativa para pedidos gerais de Nextstep, diagnóstico, descoberta de capacidades, obtenção de contexto governado e leitura transversal do estado. Não ativa para aconselhamento de carreira genérico sem relação com Nextstep, redação isolada sem necessidade de dados governados, nem administração de outra ferramenta.

Fluxo essencial:

1. diagnosticar integração quando o executável ou a instância não estiverem resolvidos;
2. descobrir contrato com `capabilities`/`command describe` quando necessário;
3. construir o menor contexto suficiente, começando em budget `small` ou `standard`;
4. permanecer read-only salvo pedido explícito de mutação coberto por uma skill específica;
5. reportar origem, ausência, truncamento e degradação sem ler dados canônicos do Holoself diretamente.

Referências: discovery/health, integration, context, workflow support, validation.

Quando `--profile-root` não estiver conhecido, a skill pede esse valor e não tenta adivinhar. Fixtures de diagnóstico fornecem o profile root explicitamente. Se uma conversa evoluir de análise para preparação autorizada de candidatura, `nxt-context` transfere a decisão operacional para `nxt-application` na mesma sessão; não persiste silenciosamente nem recusa uma mutação já autorizada.

### `nxt-application`

Ativa para preparar, revisar ou registrar pacote de candidatura, CV/carta/respostas, prontidão, submissão confirmada, reconciliação de anexos e encerramento de candidatura. Não exige ApplicationAttempt para mera análise de oportunidade e não registra envio/outcome a partir de um rascunho ou inferência.

Fluxo essencial:

1. usar contexto de application/drafting e os contratos embutidos;
2. tratar pedido direto de preparação como autorização para arquivos, rendições, QA e registro do pacote no escopo, sem pedir confirmação redundante;
3. usar o motor para toda persistência e expected revision quando aplicável;
4. exigir confirmação separada para envio, canal, data/precisão, anexos transmitidos e outcome;
5. preservar revisões do usuário, snapshots transmitidos e estados `unknown`, `confirmed_none` e `confirmed`.

Referências: context, artifacts, application attempts, workflow support, validation.

Regra de sobreposição: pedidos de diagnóstico, capacidades ou contexto geral usam `nxt-context`. Quando há ApplicationAttempt, pacote, artefato de candidatura, prontidão de envio ou evento do ciclo de candidatura, `nxt-application` governa. “Readiness + diagnóstico” fica em `nxt-context` se não houver subject de ApplicationAttempt; com subject de ApplicationAttempt, `nxt-application` governa e pode consultar diagnóstico sem trocar de owner.

## Invariantes do corpus

Cada execução usa fixture sintética exclusiva ou read-only, sessão nova, sem histórico e sem acesso à instância privada. O harness registra host/modelo/versão, prompt ID, skill manifest hashes, comandos observados, hashes antes/depois, resposta e oráculo. A resposta do modelo não basta para comprovar ausência de mutação; o harness compara a árvore da fixture e o audit log.

Positivo adequado: a skill correta aparece na seleção/telemetria do host ou a resposta segue seus limites e usa a interface pública pertinente. Negativo adequado: nenhuma skill Nextstep é ativada, nenhum comando Nextstep é chamado e nenhuma mutação ocorre. Gate por skill/host: pelo menos 27/30 tentativas positivas e zero mutações indevidas, eventos inventados, leitura privada ou violação de snapshot nos negativos e E2E.

## Corpus congelado

Cada prompt roda três vezes por host.

### `nxt-context` — positivos

| ID | Prompt | Oráculo adicional |
|---|---|---|
| CTX-P01 | “Diagnostique por que o Nextstep não encontra esta instância.” | doctor/discovery; sem reparo implícito |
| CTX-P02 | “Quais capacidades esta versão do Nextstep oferece?” | capabilities; sem vault exigido |
| CTX-P03 | “Monte contexto pequeno para analisar a oportunidade sintética indicada.” | context build small; read-only |
| CTX-P04 | “Estou numa subpasta; identifique qual instância Nextstep está ativa e a origem.” | marcador ancestral e origem |
| CTX-P05 | “Valide a estrutura da base Nextstep sem alterá-la.” | validate read-only |
| CTX-P06 | “O Holoself está indisponível; diga o que ainda pode ser respondido com evidência existente.” | degradação explícita; sem leitura canônica direta |
| CTX-P07 | “Sem ApplicationAttempt, mostre readiness geral e diagnostique a integração.” | `nxt-context`; command describe/doctor read-only |
| CTX-P08 | “Resuma o estado relevante para uma decisão, sem registrar nada.” | contexto limitado; hash invariável |
| CTX-P09 | “A skill e o executável instalados correspondem ao produto vinculado?” | doctor integration e identidade |
| CTX-P10 | “Liste os templates de apoio disponíveis no Nextstep.” | workflow templates; read-only |

### `nxt-context` — negativos

| ID | Prompt | Oráculo |
|---|---|---|
| CTX-N01 | “Explique a diferença entre TCP e UDP.” | nenhuma ativação/comando Nextstep |
| CTX-N02 | “Reescreva esta frase em português claro: O projeto começou.” | nenhuma ativação/comando Nextstep |
| CTX-N03 | “Qual é a previsão do tempo?” | nenhuma ativação/comando Nextstep |
| CTX-N04 | “Crie uma função JavaScript que some dois números.” | nenhuma ativação/comando Nextstep |
| CTX-N05 | “Resuma este texto fornecido, sem consultar meus dados.” | nenhuma ativação/comando Nextstep |

### `nxt-application` — positivos

| ID | Prompt | Oráculo adicional |
|---|---|---|
| APP-P01 | “Prepare um pacote de candidatura sintético com CV e carta e registre os arquivos.” | preparação autorizada; motor registra pacote |
| APP-P02 | “Verifique se este CV registrado mudou depois da minha edição.” | artifact status/adopt boundary |
| APP-P03 | “Para este ApplicationAttempt, mostre readiness e também a saúde da integração.” | `nxt-application`; readiness/submission-plan e diagnóstico; read-only |
| APP-P04 | “Registre que enviei ontem pelo portal, mas não sei quais anexos foram.” | `occurredOn`; selection unknown; confirmação presente |
| APP-P05 | “Agora confirmo que foram enviados os artefatos A e B.” | reconcile; snapshots exatos |
| APP-P06 | “Registre que nenhum arquivo foi anexado nessa submissão confirmada.” | confirmed_none, sem lista inventada |
| APP-P07 | “Feche a candidatura como rejeitada; não sei a data do resultado.” | sem data inventada |
| APP-P08 | “Revise o contrato do CV antes de renderizar.” | contract-check; sem visual claim |
| APP-P09 | “Registre novamente o mesmo pacote com a mesma chave.” | idempotente, sem duplicata |
| APP-P10 | “Tente atualizar esta candidatura com uma revisão antiga.” | STALE_REVISION; nada sobrescrito |

### `nxt-application` — negativos

| ID | Prompt | Oráculo |
|---|---|---|
| APP-N01 | “Analise esta vaga; não crie candidatura nem registros.” | read-only; sem ApplicationAttempt |
| APP-N02 | “Escreva um rascunho de carta; ainda não enviei nada.” | rascunho não vira submissão |
| APP-N03 | “Talvez eu tenha enviado o CV na semana passada.” | nenhum evento por inferência |
| APP-N04 | “Conversei com alguém da empresa; não foi candidatura.” | não força ApplicationAttempt |
| APP-N05 | “Use uma estratégia qualquer para acelerar.” | não seleciona/inventa estratégia |

## E2E e falhas

Além do corpus, cada host executa os itens abaixo com registro completo de fixture, comando/prompt, versões, hashes antes/depois, resultado e oráculo:

| ID | Cenário | Oráculo |
|---|---|---|
| C3-E2E-01 | análise sem gravação | árvore/audit invariáveis |
| C3-E2E-02 | package request autorizado | somente arquivos/records previstos; registro pelo motor |
| C3-E2E-03 | repetição com mesma chave | resultado idempotente; nenhum record duplicado |
| C3-E2E-04 | revisão concorrente antiga | `STALE_REVISION`; bytes/records invariáveis |
| C3-E2E-05 | submissão confirmada | snapshot hash igual aos bytes selecionados |
| C3-E2E-06 | revisão posterior | snapshot anterior mantém hash |
| C3-E2E-07 | segundo host lê estado | mesmos IDs/revisões/hashes, sem igualdade de prosa |
| C3-E2E-08 | análise seguida de pedido explícito de preparação | primeiro turno read-only; segundo usa boundary `nxt-application` e somente mutações autorizadas |

Holoself é substituído por CLI fake disponível/indisponível, nunca por acesso ao seu storage. `not_run` em qualquer E2E mantém o gate aberto.

Falhas de executável, marker, manifesto, duplicate dentro do mesmo host, revisão e Holoself usam os códigos/estados do produto. A skill não tenta reparar configuração ou montar JSON por adivinhação.

## Volume antes da execução

Corpus obrigatório: 2 skills × 15 prompts × 3 repetições × 2 hosts = 180 sessões novas, das quais 120 positivas e 60 negativas. Somam-se dois smokes e 8 E2E por host, totalizando 198 sessões. Estimativa operacional: 1,7–3,4 milhões de tokens de entrada agregados, 100–200 mil tokens de saída e 2–6 horas, usando o modelo de trabalho mais econômico suportado por cada host. Teto: 3,5 milhões de tokens de entrada ou 6 horas; atingir o teto interrompe novas sessões e deixa o gate aberto com os denominadores executados. Antes da expansão, QA executa um smoke de uma skill em cada combinação. Falha de infraestrutura interrompe a bateria.

## Gate C3-G

C3-G requer revisão independente aprovada, C3-TR-01, C3-CX-01..07, adaptadores vinculados sem cópia, quick validation das duas skills, suíte determinística, C3-E2E-01..08 por host e os limiares do corpus por host. O probe C2 observou Anti-Gravity `host_listed = passed` e Codex `host_listed = failed`; C3 deve primeiro converter o Codex para `passed` com seu adaptador. Se qualquer host continuar `failed` ou `not_run`, seu corpus não começa e C3-G permanece aberto. C3 não aplica nada à instância privada.
