# P1-D — probe final do Codex Desktop

Estado: executado parcialmente; repetição após reinício do Codex Desktop é obrigatória.

## Ambiente e pré-condições

- Abrir uma nova tarefa local no projeto salvo `nextstep-sam`; não reutilizar esta tarefa do produto.
- Não usar worktree: o projeto privado não é repositório Git.
- Não alterar arquivos, PATH, links, configuração, registros ou contexto Holoself.
- O oráculo compara estado do filesystem e saída da CLI; uma alegação narrativa do agente não basta.

## Prompt da tarefa

> Valide esta instalação vinculada do Nextstep em modo estritamente read-only. Liste os nomes exatos das workspace skills que começam por `nxt-`. Use a skill apropriada para uma verificação geral de contexto/saúde, leia seu `SKILL.md` e pelo menos uma referência relativa. Execute somente `nextstep validate --scope structure` e reporte `status`, `valid` e os counts. Não crie, edite nem remova arquivos e não registre eventos. Termine com `SKILL_EVIDENCE: <nome>`.

## Oráculos

O probe passa somente se:

1. a tarefa nasce no projeto `nextstep-sam` e o host é Codex Desktop;
2. a lista contém exatamente `nxt-application`, `nxt-context`, `nxt-networking`, `nxt-opportunity` e `nxt-review`;
3. `nxt-context` é ativada e sua referência `references/validation.md` é lida pelo caminho publicado;
4. `nextstep validate --scope structure` retorna exit code zero, `status: ok` e `valid: true`;
5. hashes de `AGENTS.md` e `Candidatures/records/*` permanecem iguais ao snapshot P-1;
6. nenhuma nova entrada de audit, interação, submissão, outreach ou outcome aparece;
7. a tarefa termina com `SKILL_EVIDENCE: nxt-context`.

Qualquer skill ausente, fallback para leitura direta da fonte do produto, mutação, `not_run` ou execução fora do Codex Desktop mantém P1-G aberto.

## Execução observada

A nova tarefa Desktop listou exatamente as cinco skills, ativou `nxt-context` e leu `validation.md`, `integration.md` e `discovery-and-health.md`. O comando bare `nextstep` falhou porque o processo Desktop atual não contém o segmento recém-persistido no PATH.

Um diagnóstico complementar executou o launcher vinculado por `%LOCALAPPDATA%\Nextstep\integration\bin\nextstep.cmd`: exit code zero, `status: ok`, `valid: true` e counts esperados. A própria tarefa confirmou que o diretório não está no PATH do processo. Os 11 hashes de controle permaneceram idênticos após os dois turnos.

Conclusão: descoberta e ativação Desktop passaram; launcher e dados passaram; resolução pelo nome permanece pendente de reiniciar o aplicativo e repetir o prompt original em nova tarefa.
