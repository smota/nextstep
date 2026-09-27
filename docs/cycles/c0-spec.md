# C0 — baseline e reprodução: especificação detalhada

| Campo | Valor |
|---|---|
| ID | C0-S |
| Estado | Proposta para C0-R; não autoriza desenvolvimento |
| Base | `NXT-SPEC-001` rev. 0.1; `NXT-PLAN-001` rev. 0.2 |
| Baseline a identificar no relatório | `baae1363398b3ce668aea5a40659b5888a245a06` |
| Arquivo exclusivo futuro de C0-D | `scripts/c0-baseline.mjs` e `test/c0-baseline.test.mjs` |

## 1. Objetivo, fronteiras e rastreio

C0 resolve Q-01 e Q-02 na medida observável e prepara Q-06. Ele fixa um baseline executável, mapeia a descoberta atualmente implementada e produz uma reprodução sintética independente de dados pessoais. O resultado pode ser uma falha reproduzida ou `not_reproduced` com limites explícitos; nenhum deles prova a causa-raiz de H-01 ou H-02.

Inclui evidência para H-01/H-02 e a base técnica de R-02, R-03, R-05, R-08 e R-09. Os AC que orientam os testes são AC-02 (precedência e raiz/subdiretório), a parte técnica de AC-03 (inventário de skill, sem alegar ativação), AC-05 (causas distintas para executável/skill ausentes) e AC-09 (somente dados sintéticos). AC-01 e AC-04 a AC-10 são aceites futuros e não fecham neste ciclo.

Não inclui reparo do produto, mudança de domínio, distribuição, vínculo durável, instalação de skills, avaliação de ativação por LLM, publicação, instalação pessoal, nem acesso à vault privada ou a `.tmp/`. C0-D só poderá criar o harness aprovado; esta especificação não cria testes nem altera comportamento.

## 2. Evidência atual a preservar, sem promover a suporte confirmado

O relatório futuro identifica o commit e preserva mudanças preexistentes fora dos arquivos exclusivos. No checkout observado, `bin/nextstep.mjs` possui alteração não atribuída a C0, SHA-256 `D0F54C08CB4C0F1A545B6EFFBD37EED6622AE47246A3A8ED6FE3851A9780D5D0`; por decisão expressa do coordenador, esses bytes são o candidato observado do baseline e devem ser preservados byte a byte, sem edição ou integração implícita por C0.

Mapa C0-L já fornecido, a ser revalidado por C0-T no host fresco:

| Assunto | Evidência observada | Limite para C0 |
|---|---|---|
| Produto | `package.json`: versão `2.0.0`, scripts `npm test` e `npm run check` | Não prova instalação limpa nem suporte a hospedeiro. |
| Seleção de raiz | `src/config.mjs`: `--data-root`/argumento, depois `NEXTSTEP_DATA_ROOT`, depois ancestral com `Master/` + `Candidatures/records/manifest.json` | Não existe vínculo durável; a descoberta é o comportamento atual, não o contrato futuro de C2. |
| Erro sem raiz | `resolvePaths` retorna `DATA_ROOT_REQUIRED` quando não há seleção válida | O harness confirma o código/saída estruturada do candidato observado. |
| Fixture existente | `test/cli.test.mjs` linhas 13–36 cria diretório temporário e registros de esquema 4 | É evidência de padrão útil, não fixture compartilhada para C0. |
| Skill-fonte | `skills/nextstep/SKILL.md` e referências existem no repositório | Prova de fonte não é descoberta ou instalação no hospedeiro. |

## 3. Matriz inicial e coleta de versões

Esta é a matriz de planejamento, não uma declaração de compatibilidade. C0-T cria uma linha por execução com valores efetivamente consultados; um valor indisponível recebe `not_run` ou `unavailable`, nunca uma versão inferida.

| Dimensão | Combinação planejada | Estado antes de C0-T |
|---|---|---|
| SO | Windows build 26200 | A revalidar no host da execução. |
| Runtime | Node 26.8.1 | A revalidar no processo que roda o probe. |
| Hospedeiro consumidor | Codex CLI 0.154.0 com modelo planejado GPT-5.6 Sol | Modelo/versão devem ser observados; C0 não mede ativação. |
| Hospedeiro consumidor | Anti-Gravity CLI (`agy`), Gemini 3.8 Flash, medium | O hash do binário observado é `162607893EAACAF7B4A34BCD0BC3978342C6707B0340F96040F0139AC904DD22`; changelog 1.2.7 não é prova da versão instalada. |
| Produto | commit `baae1363398b3ce668aea5a40659b5888a245a06`, versão declarada 2.0.0 | Commit, estado de trabalho e hash dos documentos são registrados antes da bateria. |

