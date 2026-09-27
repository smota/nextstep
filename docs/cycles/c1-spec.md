# C1-S — instalação vinculada da CLI

| Campo | Valor |
|---|---|
| Ciclo | C-1 |
| Revisão | 0.1 — 2026-09-24 |
| Estado | Em revisão independente |
| Requisitos | R-01; parte contratual de R-07 |
| Aceite | AC-01 |
| Fonte | NXT-SPEC-001 rev. 0.2; NXT-PLAN-001 rev. 0.3 |

## Objetivo e limites

Expor o comando `nextstep` por um link de diretório para uma árvore local do produto explicitamente selecionada. A instalação não copia código, não clona ou atualiza Git, não instala Node, não toca dados de carreira, não instala skills e não altera PATH no C-1. C-2 adicionará vínculo de projeto, skills, hosts e PATH após reutilizar este contrato de propriedade e recuperação.

O C-1 aceita Windows e Node 20+ como matriz inicial. O alvo de teste é um perfil inteiramente sintético. Aplicação ao perfil real fica fora deste ciclo.

## Interface proposta

Os comandos não exigem data root:

```text
node <product-root>/bin/nextstep.mjs integration plan \
  --product-root <absolute-product-root> --profile-root <absolute-profile-root> --json

node <product-root>/bin/nextstep.mjs integration link \
  --product-root <absolute-product-root> --profile-root <absolute-profile-root> --json

node <product-root>/bin/nextstep.mjs integration status \
  --profile-root <absolute-profile-root> --json

node <product-root>/bin/nextstep.mjs integration unlink \
  --profile-root <absolute-profile-root> --json
```

`--product-root` é obrigatório para `plan` e `link`; o chamador nunca precisa passá-lo a `status` ou `unlink`. `--profile-root` é obrigatório no C-1 para tornar todo teste e efeito explícito. Defaults por usuário só podem ser adicionados em C-2 após contrato revisado.

Resultados têm `schemaVersion: 1`, `status`, `operation`, `profileRoot`, `binDestination` (sempre `<profileRoot>/bin`), uma lista `checks` e, quando aplicável, `operations`. Falhas usam o envelope JSON atual no stderr e exit `1`; uso inválido usa exit `64`. `plan` e `status` são somente leitura.

## Layout e propriedade

Fonte no produto:

```text
launchers/windows/
  nextstep.cmd
  nextstep-launcher.mjs
```

Perfil sintético ou do usuário:

```text
<profile-root>/
  integration-v1.json
  bin -> <product-root>/launchers/windows  (junction)
  transactions/                           (estado temporário próprio)
```

`integration-v1.json` contém `schemaVersion`, `installationId`, `productRoot`, `productRootReal`, `profileRoot`, `createdAt`, `updatedAt` e `managedLinks`. Cada item de `managedLinks` possui `id`, `kind`, `destination`, `source`, `sourceRealAtLink`, `rawLinkTarget` (valor exato retornado por `readlink` imediatamente após a criação), `linkType` e `ownerInstallationId`. Para C-1, `ownerInstallationId` deve ser igual ao `installationId` superior. C-1 registra somente `tool:nextstep`; C-2 pode acrescentar links de skills sem mudar o schema. Campos desconhecidos são preservados por leitores da mesma versão; shape ou versão incompatível falha fechado. O registro não é uma cópia do produto nem estado de carreira. Caminhos pessoais só aparecem nesse registro local, nunca em arquivos versionados ou output sanitizado de teste.

A instalação possui somente o registro, a junction `bin` e seus arquivos temporários. O alvo e seus descendentes nunca são possuídos. Antes de modificar ou remover, o produto revalida o registro, a identidade da instalação, o tipo do objeto e o destino físico atual.

## Launcher e resolução física

`nextstep.cmd` invoca `node "%~dp0nextstep-launcher.mjs" %*` e propaga o exit code. O módulo Node chama `realpath` sobre seu próprio diretório para obter `launchers/windows` físico, sobe dois níveis até `productRoot`, verifica `package.json` e `bin/nextstep.mjs`, e inicia `process.execPath <physical-product-root>/bin/nextstep.mjs ...argv` com `cwd`, `env`, stdin, stdout e stderr herdados. Ele não fixa data root ou cwd e não importa o motor no processo do launcher. O smoke C1-02 usa `capabilities`, que por contrato não resolve data root, a partir de um cwd temporário que não é vault nem descendente do produto.

