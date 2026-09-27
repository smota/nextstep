# Nextstep — migração da distribuição de skills para Skills Manager

Data: 2026-09-25. Revisão 3: migração aplicada; cinco skills na library e deployment Codex validado. Anti-Gravity pendente por detecção do Manager. Nenhuma alteração no software Skills Manager.

## Objetivo e decisão

O Produto continua sendo a fonte autoral das cinco skills `nxt-context`, `nxt-opportunity`, `nxt-application`, `nxt-networking` e `nxt-review`. Skills Manager passa a ser a autoridade de library, composição do preset **Next Step** e deployment nos agentes. A instância privada contém dados e configuração de instância; deixa de ativar skills por links locais mantidos pelo Nextstep.

Este plano substitui a decisão de exposição das skills no workspace privado do plano NXT-PLAN-001. Mantém o CLI, o launcher, o PATH e a seleção de dados independentes. Evidências anteriores de instalação permanecem históricas.

Execução autorizada posteriormente pelo usuário e aplicada em 2026-09-25. Ver [evidência de execução](cycles/skills-manager-migration-execution.md).

## Evidência atual

- Produto: cinco diretórios `skills/nxt-*`, com referências relativas em `../references/`; nenhuma dependência pessoal encontrada nessa árvore na análise inicial.
- Instância privada: `.agents/skills` aponta para a árvore inteira do Produto; `.codex/skills/nxt-*` e `.codex/skills/references` apontam para os respectivos diretórios do Produto. O link Holoself é independente.
- Skills Manager instalado: CLI 1.40.0. `presets list` mostrou um preset vazio chamado `NextStep`, marcado ativo. `skills list --query nxt-` retornou vazio. Revalidar antes de qualquer mudança.
- A CLI permite criar/renomear presets, adicionar membros e fazer deploy/undeploy aditivo. Criar preset pela interface desktop tem comportamento diferente: pode trocar o preset ativo. Usar CLI e preservar deployments alheios.
- `skills install --local` copia o diretório da skill para a library; não é registro de fonte vinculada. Uma importação individual não inclui o diretório irmão de referências.
- `integration unlink` do Nextstep remove também PATH e launcher. Não serve, hoje, para remover somente a ativação local das skills.
- O checkout Nextstep tem alterações anteriores e as cinco skills ainda não estão rastreadas. Preservar o trabalho existente; registrar o candidato e suas diferenças antes de implementar.

Fontes inspecionadas: `src/integration.mjs`, `src/config.mjs`, `skills/`, `README.md`; no repositório Skills Manager, `src-tauri/src/bin/skills-manager-cli.rs`, `src-tauri/src/core/installer.rs`, `src-tauri/src/commands/presets.rs` e `README.md`. Caminhos e IDs pessoais ficam fora deste documento público.

## Arquitetura de destino

1. **Nextstep Produto:** conteúdo das skills e referências, comandos de domínio, instalação do CLI e contrato genérico de seleção de dados.
2. **Skills Manager:** importa cópias de pacotes locais autossuficientes na library, registrando sua origem, mantém associação ao preset e controla deployment e undeployment por agente.
3. **Nextstep Example:** dados privados, instruções privadas, marcador de instância e integração Holoself. Nenhum link local `nxt-*` nem suporte Nextstep nos diretórios de descoberta.
4. **Agentes:** descobrem as skills pelo deployment do Skills Manager. O preset não seleciona nem embute um diretório de dados. A CLI resolve a instância por argumento, ambiente ou descoberta já suportada; ausência de instância deve gerar diagnóstico, nunca fallback para a instância pessoal.

A instrução atual autoriza cópias gerenciadas das skills e substitui o requisito anterior de zero cópias para esse payload. Não modificar, estender ou recompilar o Skills Manager. Usar sua importação local, atualização e deployment existentes. A instalação do CLI Nextstep permanece independente.

### Pacotes e referências

Manter `skills/nxt-*` e `skills/references` como fontes autorais no Produto. Acrescentar no Produto um empacotador determinístico que gere cinco pacotes independentes em diretório de distribuição estável, ignorado pelo Git. Cada pacote contém `SKILL.md` e `references/` com as referências necessárias, incluindo dependências transitivas. O empacotador reescreve os links `../references/` para `references/` somente na saída e verifica que não há dependências fora do pacote.

