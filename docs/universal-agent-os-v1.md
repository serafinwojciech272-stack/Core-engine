# M125 Universal Agent Operating System v1

M125 introduces the runtime operating-system boundary above Universal Agent v2. It turns a plan into a governed run with an explicit state machine, append-only event lineage, integrity verification and adaptive replanning.

Runtime:
RECEIVED → UNDERSTANDING → PLANNING → AWAITING_APPROVAL → EXECUTING → VERIFYING → MEASURING → LEARNING → REPLANNING → PLANNING/HANDOFF/COMPLETED

Rules:
- real side effects remain behind explicit human approval;
- illegal state transitions are rejected;
- every transition creates an integrity-hashed event;
- run integrity covers identity, state, cycle, plan integrity and event count;
- replanning is only available after verification/measurement/learning;
- M125 does not create an alternate execution engine and does not bypass existing policy, mission or recovery gates.

M125 is the runtime contract. Persistence, provider routing and durable session recovery are subsequent layers and must reuse this state machine rather than create parallel orchestration.
