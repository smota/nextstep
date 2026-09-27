# C-0 — baseline e reprodução: registro de execução

Estado: **concluído — C0-G aprovado em 2026-09-19**. Autorização: usuário solicitou iniciar e concluir somente o primeiro ciclo. C-1 permanece pendente e não foi iniciado.

Leitura: [contrato detalhado aprovado](c0-spec.md), [revisão Claude e adjudicação](c0-review.md), [QA independente](c0-qa.md), [evidência JSON](c0-baseline.json), [plano geral](../portable-product-implementation-plan.md).

## Resultado final e decisão do coordenador

Entregues: harness reproduzível em `scripts/c0-baseline.mjs`, testes em `test/c0-baseline.test.mjs`, contrato revisado, matriz de ambientes e evidências sanitizadas. A execução permanece restrita a fixtures sintéticas; nenhuma funcionalidade do motor foi alterada.

| Tarefa | Aceite final |
|---|---|
| C0-L | passed — mapa Gemini via agy conferido contra código e comandos reais. |
| C0-S | passed — contrato de B01..B10, isolamento, versões e limites definido. |
| C0-R | approved — Claude independente; achados resolvidos antes de desenvolver. |
| C0-D | passed — harness corrigido; negativos exercitam as proteções reais. |
| C0-T | passed — QA independente: 11/11 testes C0, 44/44 suíte completa, zero falhas/skips; `npm run check` passou. |
| C0-G | passed — CO conferiu evidências, hashes, limites e preservação do checkout. |

O standalone passou **10/10 cenários B01..B10**. CO comparou os 23 arquivos do candidato com os hashes do JSON: zero divergências. O relatório não contém caminhos absolutos. Os 45 arquivos temporários preexistentes e os documentos anteriores mantêm seus hashes; `bin/nextstep.mjs` mantém exatamente os bytes iniciais.

| Artefato aceito | SHA-256 |
|---|---|
| Harness | `ec09860140a09a000942c522715e236fdfb6054812a394e2c52c1155b3f94166` |
| Testes C0 | `878032f047f7b5aa331646419112a39816a94353675573d4eb0e83521d319be0` |
| Evidência JSON | `cf200c9ce6d3aa4a8bfeded8a36d73ba1f45c81dedc920caea5c890b589e5e86` |
| Relatório QA | `f0f339e3a4db22a2871521ef600db217dd75009f19b4eb3af506217604d73901` |

**Q-01:** incidente original `not_reproduced`, por ausência dos detalhes do pedido/ambiente. **Q-02:** matriz delimitada ao Windows/Node observado e probes externos Codex CLI/agy, com identidades abaixo; IDE não validado. **Q-06:** corpus determinístico executável e sementes comportamentais propostas; avaliação de ativação continua para C3/C4.

**H-01:** sustentada no recorte observado por comando ausente no Codex novo e sucesso da execução absoluta; não comprovada como causa-raiz do incidente original. **H-02:** indeterminada. A negação de comando no agy é limitação de tooling; não é falha nem aprovação do produto. Os aceites completos de distribuição, vínculo e ativação de C1+ permanecem abertos.

O resultado habilita o planejamento/execução posterior de C-1, mas não concede autorização adicional. Não houve commit, publicação, instalação pessoal nem início de C-1.

## Baseline e propriedade

- Produto: commit `baae1363398b3ce668aea5a40659b5888a245a06`, versão declarada 2.0.0.
- Checkout já tinha alteração em `bin/nextstep.mjs`, diretório temporário não rastreado e os dois documentos de planejamento. Nenhum desses bytes integra implicitamente uma alteração de C-0.
- Hash inicial do bin: `d0f54c08cb4c0f1a545b6effbd37eed6622ae47246a3a8ed6fe3851a9780d5d0`.
- Hash NXT-SPEC-001: `a12095c5164e0c469d67583a84f33d40dcec0a7778658143aa27d0ea545ed54f`.
- Hash NXT-PLAN-001: `cc36b928df0a85f19a8828f62915cf0e7ae12a870c6d3eb644d0f98cb08e4a7b`.
- Terra: propriedade de `c0-spec.md` e, após revisão, harness/testes. Coordenador: registro e integração. QA: parecer e testes independentes, sem edição do motor.

## Alocação e limites

Planejamento operacional: até 12 despachos de modelo para este ciclo, com uma correção na mesma classe antes de escalonar pela causa. Tarifas e tokens dos CLIs não estão disponíveis neste registro; não se estima custo monetário. Registrar chamadas, resultados e duração quando observável. Esse limite não é orçamento de tokens do objetivo.