IDE não entra na matriz sem a identificação do ambiente do incidente. A tarefa original permanece desconhecida até o usuário fornecer hospedeiro, versão, prompt, diretório de início, resultado esperado e resultado observado. Essa ausência permite `not_reproduced`; não permite alegar que o cenário sintético explica o incidente.

Coleta automatizada pelo harness: SO, Node, versão e hashes do produto. Coleta externa C0-T/CO: Codex CLI/modelo e Anti-Gravity CLI/modelo. As linhas externas descrevem observações do hospedeiro, não testes do produto; `unavailable` ou `tooling_denied` nelas não bloqueiam o gate C0, mas impedem alegar suporte/ativação. Os B01..B10 obrigatórios continuam bloqueando se não executados.

## 4. Contrato do harness proposto para C0-D

### 4.1 Arquivos, entradas e saída

`scripts/c0-baseline.mjs` será um executor interno invocado pelos testes, e `test/c0-baseline.test.mjs` será a única superfície de teste C0. Ambos usam somente Node padrão, o checkout candidato e fixtures próprias. Não recebem caminho de vault, nem seguem `NEXTSTEP_DATA_ROOT`/`NEXTSTEP_STATE_ROOT` do processo pai.

Cada execução produz uma evidência JSON sanitizada com: `caseId`, status (`passed`, `failed`, `not_run`), baseline commit/hash, versões observadas, tipo de fixture, `argv` exato ou probe, resultado normalizado, oráculo e limitação. Ela não contém caminhos absolutos: usa somente rótulos relativos como `fixtureA`, `fixtureB` e `outside-sentinel`; remove nomes de utilizador, conteúdo de records, valores de `NEXTSTEP_*`, tokens e saída ambiente não necessária. O relatório distingue asserções automáticas de observações de hospedeiro.

O executável do produto será chamado por `process.execPath` e caminho absoluto para o `bin/nextstep.mjs` do candidato quando o caso precisar da CLI. Isso isola a verificação do contrato da CLI da disponibilidade do comando `nextstep` no PATH. Probes de PATH usam processo-filho e ambiente controlado. O harness não chama Holoself, Codex, `agy`, LLMs ou instaladores de skills: observações de host fresco são operações externas de C0-T/QA.

Os oráculos de comportamento atual usam `oracleSource: observed_candidate`; invariantes de isolamento/evidência usam `oracleSource: contract`. B07 ancora exit 64 e `USAGE` em `src/cli.mjs:174–176`, cujo catch retorna `error.code === 'USAGE' ? 64 : 1`. Divergência real desse comportamento é `failed` do baseline e precisa de investigação, não é reclassificada automaticamente como indisponibilidade de tooling. Falha de iniciar o processo é uma categoria distinta.

B02–B06 nunca importam `resolvePaths` no processo pai do harness. Todo probe dessa função roda em processo-filho separado e recebe exatamente o mesmo snapshot controlado de ambiente e cwd do filho CLI correspondente. Evidência registra apenas o snapshot relevante com valores simbólicos (`fixtureA`, `fixtureB`) para NEXTSTEP_DATA_ROOT/STATE_ROOT explicitamente definidos, sem ambiente pessoal ou caminhos reais. B04 deve demonstrar que recebeu a variável apontando a B e mesmo assim selecionou A. Esses rótulos sintéticos são a única exceção à remoção dos valores de NEXTSTEP na evidência.

### 4.2 Isolamento obrigatório

1. A raiz de cada caso nasce em `mkdtemp` sob uma raiz C0 exclusiva, criada no diretório temporário do sistema; nenhum caso reutiliza fixture ou estado de outro caso.
2. A fixture contém apenas `Master/`, `Candidatures/records/manifest.json` de esquema 4 e os records mínimos sintéticos necessários. Não copia arquivos da instância Samuel, do repositório de dados nem de `.tmp/`.
3. Antes de criar cada filho, o harness remove todas as variáveis cujo nome começa por `NEXTSTEP_`; adiciona somente as variáveis explicitamente definidas pelo caso. PATH é copiado apenas quando o caso o exige e é registrado em forma sanitizada.
4. A limpeza aceita exclusivamente uma raiz marcada com sentinela C0 criada pelo próprio harness e verificada como descendente da raiz temporária exclusiva. Falha de sentinela, caminho não contido, ou raiz pré-existente impede `rm`; a falha fica na evidência para remoção manual delimitada.
5. O harness não aceita argumento, environment variable, symlink ou junction que aponte para fora da raiz sintética. A própria prova de isolamento deve demonstrar que não foi usado um caminho de vault arbitrário.

## 5. Casos mandatórios para C0-D/T