O launcher falha com mensagem curta em stderr e exit `1` quando a fonte está ausente/inválida. Nunca busca outro checkout, copia um binário ou seleciona fonte por PATH.

## Planejamento e validação antes da escrita

`integration plan` resolve caminhos lexicais e físicos, valida:

1. Windows e Node suportados;
2. raiz absoluta existente, `package.json` com nome `nextstep`, launcher e entrypoint existentes;
3. profile root absoluto, sem ser igual, ancestral ou descendente físico da raiz do produto;
4. destino `bin` ausente ou junction gerenciada para o mesmo alvo;
5. registro ausente ou compatível com a mesma instalação;
6. para cada ancestral existente entre o profile root físico validado e o destino, nenhum link/reparse point resolve fora desse profile root. O produto root é um alvo externo permitido apenas no último link planejado;
7. volumes de origem e destino são reportados. Junctions usam alvo absoluto e podem atravessar volumes NTFS; não se infere suporte pelo volume. A criação temporária real é o probe: erros do sistema de tipo/privilégio/filesystem retornam `INTEGRATION_UNSUPPORTED`, preservando o código original nos detalhes. Um profile root detectado sob raiz conhecida de cloud sync recebe check `cloudSyncProfile: warning`, pois a junction é integração local e precisa ser recriada em outra máquina; esse aviso não é tratado como transporte da junction.

O plano inclui precondições observadas de cada caminho. `link` calcula novamente o plano imediatamente antes de escrever; não recebe um plano confiado do chamador.

Estados: `not_linked`, `linked`, `drifted`, `broken`, `conflict`, `unsupported`. Um diretório/arquivo/link desconhecido no destino é `conflict` e fica intacto. Junction para outro alvo é `drifted` e fica intacta. Alvo inexistente é `broken`; `status` e `unlink` continuam disponíveis pelo registro.

## Escrita, concorrência e recuperação

`link` usa lock exclusivo `<profile-root>/integration.lock`, adquirido por criação exclusiva. Lock existente falha `INTEGRATION_BUSY`; não espera nem remove lock alheio. O teste controla e remove somente locks que criou.

Primeira instalação:

1. criar profile root quando ausente;
2. gerar `installationId` uma única vez e gravar journal de nome fixo `transactions/active.json`, contendo esse ID, nomes exatos de temporários, precondições e `phase` (`prepared`, `temporary_link_created`, `link_published`, `registry_published`, `done`), antes de criar qualquer junction;
3. criar junction temporária `bin.nextstep-<installationId>` para o alvo;
4. verificar o destino físico pelo link temporário;
5. renomear para `bin` somente se o destino final continua ausente;
6. gravar registro temporário e substituir atomicamente `integration-v1.json`;
7. persistir `phase: done` e então remover o journal; se a remoção falhar, a próxima reconciliação reconhece a transação concluída, preserva link/registro e tenta somente remover o journal;
8. liberar lock.

Repetir `link` para o mesmo alvo é idempotente e só atualiza observações temporais quando necessário. O C-1 não implementa retargeting. Outra raiz requer `unlink` explícito seguido por `link`, ou o futuro `relink` do C-5.

Ao iniciar `link` ou `unlink`, o journal de nome fixo permite descobrir o `installationId` mesmo sem registro. Journals incompletos são reconciliados sem atravessar links: link temporário próprio pode ser removido se nome, ID, tipo e alvo textual coincidirem; `bin` válido com registro ausente produz `recovery_required`, sem adoção automática. `status` permanece estritamente somente leitura e apenas reporta journal pendente como `recovery_required`. Nenhum arquivo externo é apagado.

`unlink` remove `bin` somente quando: o registro é válido, `lstat` confirma reparse point/junction, o valor exato atual de `readlink` é igual a `rawLinkTarget` e `ownerInstallationId` coincide. Para alvo existente, também compara o destino físico; para alvo ausente, o alvo textual bruto persistido e a identidade registrada permitem remover a junction quebrada. Em seguida remove o item gerenciado e, se vazio, o registro. Profile root e diretórios desconhecidos permanecem. Se destino divergir ou tipo não for link, retorna conflito sem alteração. Remover a junction nunca chama remoção recursiva e nunca percorre ou remove o alvo.