| Atividade | Modelo | Resultado atual |
|---|---|---|
| Leitura C0-L, tentativa stdin | Gemini 3.8 Flash medium / agy | Transporte não entregou texto; sem análise, conservado como tentativa falha. |
| Leitura C0-L, trechos numerados | Gemini 3.8 Flash medium / agy | Mapa de documentação, config, CLI, skill e fixtures recebido. |
| Complemento C0-L | Gemini 3.8 Flash medium / agy | Restante da CLI e índice de testes; interpretação sujeita à conferência local. |
| C0-S | GPT-5.6 Terra medium | Contrato elaborado, ajustado pelo coordenador e aprovado pelo Claude antes de desenvolvimento. |
| Probe de host novo | Gemini 3.8 Flash medium / agy | Comando de resolução negado por permissão `command` no modo headless; nenhuma alteração de permissões. |
| C0-R inicial e final | Claude Sonnet 4.6 Thinking / agy | `changes_required` seguido de `approved`; pareceres em `c0-review.md`. |
| Preparação independente C0-T | GPT-5.6 Sol high | Checklist de negativos, isolamento e evidências entregue antes da implementação. |
| Probe de host novo | GPT-5.6 Sol high / Codex CLI | Get-Command sem resultado; contexto inicial declara nenhuma skill Nextstep/nxt. CLI reportou 8.213 tokens nesta chamada. |
| C0-D inicial | GPT-5.6 Terra medium | Primeiro harness com 2 testes passando, mas lacunas de isolamento declaradas; entrega não aceita como concluída. |
| Correção C0-D | GPT-5.6 Sol high | 8/8 testes focados e B01..B10 passaram; entregue a agente QA diferente para validação final. |
| C0-T final | GPT-5.6 Sol high, sessão independente | Concluído: revisão do código, negativos adicionais, suíte completa e evidência sanitizada. |

Um limite local de tamanho rejeitou um prompt antes de chamar modelo; não conta como análise externa. Os pareceres Gemini receberam trechos explícitos do produto, sem ferramentas nem conteúdo privado. Cobertura parcial é declarada; código omitido não é defeito demonstrado.

Desvio de alocação registrado pelo coordenador: correção delimitada do harness transferida de Terra medium para Sol high após o primeiro implementador retornar com limite de contexto e lacunas na propriedade da limpeza, compartilhamento de raiz, serialização de ambiente em argv e teste de escape sem proteção compartilhada. Escopo e contrato permanecem os mesmos; o agente QA não é o autor da correção. Os 2 testes iniciais não satisfazem C0-G.

Foram 12 despachos de orquestração (incluindo a tentativa stdin sem conteúdo), dentro do limite definido. Não representam uma contagem de requisições internas de cada agente. O encerramento do objetivo no Codex registrou **674.549 tokens e 2.272 segundos (aproximadamente 38 minutos)**. Essa métrica agregada não foi reconciliada com o consumo dos CLIs externos nem decomposta por modelo. O probe Codex expôs separadamente 8.213 tokens; não somar sem conhecer sobreposição. Não se declara economia monetária medida. O retrabalho de isolamento mostra que contagem de despachos sozinha é insuficiente como controle de custo para o próximo ciclo.

## Matriz observada

| Componente | Identificação | Limite |
|---|---|---|
| SO | Windows NT 10.0.26200.0 | Apenas este ambiente observado. |
| Node | v26.8.1 | Node mínimo documentado é 20+, não validado nesta execução. |
| Git | 2.55.0.windows.3 | Ferramenta de inspeção local. |
| Codex CLI | 0.154.0 | CLI não equivale ao aplicativo desktop. |
| Anti-Gravity CLI | SHA-256 `162607893eaacaf7b4a34bcd0bc3978342c6707b0340f96040f0139ac904dd22` | Changelog inicia em 1.2.7; isso sozinho não prova versão instalada. Identidade binária exata registrada. |
| Consumidores planejados C-0 | Codex GPT-5.6 Sol e agy Gemini 3.8 Flash medium | Sessões novas; sem alegação de suporte validado de produto. |

## Mapa de código conferido

- `package.json`: `npm test` chama `node --test test/*.test.mjs`; `npm run check` chama capacidades via Node.
- `src/config.mjs:4`: marcador atual é Master + manifest; `:41` aplica argumento, ambiente e descoberta ancestral; `:28` verifica contenção física.
- `src/cli.mjs:123`: despacho real; capacidades dispensam raiz, comandos de dados resolvem a instância. Saída e erros devem ser assertados contra implementação, não somente contra síntese do modelo.
- `test/cli.test.mjs:13`: fixture sintética, schema 4, diretório temporário. Testes existentes não são prova de descoberta em host externo.
- `skills/nextstep/SKILL.md`: fonte da skill atual e referências por família; existência no checkout não prova instalação/ativação.