Importar cada pacote pelo comando existente `skills install <caminho-do-pacote> --local`, sem flags de sincronização implícita. Registrar a origem local estável para que `skills update <referência>` possa atualizar a mesma entrada depois. Não recriar entradas a cada atualização; preservar IDs e membership do preset. Não criar uma sexta skill de suporte nem dependência entre diretórios irmãos na library.

As cópias são artefatos de distribuição, não fontes de autoria. Alterações permanentes são feitas no Produto e propagadas. Um manifesto de distribuição registra versão/revisão disponível, hashes do conteúdo-fonte e de cada pacote; caminhos pessoais e IDs locais do Manager ficam apenas no registro local da instalação. Hashes são necessários porque o checkout pode conter mudanças não commitadas.

### Rotina obrigatória de atualização do ambiente de desenvolvimento

Registrar este procedimento no README e no contrato de manutenção do Produto durante a implementação. Toda atualização do ambiente de desenvolvimento Nextstep deve verificar e, quando houver diferença, atualizar também as cópias das skills:

1. Validar a fonte atual e regenerar os cinco pacotes no mesmo local de origem registrado, sem expor saída parcial.
2. Comparar manifesto/hashes com a última distribuição; se iguais, registrar que não há atualização necessária.
3. Inspecionar o estado das cinco entradas e atualizar somente elas pela CLI pública do Manager (`skills check <referência>` e `skills update <referência>`, após confirmar o contrato instalado). Não executar atualização global de skills alheias.
4. Preservar edições divergentes na library ou nos deployments: detectar e resolver pelo fluxo suportado antes de sobrescrever. Revalidar remoções de arquivos conforme o contrato da CLI.
5. Verificar o conteúdo efetivo nos agentes já selecionados para o preset; usar o deployment/sincronização públicos existentes quando necessário. Não ativar novos agentes ou presets como efeito de uma atualização.
6. Comparar hashes de payload e referências na distribuição, library e deployments. Registrar resultado por skill/agente; uma falha deixa a atualização do ambiente incompleta, com estado recuperável.
7. Recarregar ou abrir sessão nova nos hosts afetados e validar descoberta/leitura quando o conteúdo mudar. Não prometer atualização da sessão já aberta.

Rotina implementada em `npm run skills:update` e documentada em [distribuição](skill-distribution.md). A CLI 1.40.0 pula fontes locais em `skills check`; a implementação compara hashes e usa `skills update` para cópias alteradas.

## Sequência de implementação e implantação

| Etapa | Trabalho | Aceite |
|---|---|---|
| 0 — Baseline | Registrar Git/diffs do candidato, versão efetiva do Manager, preset existente, deployments e propriedade dos links. Guardar inventário de rollback local sem exportar carreira. | Lista exata de operações e alvos; nenhuma escrita nos dados privados. |
| 1 — Contrato do Produto | Explicitar autoria/distribuição em AGENTS e README; trocar exemplos pessoais; corrigir `application submission-plan` para `application-attempt submission-plan`; atualizar documentação de integração. Gerar pacotes autossuficientes e documentar a rotina de atualização das cópias. | Cinco skills, nenhum caminho pessoal, referências resolvidas, instruções de dados genéricas. |
| 2 — Separar responsabilidades de instalação | Criar operação pública de preview e remoção somente dos links de skills, com ownership, journal e rollback. Desativar a criação/recriação desses links no fluxo normal de integração; manter gestão de launcher/PATH/projeto. Adaptar doctor para distinguir instalação do CLI e distribuição externa de skills. | Remover skills não altera PATH, launcher, marcador, Holoself ou carreira; relink do CLI não recria ativação local; doctor não exige links antigos. |
| 3 — Distribuição compatível | Validar os cinco pacotes com os comandos existentes do Manager em ambiente isolado: importação local, atualização da mesma entrada, preset e deployment. Ensaiar uma alteração de fonte e sua propagação completa. | Cinco cópias autossuficientes; referências resolvidas; IDs preservados após update; nenhum desenvolvimento ou atualização do binário do Manager. |
| 4 — Retirada prévia no Sam | Primeira mudança na instalação real: executar preview e remoção seletiva dos vínculos antigos. Retirar `.agents/skills` somente se continuar sendo a junction exclusiva para a árvore Nextstep. Remover os cinco links Codex e o suporte antigo registrados, preservando entradas externas. Atualizar ownership pelo comando público. | Zero ativação local Nextstep em sessões novas; CLI e seleção de dados continuam funcionando. |
| 5 — Library e preset | Importar os cinco pacotes locais pela CLI existente. Reutilizar o ID do preset vazio `NextStep`, renomeando-o para **Next Step**; adicionar exatamente as cinco skills. Revalidar colisões e conteúdo antes de reutilizar. | Um único preset com nome exato e cinco membros; nenhuma ativação implícita pela importação/associação. |
| 6 — Deployment controlado | Inspecionar agentes habilitados e destinos; executar preview, depois deploy aditivo do preset para os hosts definidos no piloto, inicialmente Codex e Anti-Gravity quando seus adaptadores forem verificados. Não usar troca exclusiva de preset. | Deployment pelo Manager, sem duplicatas locais/globais nem remoção de outros presets ou Holoself. |
| 7 — Aceite e entrega | Validar sessões novas por host, atualizar documentação vigente e registrar hashes/revisões do candidato e evidência final sanitizada. | Critérios abaixo atendidos; separar host não executado de host aprovado. |

