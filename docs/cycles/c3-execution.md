# C3 — execução

Estado: aceito.

O adaptador Codex publica junctions individuais em `.codex/skills/<nome>` e uma junction de suporte em `.codex/skills/references`; o adaptador Anti-Gravity continua consumindo a raiz vinculada em `.agents/skills`. O inventário segue junctions de diretório sem atravessar links quebrados e `doctor --integration` verifica descoberta real por host.

A validação em sessões novas confirmou `nxt-context` e `nxt-application` nos dois hosts, ativação positiva, rejeição de prompt alheio e leitura das referências compartilhadas. Um handoff real registrou um pacote por um host e o releu pelo outro com uma dependência Holoself sintética. Esse ensaio revelou e corrigiu o contrato incompleto de `application-attempt register-package`.

O primeiro ensaio foi descartado quando detectou uma dependência real disponível; nenhuma evidência privada foi incorporada. A repetição usou apenas fixture sintética.