| ID | Configuração sintética e probe | Oráculo obrigatório |
|---|---|---|
| C0-B01 | CWD fora de fixture; sem `NEXTSTEP_*`; `argv`: `capabilities --json`. | Exit `0`; stdout JSON contém `interface: local-cli` e `version: 2.0.0`; não exige raiz. |
| C0-B02 | CWD `fixtureA` (empresa sintética `company:c0`, nome `fixture-A`); sem override; `argv`: `get --id company:c0`. | Exit `0`; JSON retorna `value.id: company:c0` e `value.name: fixture-A`; probe-filho que importa `resolvePaths` retorna rótulo `fixtureA`. |
| C0-B03 | CWD `fixtureA/work/nested`; restante igual a B02. | Exit `0`; mesmo `value` e probe retorna `fixtureA`. |
| C0-B04 | CWD `fixtureB` (nome `fixture-B`); `NEXTSTEP_DATA_ROOT=fixtureB`; `argv`: `get --id company:c0 --data-root <fixtureA>`. | Exit `0`; `value.name: fixture-A`; probe retorna `fixtureA`: argumento vence ambiente e ancestral. |
| C0-B05 | CWD `fixtureB`; `NEXTSTEP_DATA_ROOT=fixtureA`; `argv`: `get --id company:c0`. | Exit `0`; `value.name: fixture-A`; probe retorna `fixtureA`: ambiente vence ancestral. |
| C0-B06 | CWD fora de fixture; sem `NEXTSTEP_*`; `argv`: `get --id company:c0`. | Filho sai `1`; stderr JSON tem `error.code === DATA_ROOT_REQUIRED`; não cria fora da raiz C0. |
| C0-B07 | CWD fora de fixture; ambiente sanitizado; `argv`: `no-such-command`. | Filho sai `64`; stderr JSON tem `error.code === USAGE`; sem mutação. |
| C0-B08 | Filho executa `nextstep capabilities --json` com PATH sem executável; outro filho executa `[process.execPath, candidate/bin/nextstep.mjs, capabilities, --json]`. | Probe nomeado é `ENOENT`/indisponível; binário absoluto sai `0`. É limitação de tooling, não defeito do produto. |
| C0-B09 | Inventariar apenas `skills/nextstep/SKILL.md` e `references/` do checkout; não copiar/instalar. | Inventário de fonte passa; descoberta/ativação do host é `not_run` futuro e não satisfaz AC-03. |
| C0-B10 | Tentar fornecer ao executor uma raiz externa ou uma symlink/junction que escape a fixture. | Rejeição antes de leitura/mutação, com evidência sanitizada; teardown não toca o destino externo sentinela. |

Os B01..B10 são uma matriz automatizada única, isolada por processo-filho por caso. C0-T pode registrar observações de baseline somente de leitura para cada host fresco acessível; não repete a suíte determinística por modelo/hospedeiro nem mede ativação. Uma negação de permissões, binário ausente ou falha de automação é `tooling_denied`/`not_run`, separada de `failed` do oráculo de produto e anotada como limitação para gates posteriores.

## 6. Decisões e questões que C0 deve fechar ou encaminhar

| Item | Decisão/evidência esperada em C0-G |
|---|---|
| Q-01 | Caso original reproduzido com fatos fornecidos, ou `not_reproduced` com campos ausentes e cenário sintético delimitado. |
| Q-02 | Matriz efetiva com versões/hashes observados e ambientes fora da matriz explicitamente excluídos. |
| Q-06 | Corpus inicial C0-B01..B10 e formato de evidência; prompts comportamentais e limiar estatístico continuam para C3-S/C4-S. |
| H-01 | Classificação baseada em observação: sustentada, enfraquecida ou indeterminada. Nunca causa-raiz sem reprodução do caso original. |
| H-02 | Indeterminada em C0: inventário de fonte não mede ativação. |

São decisões futuras bloqueadas: canal de distribuição Q-03, formato/migração de marcador Q-04, cópias versus links Q-05, instalação e descoberta real de `nxt-*`, e todo aceite C1–C5. C0-G só libera C1 se houver cenário sintético reproduzível e a revisão C0-R tiver fechado seus achados; não declara C1+ implementado ou aceito.

## 7. Gate C0-G e retorno exigido

O candidato C0 fecha somente após: C0-R `approved`; C0-D limitado aos dois arquivos exclusivos; B01..B10 automatizados passam; teardown verificado; evidência sanitizada; e zero falhas abertas em isolamento, precedência ou preservação de alterações existentes. A ausência da tarefa original é `not_reproduced` e não impede o cenário sintético. Observação externa de host negada fica documentada como limitação, sem transformar a ausência de ativação (C3) em falha do baseline C0.

O retorno para CO contém: arquivos alterados; commit/hash exato testado; status de cada caso; JSONs de evidência ou referências; versões observadas; diferença entre defeito de produto e tooling; achados e limitações; decisão proposta para Q-01/Q-02/Q-06; e confirmação de que nenhuma vault privada, `.tmp/`, instalação pessoal ou arquivo preexistente foi tocado.
