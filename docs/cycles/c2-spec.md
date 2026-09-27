# C2-S — vínculo da instância, descoberta e diagnóstico

| Campo | Valor |
|---|---|
| Ciclo | C-2 |
| Revisão | 0.1 — 2026-09-24 |
| Estado | Em revisão independente |
| Entrada | C1-G passed; manifesto `8dd5d5d49eba1e865e76e3eff2bd121792f7df94321efaf6546fa4f4cc7f8293` |
| Requisitos | R-02, R-03 técnico, R-04, R-05, R-09 |
| Aceite | AC-02, AC-03 técnico, AC-04, AC-05 |

## Evidência atual de hosts

- O produto ainda não está no PATH desta sessão; a execução absoluta funciona.
- A instância privada existente possui `.codex/skills/holoself`, `.gemini/skills/holoself` e `.gemini/antigravity/skills/holoself`, mas não Nextstep.
- Documentação Gemini CLI consultada em 2026-09-24 declara descoberta em workspace `.gemini/skills` e alias `.agents/skills`, `/skills list`, `/skills reload` e `gemini skills link`.
- Evidência pública OpenAI confirma o formato Agent Skills e uso de diretórios de capacidades; o padrão de repositório `.agents/skills` aparece em material oficial. Descoberta no Codex desktop local será um teste do C-2/P-1, não inferência documental.
- O workspace declarado no ambiente não existe no host observado; a instância encontrada fica sob a raiz sincronizada do usuário. C-2 não corrige configuração pessoal nem move dados.

## Resultado e limites

C-2 entrega:

1. marcador durável `nextstep.yaml` na instância, com raiz relativa;
2. resolução `--data-root` > `NEXTSTEP_DATA_ROOT` > marcador ancestral mais próximo > layout ancestral atual;
3. link único de workspace `.agents/skills` para `<productRoot>/skills`, de modo que skills novas e mudanças fiquem visíveis no filesystem sem relink; ativação requer sessão nova ou reload documentado pelo host e não é garantida no C-2;
4. entrada gerenciada no PATH do usuário para `<profileRoot>/bin`;
5. diagnóstico de integração separado da saúde dos dados.

C-2 não cria as cinco skills `nxt-*`, não mede ativação comportamental, não instala no projeto privado e não altera Holoself. Anti-Gravity específico fica `not_run` até provar que consome `.agents/skills`; se não consumir, C-3 adiciona adaptador explícito sem cópia.

A skill atual `skills/nextstep` fica intencionalmente visível pelo link durante C-2 apenas para teste técnico. Ela não é alias compatível dos nomes finais e não conta como `nxt-*`. C-3 substitui essa fonte pelas skills `nxt-context` e `nxt-application`; C-4 completa as demais e remove a skill antiga. Se outro destino do mesmo workspace já expõe uma skill cujo frontmatter declara `name: nextstep`, doctor reporta duplicata e a integração não é healthy. Nenhum destino alternativo é apagado ou desabilitado.

## Configuração da instância

Arquivo na raiz do vault:

```yaml
schema_version: 1
instance_id: nextstep-sam
data_root: .
```

Parser próprio, sem biblioteca YAML genérica, aceita exatamente três linhas não vazias `key: value`, comentários/linhas vazias opcionais, chaves únicas da whitelist e escalares no charset `[A-Za-z0-9._-]+`. Rejeita aspas, escapes, arrays/maps, anchors/aliases (`&`/`*`), tags (`!`), block scalars (`|`/`>`), directives, tabs, valores YAML-like `yes/no/true/false/null/~`, chaves duplicadas e conteúdo após o escalar. `schema_version` deve ser `1`; `data_root` deve ser `.`; `instance_id` segue `[a-z0-9][a-z0-9-]{0,63}`. O caminho resolvido deve ser a própria raiz do marcador, fisicamente contida. Arquivo inválido mais próximo retorna `INVALID_INSTANCE_CONFIG`; não busca outra instância. Marker sintaticamente válido cuja raiz não é vault retorna `INVALID_DATA_ROOT` com `details.origin: marker.data_root`.

