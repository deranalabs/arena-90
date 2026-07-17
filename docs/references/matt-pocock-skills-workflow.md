# Matt Pocock Skills Workflow

Status: Reference only
Reviewed: 2026-07-17

This note records the workflow defined by the upstream `mattpocock/skills`
repository. It does not override Arena90's approved product documents,
delivery roadmap, or repository instructions.

## Canonical flow

1. **Configure the repository once.** Install the skills, then run
   `setup-matt-pocock-skills`. Setup is an interactive repository change: it
   inspects the existing tracker and documentation, asks for the tracker and
   triage choices that are still unresolved, presents the proposed edits, and
   only then writes the agent configuration. Merely copying the skill files
   does not complete setup. ([README](https://github.com/mattpocock/skills/blob/main/README.md),
   [`setup-matt-pocock-skills`](https://github.com/mattpocock/skills/blob/main/skills/setup-matt-pocock-skills/SKILL.md))

2. **Use `ask-matt` as a router, not as a delivery stage.** It selects a flow
   based on the shape of the work. A codebase-scoped idea normally starts with
   `grill-with-docs`; a hard bug starts with `diagnosing-bugs`; a genuinely
   huge, foggy, multi-session effort starts with `wayfinder`.
   ([`ask-matt`](https://github.com/mattpocock/skills/blob/main/skills/ask-matt/SKILL.md))

3. **Resolve product ambiguity before implementation.** `grill-with-docs`
   combines a grilling interview with domain modeling so terminology and
   durable decisions are retained in the repository. `wayfinder` is the
   heavier alternative for work too large to understand in one session: it
   creates a map of decision tickets, resolves decisions rather than build
   deliverables, and hands the clarified result to `to-spec` when the route is
   visible. It is not a general-purpose task board.
   ([`grill-with-docs`](https://github.com/mattpocock/skills/blob/main/skills/grill-with-docs/SKILL.md),
   [`wayfinder`](https://github.com/mattpocock/skills/blob/main/skills/wayfinder/SKILL.md))

4. **Synthesize the agreed plan with `to-spec`.** This stage does not restart
   the interview. It converts the current conversation and codebase knowledge
   into a tracker-backed spec, uses the project's domain vocabulary, proposes
   the smallest/highest practical public testing seams, and confirms those
   seams with the user before publication.
   ([`to-spec`](https://github.com/mattpocock/skills/blob/main/skills/to-spec/SKILL.md))

5. **Turn the spec into approved tracer bullets with `to-tickets`.** Each
   ticket must be a narrow, complete, independently verifiable vertical slice,
   sized for a fresh context window and connected by explicit blocking edges.
   The user reviews granularity and dependencies before the tickets are
   published. Wide mechanical refactors use expand–migrate–contract instead of
   being forced into fake vertical slices.
   ([`to-tickets`](https://github.com/mattpocock/skills/blob/main/skills/to-tickets/SKILL.md))

6. **Implement one frontier ticket at a time.** `implement` drives TDD at the
   pre-agreed seams, runs focused checks during development and the full suite
   at the end, invokes `code-review`, then commits the completed ticket. The
   router recommends a fresh context for each ticket after the planning chain
   is complete.
   ([`implement`](https://github.com/mattpocock/skills/blob/main/skills/implement/SKILL.md),
   [`ask-matt`](https://github.com/mattpocock/skills/blob/main/skills/ask-matt/SKILL.md))

7. **Keep the implementation loop small.** The TDD source requires a confirmed
   public seam, then one failing behavioral test and the minimum passing
   implementation per vertical slice. It explicitly puts refactoring in the
   review stage rather than inside the red/green implementation loop.
   ([`tdd`](https://github.com/mattpocock/skills/blob/main/skills/tdd/SKILL.md))

8. **Review against two independent standards.** `code-review` first pins a
   fixed comparison point and locates the originating spec. It then runs
   Standards and Spec reviews independently and reports both axes without
   blending their severity. This is the ticket completion review, not an
   open-ended audit.
   ([`code-review`](https://github.com/mattpocock/skills/blob/main/skills/code-review/SKILL.md))

9. **Use `qa` for conversational issue intake.** QA listens to a user-reported
   problem, asks only necessary reproduction questions, learns the domain
   boundary, and files durable behavior-focused tracker issues. It is not a
   replacement for automated tests, code review, or a release acceptance run.
   ([`qa`](https://github.com/mattpocock/skills/blob/main/skills/qa/SKILL.md))

## Practical sequence for Arena90 Gates 1–5

The upstream workflow should wrap the existing approved gate roadmap, not
replace it:

```text
one-time repo setup
        ↓
ask-matt routes the current kind of work
        ↓
wayfinder only for unresolved cross-gate decisions
        ↓
grill-with-docs → to-spec → user-confirmed test seams
        ↓
to-tickets → user-approved vertical slices + blocking edges
        ↓
implement one unblocked slice → TDD → two-axis code review → commit
        ↓
repeat until each existing Gate 1–5 acceptance criterion has evidence
        ↓
QA intake for newly observed product defects; release validation remains separate
```

Consequently, a gate is not complete because a skill ran or code was committed.
It is complete only when Arena90's own approved acceptance evidence exists. The
skills provide work control, feedback loops, and review discipline; the Arena90
roadmap remains the source of truth for what must ship.
