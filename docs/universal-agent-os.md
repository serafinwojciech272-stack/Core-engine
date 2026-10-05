# M125+ Universal Agent Operating System

Core Engine now exposes a closed-loop Universal Agent Operating System above the M100 planner.

Runtime:
OBSERVE -> UNDERSTAND -> PLAN -> DECIDE -> APPROVE -> EXECUTE -> VERIFY -> MEASURE -> LEARN -> REPLAN -> RECOVER -> HANDOFF.

Stages 125-135:
- M125 runtime state machine
- M126 run ledger contract and immutable lineage digest
- M127 mission/capability orchestration boundary
- M128 memory/evidence loop
- M129 outcome measurement integration boundary
- M130 adaptive replanning
- M131 recovery-aware runtime
- M132 deterministic provider routing with fallback
- M133 run audit/lineage
- M134 control-plane handoff
- M135 closed-loop verification

Safety invariants:
1. No execution permission without explicit human approval.
2. Replanning revokes execution permission until approval is restored.
3. Recovery does not silently retry side effects.
4. Provider fallback is deterministic and availability-aware.
5. Every state transition increments revision and updates lineage.
6. Terminal verification checks approval integrity, lineage, evidence and outcomes.

The run ledger is represented by a typed runtime contract in this release. Durable external persistence remains a separate adapter boundary and must not bypass the existing governance controls.
