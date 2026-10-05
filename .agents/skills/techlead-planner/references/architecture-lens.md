# Architecture lens

Used in step 6 to decide where new code lives and which dependencies it may create. Scale it to the change: a small edit inside an existing module needs one line, a new module needs all of it.

## Placement

Layers, innermost first: **entities** (rules that hold without any software), **use cases** (single application operations), **interface adapters** (controllers, presenters, gateways), **frameworks and drivers**. Source dependencies point inward, and an inner layer never names anything from an outer one. Data crossing a boundary takes the inner layer's form: plain request and response structures, never ORM rows or framework objects.

## Seven checks on the plan

| Question | If the plan says no |
|---|---|
| Can the business rules be tested without a database, web server, or framework? | Put ports in front of them and test at the use-case level. |
| Do all new imports point inward? | Invert the dependency with an interface owned by the inner layer. |
| Can persistence be swapped without touching the rules? | Move persistence behind a gateway. |
| Are use cases free of delivery details (HTTP, CLI, queue)? | Give use cases plain request and response models. |
| Is the framework confined to the outermost layer? | Wrap it and push it to the edge. |
| Is the component graph free of cycles? | Break the cycle with an interface or a new component. |
| Does one composition root construct the concrete classes? | Move construction to `main`. |

## Boundaries

A boundary buys the option to defer or swap a decision, and costs code. Draw one where volatility is likely. A partial boundary (a strategy or a facade) is enough when a full pair of ports costs more than the option is worth. A service is a deployment boundary, not an architectural one: services sharing one data model form a distributed monolith.

## Components

Only when the plan adds or splits deployable units. Group what changes together for the same reason. Keep the dependency graph acyclic, depend in the direction of stability, and keep stable components abstract.

## What the plan records

The layer of each module, the direction of each new import, and each new boundary with the volatility that justifies it. A hard-to-reverse choice (public contract, persistence, dependency strategy) is marked for an ADR.
