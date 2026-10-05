# Usage examples

Ranges and product details are illustrative; use actual selected commits. Field labels in the caller's language work alongside the English ones.

## Notes for the technical team with a custom structure

```text
/release-notes notes for the technical team
Commits: v0.5.1..v0.5.2
Foco: confiabilidade e diagnóstico
Apresentação: sem ícones
Estrutura: problema, mudanças, evidências, limites
Idioma: português
```

## Notes for end-users with icons

```text
/release-notes notes v0.5.1..v0.5.2
Em inglês, com ícones e foco no valor para operadores.
Destaque o isolamento entre workspaces.
```

## Plain-text announcement

```text
/release-notes announce v0.5.1..v0.5.2
Para LinkedIn, em inglês, texto simples e até 180 palavras.
Contexto: queremos explicar por que rastrear vários agentes ficou
mais previsível. Termine com um convite para consultar a release.
```

## Changelog since the last release

```text
/release-notes changelog since last release
Brief, for end-users.
```

The agent names the tag it resolved. With no version tag reachable from HEAD, or when HEAD itself carries it, it asks where the scope starts.

## Executive summary of today's work

```text
/release-notes notes for executives
Work today. One paragraph on risk and adoption.
```

Only commits on the current branch dated today count; uncommitted changes are left out and a dirty working tree is mentioned.

## Default format and inherited evidence

```text
/release-notes after v2.4.0
Brief, without icons.
```

Follow-up in the same conversation:

```text
/release-notes notes for the technical team
Use the same commits. Focus on compatibility for SDK developers.
```

## Dates and supplied history

```text
/release-notes notes
Commits: main, January 1 through January 31, 2025, Europe/Brussels.
Use the repository already selected in this conversation.
```

Without repository access, supply the selected commit output with its repository and range. Additional focus text can explain intent, but cannot replace those commits.
