# C5 — execução

Estado: aceito.

A matriz final cobre relink incremental, colisões com preservação de canário, drift, fontes e raiz ausentes, rollback, journals interrompidos, concorrência, PATH e extensões do registry. Links quebrados continuam diagnosticáveis pelo registro e podem ser removidos sem percorrer o alvo. `doctor` distingue PATH persistido de PATH disponível somente no processo.

Evidência final do candidato: `npm test` passou com 98/98 testes; `npm run check` passou; `git diff --check` passou, com apenas avisos de conversão LF/CRLF; o hash de `bin/nextstep.mjs` permaneceu `d0f54c08cb4c0f1a545b6effbd37eed6622ae47246a3a8ed6fe3851a9780d5d0`. A aplicação real ainda revelou que skills externas inválidas para o parser interno degradavam a saúde Nextstep; o diagnóstico passou a delimitar o gate ao namespace gerenciado `nxt-*` e ganhou teste de regressão.
