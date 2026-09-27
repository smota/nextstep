# P1 — aplicação na instância privada

Estado: aplicação concluída; aceite final aguarda probe em nova tarefa do Codex Desktop.

O preview confirmou operações exclusivamente por junctions: launcher do perfil para `launchers/windows`, raiz Anti-Gravity para `skills`, cinco skills Codex e `references` para suas fontes no produto. Depois do link do produto, o preview do projeto autorizou apenas a criação de `nextstep.yaml`. Nenhuma skill ou ferramenta foi copiada.

O perfil foi vinculado, seu segmento foi persistido no PATH do usuário e a instância recebeu o marcador `nextstep-sam`. `integration status` e `project status` retornaram `linked`. Em um processo com o PATH persistido, `doctor --integration` retornou `healthy: true` e resolveu a instância pelo marcador.

`validate --scope structure` passou com os registros privados existentes. Onze hashes de controle, cobrindo `AGENTS.md` e todos os arquivos em `Candidatures/records`, permaneceram idênticos. Os três links Holoself existentes permaneceram apontando para sua fonte anterior.

Uma sessão nova do Codex CLI e um projeto novo do Anti-Gravity listaram exatamente as cinco skills `nxt-*` e ativaram `nxt-context` em uma tarefa read-only. O primeiro probe Anti-Gravity sem `--new-project` reutilizou cache anterior e listou zero skills; o projeto novo demonstrou que a instalação está correta e que sessões antigas precisam ser recarregadas. Uma invocação real a partir de `Candidatures/` resolveu a instância pelo marcador ancestral e retornou `healthy: true`.

O Codex Desktop recebeu uma tarefa nova na instância privada. Ela descobriu as cinco skills, ativou `nxt-context`, leu referências e validou a estrutura pelo launcher absoluto, sem alterar os 11 hashes de controle. O comando bare `nextstep` não resolveu porque o processo Desktop foi iniciado antes da atualização do PATH. O aceite final exige reiniciar o aplicativo e repetir esse ponto em uma nova tarefa.

A instância está em OneDrive; as junctions são locais à máquina e precisam ser recriadas em outro computador.