Comandos propostos:

```text
nextstep project plan --data-root <absolute-path> --instance-id <id> --profile-root <absolute-path> --json
nextstep project link --data-root <absolute-path> --instance-id <id> --profile-root <absolute-path> --json
nextstep project status [--data-root <absolute-path>] --profile-root <absolute-path> --json
nextstep project unlink --data-root <absolute-path> --profile-root <absolute-path> --json
```

`plan/status` são read-only. `link` escreve arquivo temporário e faz rename somente se o destino está ausente; arquivo existente idêntico é idempotente, divergente é conflito. `unlink` remove apenas arquivo cujo hash, instance ID e shape ainda correspondem ao registro local da instalação; no C-2, o registro de propriedade fica em `<profileRoot>/projects/<sha256(realDataRoot)>.json`. Dados e `.nextstep/` nunca são alterados.

### Contratos CLI exatos

| Rota | Modo | Opções |
|---|---|---|
| `project plan` | read-only | `--data-root` absolute required; `--instance-id` required; `--profile-root` absolute required; `--json` |
| `project link` | mutation local | mesmas opções; sem envelope de domínio |
| `project status` | read-only | `--data-root` optional; `--profile-root` absolute required; `--json` |
| `project unlink` | mutation local | `--data-root` absolute required; `--profile-root` absolute required; `--json` |
| `integration plan` | read-only | C-1 + `--workspace-root` absolute optional; `--manage-user-path` boolean |
| `integration link` | mutation local | mesmas opções do plan |
| `integration status` | read-only | C-1 + `--workspace-root` optional |
| `integration unlink` | mutation local | C-1 + `--workspace-root` optional; remove apenas recursos presentes no registro |
| `doctor` | read-only | contrato atual + `--integration` boolean; `--profile-root` e `--workspace-root` absolutos opcionais |

O parser CLI trata `--integration` e `--manage-user-path` como flags booleanas. Em `doctor --integration`, a rota de integração executa antes de `resolvePaths`; sem instância resolvida, retorna somente componentes de integração. `doctor` sem essa flag preserva o comportamento atual e exige data root/discovery.

## Skills e PATH

Estender `integration plan/link` com `--workspace-root <absolute-path>` e `--manage-user-path` (flag). `workspaceRoot` deve existir, não atravessar reparse point e conter `AGENTS.md`; no piloto sintético, arquivos são artificiais. O destino exato é `<workspaceRoot>/.agents/skills`, uma junction de diretório para `<productRoot>/skills`. O pai `.agents` pode existir; o destino precisa estar ausente ou ser o link gerenciado correspondente. Um diretório real, link externo ou registro adulterado é conflito e fica intacto.

O link da raiz inteira é intencional: cada skill permanece filha imediata de `skills`, referências acompanham a fonte e novas skills aparecem sem instalar de novo. O adaptador não cria links em `.codex/skills`, `.gemini/skills` ou `.gemini/antigravity/skills` no C-2, evitando duplicata. `workspaceRoot` aplica a mesma inspeção de raízes conhecidas de cloud sync; plan e doctor retornam `skills.cloudSyncWarning`, e outra máquina precisa recriar a junction. Unlink local continua suportado.

Diagnóstico lista todos os destinos. Duplicidade usa o campo `name:` do frontmatter, pois esse é o identificador descoberto pelo host documentado. C-2 congela um parser mínimo de Agent Skill: arquivo começa em byte zero com `---`, contém exatamente um `name` e um `description` escalares antes do `---` final, e `name` não vazio. Ele não interpreta o corpo. Skill inválida é reportada separadamente e impede integração healthy. C2-08 inclui mesmos nomes em diretórios diferentes e nomes diferentes no mesmo basename para provar que dirname não é usado.

