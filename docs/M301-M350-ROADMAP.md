# M301-M350 Universal Agent OS

M301 Orchestration Kernel
M302 Mission Compiler
M303 State Machine
M304 Event Log
M305 Checkpoints
M306 Deterministic Replay
M307 Policy Compiler
M308 Approval Broker
M309 Permission Lease
M310 Execution Scheduler
M311 Sandbox Boundary
M312 Secrets Boundary
M313 Data Governance
M314 Privacy Control
M315 Tenant Policy
M316 Org Hierarchy
M317 Role Delegation
M318 Identity Trust
M319 Capability Security
M320 Threat Detection
M321 Anomaly Detection
M322 Rate/Cost Guard
M323 Resource Allocator
M324 Durable Queue
M325 Concurrency Control
M326 Dependency Resolver
M327 Plan Optimizer
M328 Tool Arbitration
M329 Model Arbitration
M330 Skill Arbitration
M331 Agent Routing
M332 Multi-Agent Coordination
M333 Conflict Resolution
M334 Consensus
M335 Evidence Graph
M336 Provenance
M337 Audit Ledger
M338 Incident Response
M339 Kill Switch
M340 Rollback
M341 Disaster Recovery
M342 Policy Simulation
M343 Shadow Mode
M344 Canary
M345 Production Promotion
M346 Certification
M347 Tenant Lifecycle
M348 Metering/Billing Hooks
M349 Command Center Telemetry
M350 Universal Agent OS Control Plane

Safety invariant:
POLICY -> APPROVAL -> EXECUTION PERMISSION -> EXECUTE -> VERIFICATION -> OUTCOME -> LEARNING

This block provides the typed control-plane foundation and explicit stage contract. External side effects remain behind approved runtime adapters and are not silently executed by these primitives.
