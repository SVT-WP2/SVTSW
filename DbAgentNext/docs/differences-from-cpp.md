# Differences from the C++ agent after the fork

**Closed on 2026-11-18. No log of differences is kept.** A change of this agent does not add a line here. The
pages of this folder describe the current state of the agent in full. If a comparison with the frozen C++ agent
is ever necessary, it can be made at that time from the two sets of docs
([decision](../../Documentation/decisions/2026-11-db-agent-next-only.md)).

This page keeps what it recorded between the fork of 2026-11-15, when the C++ agent was frozen
([fork note](../../Documentation/decisions/2026-11-db-agent-clone.md)), and the day it was closed.

## The baseline at the fork

What differed already on 2026-11-15:

- the behaviour decisions of [01](01-behaviour-decisions.md), §1 to §6;
- the contract: [`svt.db-agent-next.kafka.yaml`](../../Documentation/Kafka/svt.db-agent-next.kafka.yaml) against
  [`svt.db-agent.kafka.yaml`](../../Documentation/Kafka/svt.db-agent.kafka.yaml);
- migrations 1 to 4, which the C++ agent runs on unchanged ([02 §2](02-database-migration.md#2-what-migration-1-adds));
- the parity run of 2026-11-14: 189 cases the same, 193 different by a decision, 14 open
  ([03 §5.2](03-parity-testing.md#52-after-the-two-fixes-2026-11-14)).

## Changes from 2026-11-15 to 2026-11-18

| Date | Kind | Change |
|---|---|---|
| 2026-11-16 | behaviour | Open question 5 of [03 §5.1](03-parity-testing.md#51-first-run-against-the-c-agent-2026-11-14) decided: `UpdateWpMachineLoadedWafer` without `loadedWaferOrientation` stays a `BadRequest` ([01 §6.5](01-behaviour-decisions.md#65-wafer-probing-machines-probe-cards-projects)); the C++ agent stored `null`. The code of this agent did not change. |
