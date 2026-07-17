# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues at
`deranalabs/arena-90`. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create -R deranalabs/arena-90 --title "..." --body "..."`.
- Read: `gh issue view <number> -R deranalabs/arena-90 --comments`.
- List: `gh issue list -R deranalabs/arena-90 --state open` with appropriate
  JSON, label, and state filters.
- Comment: `gh issue comment <number> -R deranalabs/arena-90 --body "..."`.
- Label: `gh issue edit <number> -R deranalabs/arena-90 --add-label "..."`.
- Close: `gh issue close <number> -R deranalabs/arena-90 --comment "..."`.

GitHub shares one number space across issues and pull requests. Resolve an
ambiguous reference with `gh pr view <number>` and then fall back to
`gh issue view <number>`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill operations

When a skill says to publish work to the issue tracker, create a GitHub issue.
When it says to fetch a ticket, read the complete issue and comments.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`.
- Child ticket: a GitHub sub-issue labelled `wayfinder:research`,
  `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Blocking: use GitHub native issue dependencies. If unavailable, put an
  explicit `Blocked by: #<number>` line in the child body.
- Frontier: open, unblocked, unassigned child issues in map order.
- Claim: assign the issue before work begins.
- Resolve: comment with the decision, close the issue, then append a short
  linked context pointer to the map's Decisions-so-far section.

Where GitHub sub-issues are unavailable, link children through a task list in
the map and put `Part of #<map>` in each child issue.