`--manage-user-path` no Windows lê `HKCU\Environment\Path`, preserva tipo (`REG_SZ` ou `REG_EXPAND_SZ`) e texto original no journal/registro, compara segmentos case-insensitivamente após normalização e acrescenta exatamente `<profileRoot>\bin` quando ausente. Tipo ausente cria `REG_EXPAND_SZ`; tipo desconhecido falha. Usa `reg.exe` por argumentos, sem shell. Revalida o valor imediatamente antes de escrever e relê depois; mudança observável retorna conflito. Não existe compare-and-swap no `reg.exe`: uma escrita concorrente entre última leitura e escrita pode ser perdida, limitação explícita no doctor. Rollback só reescreve se o valor atual for exatamente o valor que Nextstep gravou; caso contrário preserva e pede recuperação. Broadcast/restart não é prometido: o resultado declara `newProcessRequired: true`. Unlink remove apenas o segmento exato gerenciado se registro e valor atual forem compatíveis; conteúdo concorrente é preservado ou gera conflito, nunca sobrescrito.

Testes de PATH usam hive/adapter sintético injetado, não HKCU real. Aplicação P-1 fará preview do valor real antes de qualquer escrita.

## Registro e transação

O schema C-1 `managedLinks` recebe `skill-root:workspace` com destino/source/raw target/ownership. Campos adicionais: `workspaceRoot`, `userPath` (`managed`, `segment`, `originalType`, `originalValueHash`) e `projects`. O C-2 preserva campos desconhecidos.

Todo rewriter parte do objeto completo lido e altera somente campos próprios conhecidos; campos desconhecidos no registro superior, itens existentes e projetos são preservados byte-semanticamente. Schema incompatível continua falhando fechado.

Uma única transação de integração cobre tool link, skill link, PATH e project config no plano aprovado. Journal registra precondições e operação inversa por etapa. Ordem de aplicação: tool link → skill link → project config → PATH por último. Em falha, recuperação não remove alvos; reverte somente itens criados cuja identidade ainda coincide. Unlink também possui journal, com ordem inversa: PATH → project config → skill link → tool link. Interrupção após remover PATH deixa journal `unlink_path_removed`; doctor reporta que skills continuam visíveis mas CLI pode exigir caminho absoluto, e indica `integration unlink` para retomar. Locks permanecem curtos e locais ao profile; projeto recebe lock exclusivo temporário ao criar/remover marcador.

## Diagnóstico

`nextstep doctor --integration --profile-root <...> [--workspace-root <...>] --json` funciona sem data root. Se a instância for resolvida, acrescenta saúde dos dados em seção separada. Componentes:

- executable: launcher/link/PATH/process PATH;
- product: raiz física, versão/hash observado, Node compatível;
- skills: source, workspace link, skills descobertas por manifesto, duplicatas e host evidence (`filesystem_only`, `host_listed`, `host_activated`);
- instance: origem (`argument`, `environment`, `marker`, `layout`), marker e data root;
- Holoself: disponível/indisponível pela CLI pública;
- recovery: journals/locks pendentes.

`healthy` da integração exige tool link, PATH persistido, workspace skill link e marcador válidos. `host_listed`/`host_activated` permanecem evidência separada; filesystem nunca promove esses estados. Holoself indisponível degrada contexto dependente, sem bloquear diagnóstico ou leitura sustentada por evidência já presente.

### Tabela de degradação

