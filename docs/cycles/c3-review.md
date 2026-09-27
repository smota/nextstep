# C3-R — revisão independente

Claude Sonnet 4.6 Thinking via Anti-Gravity CLI, read-only, 2026-09-24. Parecer inicial: `changes_required`, com três bloqueantes, três importantes e três observações low.

| ID | Resolução do coordenador |
|---|---|
| F-01 | A premissa do achado não se aplica ao gate fechado: C2 observou Anti-Gravity `host_listed = passed`. C3 agora exige converter o Codex para passed antes do corpus e mantém o gate aberto se qualquer host falhar/not_run; não aceita fechamento por um host só. |
| F-02 | Adicionado contrato completo do adaptador Codex: mesmas rotas públicas, seleção `nxt-*`, IDs/shape do registry, ordem transacional, erros e C3-CX-01..07. |
| F-03 | C3-D1 passa a mover referências, criar as duas skills e remover a antiga como uma mudança candidata anterior a D2; C3-TR-01 bloqueia smoke com resíduos/duplicates. |
| F-04 | Todas as onze referências receberam destino ou adiamento explícito; entities/interactions entram em application, strategies/experiments ficam para C4. |
| F-05 | Regra de precedência por ApplicationAttempt/pacote/evento adicionada; CTX-P07 e APP-P03 congelam os dois lados da sobreposição. |
| F-06 | C3-E2E-01..08 têm cenários e oráculos por hash/estado e são obrigatórios por host. |
| F-07 | Volume revisto para 198 sessões, teto de 3,5 M tokens/6 h e gate aberto se o teto interromper a bateria. |
| F-08 | Profile root é fornecido na fixture; fora dela a skill pergunta e não adivinha. |
| F-09 | Handoff em sessão e C3-E2E-08 adicionados. |

## Reavaliação

`approved`. O revisor confirmou F-01 a F-09 como fechados, sem novo achado bloqueante, importante ou low. Preconditions registradas: C2-G passed; C3-TR-01 antes de D2; corpus congelado; ambos os hosts precisam de `host_listed = passed` antes das respectivas baterias e para fechar C3-G.

## Revisão da emenda C3-A

A emenda que separa o gate determinístico do produto da caracterização probabilística do host recebeu `approved` após uma rodada `changes_required`. O texto final exige smokes positivos e negativos nos dois hosts, leitura real de referências, suíte determinística e um handoff mutação/leitura entre hosts. O corpus extenso permanece caracterização externa e não é usado como prova determinística do produto.