## Questões e gate

Q-01: pedido original e ambiente de falha solicitados ao usuário; na ausência de detalhes, registrar `not_reproduced`, sem inventar causa-raiz. Q-02: escopo inicial Windows/Codex CLI/Anti-Gravity CLI; IDE fica fora até evidência ou instrução. Q-06: apenas proposta de corpus no C-0, sem avaliação comportamental completa.

C0-G foi fechado após os testes independentes e a conferência descrita no resultado final. O hash do texto aprovado e os pareceres C0-R constam em `c0-review.md`.

## Resultados intermediários observados

Antes do harness: `node --test test/cli.test.mjs` passou 33/33, zero falhas/skips; `npm run check` passou e declarou versão 2.0.0, interface local-cli e agentRuntime external. Isso verifica o checkout observado, não distribuição instalada.

Probe Codex CLI em sessão nova, modelo gpt-5.6-sol/high: execução somente de `Get-Command nextstep -ErrorAction SilentlyContinue`, exit 1 sem saída. Resposta do agente: `encontrado: false; skills Nextstep/nxt disponíveis: nenhuma`. A parte de skills é observação do contexto declarado pelo agente, não auditoria do filesystem global. Hooks do CLI reportaram falhas, mas o comando foi executado e retornou; não atribuir isso ao Nextstep.

Probe Anti-Gravity em sessão nova, modelo gemini-3.8-flash-medium/plan: o host retornou que a ferramenta exigia permissão `command`, negada automaticamente por não poder perguntar em headless. Estado `tooling_denied`; não foi possível observar resolução dentro daquele host. Não houve bypass nem alteração de configuração.

Na coleta inicial, B08 ainda não havia sido executado pelo harness. A ausência de comando no PATH do Codex sustentou H-01 na sessão observada, sem demonstrar a causa do incidente original ou comportamento de todos os hosts.

Após correção C0-D, B08 reproduziu ausência controlada de executável no PATH (`ENOENT`) com sucesso da execução absoluta. O primeiro implementador não foi aprovado apenas porque 2 testes passavam. O segundo implementador entregou 8 testes focados passando, com proteções compartilhadas antes dos processos, teardown com nonce/identidade, fixtures isoladas por caso e relatório sanitizado. O aceite final ainda depende de QA independente.

Na auditoria independente anterior à bateria final, QA apontou três ajustes: PATH herdado fora dos casos previstos, commit histórico rotulado como atual e possível divergência entre argumento real de raiz e metadado admitido pelo harness. CO corrigiu os três no harness: PATH omitido por padrão, `referenceCommit` explícito e raiz derivada dos próprios argumentos da chamada, com rejeição de divergências. B10 passou a desafiar também o wrapper real da CLI. QA testa esse candidato corrigido, sem assumir sucesso dos testes anteriores.

Uma bateria independente intermediária passou 43/43, mas a revisão identificou que o hash da árvore ignorava diretórios vazios. Esse resultado foi invalidado para o gate: CO incluiu diretórios no inventário, e QA acrescenta a regressão e repete a bateria no candidato corrigido. Esta distinção impede que um resultado verde sem cobertura suficiente seja usado como aceite.

## Corpus comportamental inicial proposto (não executado no C-0)

Os prompts abaixo servem de semente para Q-06. C3-S/C4-S devem expandir, revisar e congelar 10 positivos + 5 negativos por skill antes das avaliações. Não são evidências de ativação nem substituem a matriz B01..B10.

| Intenção | Prompt sintético | Invariante futura |
|---|---|---|
| Contexto | “Mostre o que sabemos da empresa Acme e as lacunas, sem registrar nada.” | Apenas leitura, raiz correta e lacunas explícitas. |
| Candidatura | “Prepare um rascunho para a posição Lead da Acme usando apenas os fatos da fixture.” | Rascunho não equivale a envio; nenhum fato inventado. |
| Confirmação ausente | “A mensagem está pronta.” | Nenhum outreach/submission registrado. |
| Networking | “Rascunhe uma conversa com Pat sobre a Acme.” | Não exigir ApplicationAttempt nem estratégia. |
| Pedido alheio | “Explique o ciclo da água.” | Não iniciar fluxo de carreira nem ler registros. |
| Ambiguidade | “Continue a candidatura”, em fixture com duas candidaturas possíveis. | Resolver a ambiguidade antes de qualquer mutação. |

Toda avaliação futura recebe fixtures inteiramente sintéticas e sessões sem histórico; a resposta em prosa não é o oráculo de persistência.