## Erros acrescentados

| Código | Condição |
|---|---|
| `INTEGRATION_UNSUPPORTED` | SO/runtime/tipo de link não suportado |
| `INVALID_PRODUCT_ROOT` | fonte ausente ou identidade inválida |
| `INVALID_PROFILE_ROOT` | raiz relativa, sobreposta ou com escape físico |
| `INTEGRATION_CONFLICT` | destino/registro desconhecido ou incompatível |
| `INTEGRATION_DRIFT` | link gerenciado aponta para outro alvo |
| `INTEGRATION_BROKEN` | alvo gerenciado não existe |
| `INTEGRATION_BUSY` | lock exclusivo já existe |
| `INTEGRATION_RECOVERY_REQUIRED` | estado intermediário não pode ser reconciliado sem decisão |

Esses códigos passam a integrar `ERROR_TAXONOMY` e `command describe`. Nenhum diagnóstico repara silenciosamente.

## Testes C1-T

Fixtures criam uma árvore sintética mínima de produto ou usam o candidato apenas como fonte de leitura, sempre sob diretórios temporários possuídos pelo teste. Canários ficam no alvo e fora do profile root.

| ID | Cenário | Oráculo |
|---|---|---|
| C1-01 | `plan` em perfil limpo | somente leitura; operação de junction e caminhos esperados |
| C1-02 | `link` e executar `nextstep capabilities --json` com PATH contendo `<profile>/bin` e o diretório observado de `node.exe`, além dos diretórios mínimos do Windows | exit 0, versão/interface atuais; cwd temporário fora do produto e de qualquer vault |
| C1-03 | argv inválido pelo launcher | exit 64 e stderr JSON preservados |
| C1-04 | numa cópia inteiramente sintética do produto, alterar `bin/nextstep.mjs` para emitir marcador A e depois substituir esse arquivo atomicamente por rename por versão que emite marcador B; repetir o mesmo padrão em `launchers/windows/nextstep-launcher.mjs` com marcadores de diagnóstico em stderr | invocações pelo mesmo `<profile>/bin/nextstep.cmd` observam A/B em cada fonte sem novo `link`; leitura do diretório pelo caminho da junction confirma os bytes atuais |
| C1-05 | repetir `link` | mesmo destino e installationId; nenhum segundo link/payload |
| C1-06 | diretório, arquivo ou link desconhecido ocupando `bin` | conflito; bytes e destino preservados |
| C1-07 | junction gerenciada retargetada | drift; nenhuma correção automática |
| C1-08 | alvo removido | broken diagnosticável; `unlink` remove somente a junction pelo alvo textual registrado; sem fallback e sem `realpath` obrigatório do alvo |
| C1-09 | lock concorrente | busy; estado preservado |
| C1-10 | falha injetada após journal, após criar link temporário e após publicar `bin` | `transactions/active.json` conserva ID/nomes; recuperação delimitada ou `recovery_required`; canários intactos |
| C1-11 | `unlink` válido | link e registro removidos; árvore alvo e canários intactos |
| C1-12 | `unlink` com objeto divergente | conflito; nada removido |
| C1-13 | raízes com espaços, sobrepostas e path intermediário escapando por junction; registrar volumes e simular profile sob raiz de cloud sync conhecida | espaços passam; sobreposição/escape falham antes de escrita; volumes ficam observáveis; cloud sync gera warning e não alegação de portabilidade |
| C1-14 | inventário do profile root | nenhum arquivo do produto copiado ou hardlinkado; somente registro, journal transitório e junction |

O teste de substituição por rename é obrigatório porque editores frequentemente salvam dessa forma. Comparar conteúdo pelo link, não apenas inode/file ID. O runner registra OS, Node, commit e hashes dos arquivos relevantes. `npm test`, `npm run check` e `git diff --check` fecham o candidato exato.

## Gate C1-G

Passa somente com revisão independente aprovada, C1-01..14 passando, suíte completa verde, nenhum dado privado acessado, nenhuma cópia/hardlink detectada e C1-14 confirmando `bin/nextstep.mjs` preexistente preservado byte a byte. Qualquer teste obrigatório indisponível deixa o gate inconclusivo. O relatório identifica limitações: PATH real, skills, Codex desktop, Anti-Gravity e projeto privado continuam não executados até C-2/P-1.
