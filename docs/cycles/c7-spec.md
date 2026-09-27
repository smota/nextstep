# C7-S — perfil de candidato: fallback nativo que nunca duplica uma ferramenta externa

| Campo | Valor |
|---|---|
| Ciclo | C-7 |
| Entrada | C6 |
| Estado | Aprovada e implementada |

Hoje a única fonte de contexto "self" do Nextstep é uma chamada direta e fixa ao Holoself dentro de `buildContext`. Um usuário sem Holoself instalado recebe `packet.self: null` e o comando inteiro degrada. O pedido do usuário combinava duas necessidades: (1) o Nextstep deve suportar uma estrutura nativa simples de perfil de candidato, para quem não tem ferramenta externa; (2) quando uma ferramenta externa (Holoself hoje) gerencia o perfil, o Nextstep nunca deve exigir duplicar esse dado em um registro próprio.

Esta proposta veio de uma discussão genuína entre product owner e arquiteto, conduzida via Grok em modo somente leitura contra o repositório real, e foi reverificada linha a linha contra o código atual antes da implementação.

## Decisões fechadas

- **Arquivo singleton opcional, não uma nona coleção obrigatória.** `RECORD_TYPES` lista exatamente 8 coleções; `loadModel` falha fechado com `MODEL_INCOMPLETE` se qualquer uma faltar, e um teste fixa que não existe inicializador de compatibilidade. Uma nona coleção obrigatória quebraria todo vault existente, incluindo o vault real do usuário, até alguém adicionar manualmente um arquivo vazio. `Candidatures/records/candidate-profile.json` fica fora de `RECORD_TYPES`; ausência é válida e significa "sem cartão nativo".
- **Campos deliberadamente finos:** `display_name` (1-120), `target_roles` (1-5 strings, 1-80 cada), `positioning` (1-280), `flagship_facts` (0-5, opcional, 1-200 cada), `source_preference` (`auto`|`native`), `source_revision`. Voz, banco de histórias, alegações e evidências detalhadas continuam no Holoself; um campo de biografia transformaria isso em currículo, exatamente o que se recusa a hospedar.
- **Ordem de resolução (`resolveSelf`, `src/candidate-profile.mjs`):** `source_preference: "native"` responde sem nunca chamar o Holoself; senão o Holoself é sempre tentado primeiro e seu sucesso sempre vence; um cartão só é usado quando o Holoself não está instalado (`HOLOSELF_UNAVAILABLE`); qualquer outra falha do Holoself (configuração incompleta, timeout, saída malformada) permanece degradada mesmo com um cartão em disco — nunca mascara um Holoself mal configurado, e nunca lê o stderr do Holoself tentando adivinhar "não configurado".
- **Sem duplicação:** nenhum comando de importação/sincronização Holoself→nativo; criar um seria exatamente o caminho de duplicação que se busca evitar. O pacote de contexto ganha um campo `source` em vez de projetar o cartão nativo em caminhos de documento Holoself inventados — `skills/references/context.md` instrui o agente a nunca tratar uma lista de documentos vazia como permissão para inventar uma carreira.
- **Sem abstração de segundo provedor agora:** nenhum registro de plugins para zero ferramentas externas adicionais existentes hoje.
- **`doctor` ganha o check `candidateProfile`** (`activeSource: holoself|native|absent`). Um cartão nativo ativo sem Holoself instalado pode deixar `doctor` saudável — a menos que `NEXTSTEP_HOLOSELF_HOME` esteja explicitamente configurado, caso em que o Holoself continua obrigatório exatamente como antes.
- **Escrita via `mutate`/`extraOutputs`**, o mesmo mecanismo já usado para snapshots de artefato — lock, auditoria e journal se aplicam sem o arquivo entrar em `RECORD_TYPES`.

## Matriz obrigatória

- `resolveSelf`: preferência nativa nunca chama o Holoself, mesmo com o executável configurado e funcional;
- Holoself bem-sucedido sempre vence sobre um cartão em `auto`; nada é copiado para um registro do Nextstep;
- Holoself indisponível (`HOLOSELF_UNAVAILABLE`) com cartão presente retorna `source: "native"`, `documents: []`, status `ok`;
- Holoself indisponível sem cartão permanece `self: null`, degradado — comportamento inalterado;
- qualquer outra falha do Holoself permanece degradada mesmo com um cartão em disco, a menos que `source_preference: "native"`;
- `candidate-profile upsert` valida cada campo, aplica revisão otimista, e `--dry-run` não escreve nada;
- `doctor`: sem `NEXTSTEP_HOLOSELF_HOME`, cartão nativo ativo cobre a ausência do Holoself e o status geral fica saudável; com `NEXTSTEP_HOLOSELF_HOME` explícito, o Holoself continua obrigatório independentemente do cartão;
- `candidate-profile show`/`upsert` aparecem no catálogo, em `ROUTES`, em `capabilities()` e no texto de `help()`;
- suíte completa (`npm test`) passa no candidato identificado.

Todos os casos usam fixtures sintéticas; um executável Holoself falso é injetado via `HOLOSELF_EXECUTABLE` para tornar as branches de sucesso/falha determinísticas independentemente do Holoself real instalado na máquina de desenvolvimento. C7 não acessa a instância privada nem o Holoself real.
