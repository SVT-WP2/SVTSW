# Flows

How-tos for developers, for changes that touch more than one service: which services, Kafka messages, tables and
configuration files are involved, and what to change in each, in order. One file per flow, named
`<verb>-<object>.md`.

A flow links down: it names each piece and links to the docs of the service that owns it, and never restates how a
service works inside ([rules](../README.md#rules)). The terms are those of the [glossary](../glossary.md).

Start from the [system overview](../system-overview.md): it shows the services and the topics that a flow goes
through.

## Flows

| Flow | Question it answers |
|---|---|
| [add-asic-family-type.md](add-asic-family-type.md) | How do I add a new chip type to the system? |
| [register-wafer.md](register-wafer.md) | What happens, service by service, when a wafer is registered? |
| [run-svt-test.md](run-svt-test.md) | How does an SVT test go from its setup to its result? Only the first half is built |
| [add-kafka-message-type.md](add-kafka-message-type.md) | How do I add a message to the DB agent's contract, and who has to change? |

A flow is one of two kinds. A **change** flow (add a family type, add a message type) lists what a developer
changes, in order. A **process** flow (register a wafer, run a test) lists what the system does, in order, so that
a developer knows where to look.

## Template

```markdown
# <Flow name>

**Goal.** One sentence: what is true when the flow is done.
**Touches.** The services, with links to their docs.

## Before you start

What must already exist (data, configuration, access), and who decides it.

## Steps

| # | Service | What to change | Where (files, tables, messages) | Docs |
|---|---|---|---|---|
| 1 | | | | |

## Check

How to see it work end to end: what to send or click, and what to expect in each service.

## Pitfalls

What went wrong before, and how it showed.
```