| Ausência/falha | Bloqueia | Ainda permite | Evidência doctor | Ação |
|---|---|---|---|---|
| Executável/link | comandos do motor | diagnóstico por entrypoint absoluto | `executable: unavailable/broken` | relink após resolver conflito |
| PATH persistido/processo | resolução por nome | entrypoint absoluto; link intacto | persisted/process separados | nova sessão ou reparar PATH |
| Skill link | descoberta orientada | CLI direta | `skills: unavailable` | criar/reparar junction |
| Skill duplicada/inválida | alegar integração healthy | diagnóstico e CLI | `duplicate`/`invalid_manifest` | remover conflito pelo proprietário |
| Marker inválido | seleção e mutação da instância | diagnóstico de integração | `instance: invalid` | corrigir via project link após conflito explícito |
| Dados inválidos | leitura/mutação de carreira | diagnóstico de integração | `data: invalid`, origem | reparar dados fora do instalador |
| Holoself indisponível | afirmações dependentes desse contexto | dados já autorizados e diagnóstico | `holoself: unavailable` | reparar CLI externa |
| Journal pendente | nova mutação de integração | status/doctor read-only | fase e ação de recuperação | retomar link/unlink |

## Testes C2-T

| ID | Cenário | Oráculo |
|---|---|---|
| C2-01 | marker na raiz e execução em subdiretório | origem `marker`, mesma instância |
| C2-02 | argumento, env, marker e layout diferentes | precedência exata; origem reportada |
| C2-03 | marker mais próximo inválido ou válido apontando para não-vault | inválido: `INVALID_INSTANCE_CONFIG`; não-vault: `INVALID_DATA_ROOT` + `origin: marker.data_root`; sem fallback |
| C2-04 | marker com data root diverso, escape, junction, anchors, aliases, tags, block scalars, boolean/null-like, chave duplicada | apenas gramática restrita e `data_root: .` são aceitos; demais falham |
| C2-05 | project link idempotente e conflito | arquivo idêntico preservado; divergente intacto |
| C2-06 | junction `.agents/skills` | alvo exato `<product>/skills`; referências e skill adicionada depois aparecem no filesystem sem relink; ativação `not_run`; cloud workspace gera warning |
| C2-07 | `.agents/skills` ocupado/adulterado | conflito/drift; objeto preservado |
| C2-08 | inventário com frontmatter name duplicado em dirs distintos, dirname igual com names distintos e manifesto inválido | duplicate usa `name`; inválido separado; integração não healthy |
| C2-09 | PATH REG_SZ/REG_EXPAND_SZ ausente/idempotente/presente com casing distinto | tipo preservado; um segmento; valor alheio preservado |
| C2-10 | PATH muda entre plan/apply e durante unlink | conflitos detectáveis preservam concorrência; janela TOCTOU residual reportada, sem alegação de CAS |
| C2-11 | interrupção em cada etapa de link/unlink | recuperação ou `recovery_required`; estado PATH-removido/skill-presente diagnosticado; canários intactos |
| C2-12 | `doctor --integration` sem data root; doctor normal sem vault; ausências de executable, skill, marker e Holoself | integração funciona sem resolver dados; doctor normal retorna DATA_ROOT_REQUIRED; causas/correções distintas, zero reparo |
| C2-13 | reconstruir `.nextstep/` sintético | marker/config e links persistem; dados intactos |
| C2-14 | sessão/processo novo sintético | comando resolve via PATH; cwd raiz/subdiretório resolve marker |
| C2-15 | host probe disponível | skill exatamente uma vez em listagem; caso indisponível é `not_run`, não suporte |
| C2-16 | registro contém campos desconhecidos | link/status/unlink preservam campos fora de sua propriedade |

Suíte completa, `npm run check`, `git diff --check`, hashes e ausência de leitura privada são obrigatórios. C2-15 não bloqueia contratos determinísticos, mas bloqueia declarar suporte ao host correspondente.

## Gate C2-G

C2-G passa o produto quando C2-R aprova e C2-01..14 e C2-16 passam em fixtures. A descoberta técnica de um host só recebe `passed` com C2-15 observado naquele host. Anti-Gravity permanece não suportado enquanto seu C2-15 estiver `not_run`. P-1 continua separado. Skills `nxt-*` e ativação comportamental permanecem C-3/C-4.