Etapas 1–3 são preparação e testes isolados. A remoção no Sam ocorre antes de registrar/ativar as novas cópias na instalação pessoal, como solicitado. Não deixar a instância sem skills enquanto ainda se prepara e valida a distribuição. Não executar `integration unlink` completo como atalho.

Operações implementadas: `integration unlink --scope skills [--dry-run]` e rollback explícito `integration restore-skills [--dry-run]`. No Manager, usar apenas comandos já disponíveis. Não editar SQLite, registry ou metadados gerenciados manualmente.

## Validação requerida

- Duas instâncias sintéticas distintas, usando as mesmas skills distribuídas; confirmar precedência e nenhuma contaminação cruzada. Contexto sem instância não escolhe dados pessoais.
- Inventário e referências: cinco manifests válidos; pacotes autossuficientes; todos os links Markdown resolvem na fonte, pacote, library e destino efetivamente usado pelo agente.
- Remoção seletiva: links exatos, idempotência, conflito, link quebrado, interrupção/retomada e canários fora do escopo. Preservar bytes do Produto, marcador, instruções privadas e links externos.
- Manager: criar/renomear/reutilizar preset sem duplicar; importação e membership sem deployment involuntário; deploy aditivo e undeploy preservam outros presets. Cada pacote carrega suas próprias referências.
- Cópias e atualização: alteração na fonte não é tratada como propagação automática; regeneração e update propagam o conteúdo com hashes verificáveis, preservando IDs e preset. Origem indisponível impede atualização, mas não invalida a cópia já instalada. Remoção da library nunca apaga a fonte. Falha parcial e divergência local são detectadas; repetição sem mudanças é idempotente.
- Hosts: sessão nova lista exatamente as cinco skills e lê referências. Exercitar `nxt-context` com validação somente leitura; testar ausência de ativação para pedido não relacionado. Codex Desktop, CLI e Anti-Gravity têm evidências separadas.
- Produto: testes focados após cada mudança; suíte completa e `npm run check` no candidato integrado. Distribuição: testes do empacotador e integração com a CLI existente do Manager em ambiente isolado; nenhum teste implica mudança no código do Manager.

## Recuperação e limites

Guardar metadados suficientes para restaurar vínculos anteriores por operação pública e apenas quando os destinos continuarem livres ou sob a mesma propriedade. Em falha antes do deployment, manter CLI funcional e reportar skills indisponíveis; restaurar ativação antiga somente como rollback explícito da migração, sem duplicá-la com a nova.

Reverter apenas membros/deployments criados por esta migração. Preservar o ID do preset reutilizado e registrar nome, membership e estado anteriores para reversão. Não apagar o preset preexistente nem remover skills compartilhadas com outros presets.

O escopo de desenvolvimento fica restrito ao Nextstep. Skills Manager recebe apenas conteúdo e configuração pelas operações existentes, sem extensão, fork ou recompilação. Não inclui migração de carreira, troca de Holoself, publicação, mudança de política pessoal ou instalação de skills em todos os agentes sem seleção. Cópias de skills são autorizadas e sua atualização é parte obrigatória da manutenção do ambiente de desenvolvimento.

Para rollback de atualização, preservar a última distribuição validada e os metadados locais de versão. Restaurar os pacotes anteriores e reaplicar pelas operações públicas do Manager; não restaurar SQLite manualmente nem desfazer deployments alheios.
