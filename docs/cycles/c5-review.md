# C5 — revisão independente

Estado: aprovado após correções.

A revisão encontrou quatro bloqueadores: perda de links registrados quando a raiz de fontes desaparecia; unlink parcialmente destrutivo antes de detectar drift; criação residual da junction `references` quando sua fonte não existia; e contrato machine-readable que marcava `id` e `owner_id` como sempre obrigatórios.

As correções preservam o inventário registrado, fazem preflight integral antes da remoção normal ou de recuperação, validam todas as fontes antes de qualquer mutação e representam `id` opcional e `owner_id` condicional. A revisão repetida não encontrou bloqueadores.
