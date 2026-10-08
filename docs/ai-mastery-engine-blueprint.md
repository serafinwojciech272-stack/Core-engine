# AI MASTERY ENGINE BLUEPRINT v1.0

## Mission

AI Mastery is a first-party learning, engineering, research, career and monetization system built on Core Engine AI.

It must serve two purposes at once:

1. Help one user become an expert AI builder.
2. Evolve into a credible public platform for people learning and building with AI.

The product is not a course catalog. It is an adaptive mastery system.

## Core loop

User -> profile -> assessment -> skill graph -> roadmap -> project -> evidence -> evaluation -> updated profile -> next action.

Core Engine remains the intelligence and control plane.

OpenRouter remains the model access and orchestration layer.

Supabase remains the durable application data layer.

## Product modules

- Mastery Profile
- Skill Graph
- Adaptive Roadmap
- Daily Master
- Weekly Review
- Project Lab
- Assessment Engine
- Evidence Ledger
- Research Monitor
- Career Strategist
- Monetization Engine
- Portfolio Builder
- Visualization Engine
- PDF / artifact generation
- Public AI knowledge layer

## Core Engine reuse

Reuse existing Core Engine capabilities wherever possible:

- universal AI router
- model intelligence and registry
- context engine
- memory / intelligence context
- skill intelligence
- skill learning
- policy and risk gates
- agent runtime
- tool runtime
- audit chain
- verification
- persistence
- SaaS identity and tenant isolation
- usage metering
- observability

Do not create a second AI engine.

AI Mastery is an adapter and product surface on top of Core Engine.

## OpenRouter strategy

Use OpenRouter through the Core Engine server boundary.

Never expose OPENROUTER_API_KEY to the browser.

Use structured outputs for machine-readable mastery state.

Use model routing for ordinary tasks.

Use escalation or multi-model verification for high-value assessments and roadmap changes.

Use OpenRouter web search and web fetch for current AI research, model releases, market changes and technology monitoring.

Use tool calling for future project agents.

Use image generation for optional visual artifacts and educational media.

Use provider routing and fallbacks to avoid binding the product to a single model.

Record model, provider, latency, token usage when available, routing mode and verification state.

## Mastery state

Every important user capability should have:

- skill id
- level
- confidence
- evidence count
- last verified
- target level
- gap
- prerequisites
- recommended next action

A skill is not considered verified because a user read material.

Verification requires evidence such as:

- assessment
- implementation
- project
- production result
- code review
- benchmark
- research synthesis

## Roadmap

The default strategic horizon is 2026-2031.

The roadmap is versioned.

Example:

ROADMAP v1.0
ROADMAP v1.1
ROADMAP v2.0

Every mutation records:

- version
- reason
- evidence
- impact
- changed stages

## Safety and control

Learning recommendations are low risk.

External side effects require Core Engine policy and human approval.

Never claim a project, deployment, certification or skill is complete without evidence.

Never fabricate live research.

Never expose secrets.

Never route browser traffic directly to OpenRouter.

## UX direction

The interface should feel like a professional AI control room, not an LMS.

Primary experience:

- one clear next action
- visible progress
- skill graph
- roadmap timeline
- evidence
- current blockers
- model / research provenance when relevant
- minimal cognitive load

Visual language:

- dark premium interface
- high information density with strong hierarchy
- responsive dashboard
- subtle motion
- accessible contrast
- data visualization
- command-center feel
- no decorative UI without information value

## Monetization direction

Do not monetize the first version aggressively.

First prove the system on real usage.

Potential future offers:

- free public AI learning navigator
- premium personalized mastery plan
- advanced AI engineering tracks
- project labs
- portfolio review
- research intelligence
- career intelligence
- team learning workspaces
- expert-grade AI engineering programs

Pricing decisions must follow measured retention and value.

## First production milestones

M1 Product shell and UX
M2 Mastery contracts and seed knowledge graph
M3 AI assessment
M4 Adaptive roadmap
M5 Evidence ledger
M6 Daily and weekly agent
M7 Research monitor with OpenRouter web tools
M8 Project lab
M9 Portfolio and career intelligence
M10 Monetization experiments
M11 Public knowledge layer
M12 Advanced multi-agent mastery orchestration

## Non-negotiable quality bar

The system must be:

- typed
- testable
- observable
- tenant-aware
- fail-closed for risky actions
- evidence-based
- model-agnostic
- deployable on the existing Core Engine runtime
- usable without requiring the user to understand the underlying architecture
