# C3-A — emenda de validação do host e suporte compartilhado

| Campo | Valor |
|---|---|
| Ciclo | C-3 |
| Estado | Aprovada e aplicada |
| Motivo | Falha observada no smoke e inviabilidade mensurável do corpus bloqueante |

## Achado de integração

O primeiro smoke do Codex confirmou a descoberta de `nxt-application`, mas a leitura de `../references/context.md` falhou porque as junctions individuais em `.codex/skills/<skill>` não expunham o diretório irmão `references`. A correção adiciona uma junction gerenciada `.codex/skills/references` para `<product>/skills/references`, com ID `support:codex:references` e `kind: skill-support`. Ela participa do mesmo journal, rollback, detecção de drift e unlink dos links de skill. Continua sem cópia.

O aceite C3-CX-01 passa a exigir três junctions Codex: `references`, `nxt-application` e `nxt-context`. A leitura de uma referência deve ocorrer pelo caminho relativo visto pela skill. Destino `references` ocupado, adulterado ou quebrado segue as mesmas regras fail-closed dos demais links. Objetos externos, inclusive `holoself`, permanecem preservados.

## Separação entre produto e runtime externo

O corpus congelado de 198 sessões mistura duas questões diferentes:

1. se o produto instala e expõe skills e referências corretas;
2. como uma versão/modelo externo seleciona e executa instruções probabilísticas.

O contrato do repositório diz que agentes são clientes externos e que Nextstep não lança nem coordena LLMs. O gate do produto deve provar a primeira questão e observar uma amostra delimitada da segunda, sem transformar um benchmark de modelos em requisito de instalação.

Os primeiros runs mediram aproximadamente 31 mil tokens de entrada por sessão Anti-Gravity e 12 mil a 75 mil por sessão Codex, dependendo da leitura de referências. Mesmo no limite inferior observado, 90 sessões por host excedem o teto original de 3,5 milhões de tokens antes dos 16 E2E. Portanto o desenho original é internamente inviável: cumprir o denominador viola o teto; cumprir o teto impede o denominador.

## Gate revisado

C3-G exige:

- revisão independente aprovada;
- C3-TR-01 e C3-CX-01..07, incluindo a junction de suporte;
- quick validation das duas skills;
- suíte determinística completa;
- sessão nova em cada host listando exatamente `nxt-context` e `nxt-application`;
- matriz 2 × 2 de smokes positivos: cada host executa um smoke de `nxt-context` e um de `nxt-application`, com leitura efetiva do `SKILL.md` e de pelo menos uma referência pelo caminho publicado;
- um smoke negativo por host, sem leitura de skill Nextstep, chamada `nextstep` ou mutação;
- uma sessão sintética guiada no primeiro host prepara e registra, pela skill e CLI pública, um pacote autorizado; uma sessão nova do segundo host lê a mesma fixture e confere IDs, revisões e hashes. Essa travessia comprova AC-08 no cliente externo;
- os demais invariantes C3-E2E-01..08 permanecem cobertos pelo motor/CLI em fixtures e processos novos; C3-E2E-07 inclui a travessia real acima e compara estado, não igualdade de prosa dos modelos;
- hashes antes/depois provando ausência de mutação nos smokes read-only.

O scanner, `doctor` e os probes de host classificam `references` como suporte sem `SKILL.md`, nunca como skill inválida. A listagem técnica continua exigindo exatamente `nxt-context` e `nxt-application`; C3-CX-01 e C3-CX-07 verificam essa distinção.

O corpus de 10 positivos + 5 negativos × 3 repetições por skill/host permanece como protocolo de caracterização de uma combinação host/modelo. Ele não bloqueia instalação ou os ciclos do produto. Quando executado, seu resultado deve informar denominador, versões e teto; não pode ser apresentado como propriedade determinística do Nextstep.

Essa mudança não reduz os limites de mutação, proveniência, snapshots, revisão ou privacidade. Ela move a evidência probabilística para a camada que a produz e mantém gates determinísticos para tudo que o produto controla.
