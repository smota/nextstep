# C1-R — revisão independente

Revisor: Claude Sonnet 4.6 Thinking via Anti-Gravity CLI, sessão nova read-only em 2026-09-24. O revisor recebeu somente arquivos do produto e foi instruído a não acessar dados privados. A primeira invocação falhou antes da revisão porque `--effort` não é suportado pelo modelo; a segunda, sem esse parâmetro, concluiu normalmente.

## Parecer inicial

Decisão: `changes_required` — cinco bloqueios e seis observações.

| ID | Severidade | Achado | Resolução do autor |
|---|---|---|---|
| F-01 | blocker | Cwd/data-root do smoke e arquivos do teste de rename ambíguos | C1-02 agora usa `capabilities` em cwd não-vault; C1-04 nomeia entrypoint e launcher, conteúdo e oráculo. |
| F-02 | blocker | Crash antes do registro poderia deixar junction temporária cujo installationId não fosse descoberto | Journal fixo `transactions/active.json` persiste ID e nomes antes de criar links. |
| F-03 | blocker | `unlink` de alvo ausente não pode depender de `realpath` | Contrato usa `lstat` + alvo textual de `readlink`; `realpath` é comparação adicional só para alvo existente. |
| F-04 | blocker | Sem tratamento explícito de volumes e cloud sync | Plano/diagnóstico reporta volumes; junction absoluta pode atravessar volumes quando suportada; profile sob cloud sync gera warning e deve ser recriado por máquina. |
| F-05 | blocker | C1-04 não identificava o arquivo nem como observar atualização | Entry point e launcher sintéticos recebem marcadores A/B por substituição via rename e são invocados pelo mesmo link. |
| F-06 | nonblocking | `installRoot` e `profileRoot` ambíguos | Removido `installRoot`; schema usa `profileRoot` e inventário `managedLinks`. |
| F-07 | nonblocking | Verificação de escape ambígua | Definida verificação de ancestrais físicos e exceção somente para o link final planejado. |
| F-08 | nonblocking | Erros e rotas precisam chegar atomicamente | Mantido como gate de implementação e command-contract tests. |
| F-09 | nonblocking | PATH mínimo não nomeava Node | C1-02 inclui diretório observado de `node.exe`. |
| F-10 | nonblocking | Preservação byte a byte duplicava oráculo | Gate referencia C1-14. |
| F-11 | nonblocking | Schema não tinha extensão para C-2/C-5 | `managedLinks` extensível e preservação de campos desconhecidos na mesma versão. |

Trecho final observado do parecer: F-02 e F-03 devem ser tratados em conjunto persistindo o ID antes do link temporário e lendo o alvo textual da junction para permitir remoção quando quebrada. Todas as correções acima foram incorporadas antes de C1-D.

## Reavaliação

Decisão: `approved`. O revisor confirmou F-01..F-11 resolvidos e apresentou quatro observações não bloqueantes:

| ID | Observação | Fechamento antes de C1-D |
|---|---|---|
| R-01 | Normalização de `readlink` não definida | Registro conserva `rawLinkTarget` exato e compara esse valor no unlink. |
| R-02 | `installRoot` ainda aparecia no response | Removido; response declara `binDestination = <profileRoot>/bin`. |
| R-03 | Journal concluído mas não removido era ambíguo | Journal recebe `phase: done`; reconciliação só tenta remover esse journal. |
| R-04 | Detecção de junction cross-volume não definida | A tentativa real de junction temporária é o probe; erro de filesystem/tipo/privilégio mapeia para unsupported com detalhe original. |

O revisor classificou as quatro como não bloqueantes e aprovou C1-S. As correções foram incorporadas antes da implementação para evitar ambiguidade deliberada.

## QA independente inicial

QA read-only em 2026-09-24: `failed`, apesar de `npm test` 51/51, `npm run check` e `git diff --check` passarem. Contraprovas sintéticas encontraram: registro adulterado removendo junction externa; profile root atravessando junction intermediária; unlink removendo junction cuja fonte física sofreu drift; ausência de validação Node 20+; modo incorreto no catálogo; ambiguidade de status/recovery; e cobertura incompleta de ausência de cópias/hardlinks e fases de falha.

O candidato foi corrigido antes de nova QA: destino do link precisa ser exatamente `<profile>/bin`; ancestrais reparse do profile são rejeitados; unlink consulta o estado e bloqueia drift físico; runtime Node 20+ é validado/reportado; link/unlink são mutações no catálogo; status permanece somente leitura conforme especificação corrigida; regressões cobrem registro externo, escape intermediário, drift físico, arquivo/junction desconhecido, falha após journal e inventário de arquivos/nlink.
