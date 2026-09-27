# C2-R — revisão independente

Claude Sonnet 4.6 Thinking via Anti-Gravity CLI, read-only, 2026-09-24. A primeira resposta terminou sem parecer após leitura; a continuação da mesma conversa forneceu `changes_required` com 13 achados. Nenhum dado privado foi fornecido.

## Resolução do parecer inicial

| ID | Resolução |
|---|---|
| F-01 | Skill `nextstep` declarada temporária no C-2, sem equivaler a `nxt-*`; duplicatas degradam e destinos externos são preservados. |
| F-02 | Gramática restrita linha a linha definida; anchors, tags, block scalars e valores YAML-like rejeitados. |
| F-03 | Marker válido em não-vault retorna `INVALID_DATA_ROOT` com origem explícita. |
| F-04 | REG_SZ/REG_EXPAND_SZ preservados; tipo desconhecido falha; janela TOCTOU de reg.exe explicitada e rollback condicionado. |
| F-05 | Unlink recebe journal e estado interrompido específico no doctor. |
| F-06 | Visibilidade filesystem separada de cache/ativação do host. |
| F-07 | Workspace em cloud sync recebe warning em plan/doctor. |
| F-08 | O revisor sugeriu dirname. CO mantém frontmatter `name`, conforme identidade documentada do host; C-2 congela parser mínimo e testes discriminantes, removendo dependência de C-3. |
| F-09 | Tabela completa de rotas, modos e opções adicionada. |
| F-10 | `doctor --integration` bifurca antes de `resolvePaths`; comportamento normal preservado. |
| F-11 | Rewriters preservam campos desconhecidos; C2-16 obrigatório. |
| F-12 | Tabela de degradação adicionada. |
| F-13 | Anti-Gravity permanece não suportado enquanto probe estiver `not_run`. |

## Reavaliação

`approved`. Os achados F-01 a F-13 foram encerrados na revisão 0.1. A única observação não bloqueante apontou que os exemplos de sintaxe omitiam `--profile-root`, embora a tabela normativa já o exigisse; os exemplos foram corrigidos antes da implementação.
