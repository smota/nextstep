# C5-S — manutenção, drift e recuperação final

| Campo | Valor |
|---|---|
| Ciclo | C-5 |
| Entrada | C4-G |
| Estado | Aprovada e implementada |

C5 fecha a segurança operacional da instalação vinculada. O registro é a memória de ownership: diagnóstico não pode esquecer um link só porque sua fonte desapareceu, e unlink só remove destinos registrados cuja identidade ainda corresponde.

## Matriz obrigatória

- relink idempotente e incremento de novas skills sem recriar links existentes;
- colisão em tool, skill raiz, skill Codex e suporte `references`, preservando canário;
- junction adulterada ou retargeted retorna drift e bloqueia unlink;
- fonte/skill removida retorna broken, continua visível pelo registro e pode ser desvinculada sem percorrer o alvo;
- lock concorrente e journals interrompidos em tool, skill raiz, cada link Codex, PATH e unlink retomam ou revertem somente recursos próprios;
- PATH ausente, tipo preservado, alteração concorrente e remoção do segmento próprio;
- registry com extensões desconhecidas mantém bytes/campos conforme o contrato aplicável;
- unlink preserva fonte, workspace, dados, AGENTS, Holoself e canários externos;
- `doctor` distingue PATH persistido de PATH apenas disponível no processo e oferece correção acionável;
- suíte completa, quick validation, `npm run check` e `git diff --check` passam no candidato identificado.

Todos os casos usam fixtures sintéticas. C5 não acessa a instância privada. P1 só começa após revisão e QA independentes de C5.
