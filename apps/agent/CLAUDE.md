# `@personal-agent/agent`

The standalone brief worker: the framework-free agent core (schema, agents,
tools) and its eval harness, packaged as the app that runs on cron and delivers a
brief. See the [root CLAUDE.md](../../CLAUDE.md) for the constraints this exists
to satisfy — in particular that **the model drives control flow** and that the
**agent core imports no caller framework** (no NestJS, no HTTP server, no delivery
transport). Delivery is the worker's own job: a thin entry/wiring layer imports
`packages/telegram`, which the core never touches. That wiring is not built yet —
today the worker is exercised end-to-end by the `agent` dev script and the evals.

## Layout

```
src/schema/      Zod schemas, one narrow file each + barrel (source of truth),
                 including the bound constants the schemas are built from
src/llm/         client.ts owns the key, both SDK clients and env reads;
                 @openrouter/sdk transport for structured calls; model ids
src/agent/       shared/ (budget, blackboard, structured, run-context)
                 + prompts/ (fragments more than one agent needs)
                 + research/ prediction/ summary/ orchestrator/ — each an agent
                 with its own prompt
src/tools/       news search/fetch, as @openrouter/agent `tool()`s
src/grading/     checks.ts — scoring logic, imports no test framework
src/eval/        scorers.ts adapts grading/ to evalite; models.ts is the shared
                 fan-out/budget/context; *.eval.ts are the suites
                 (*.model.eval.ts run the model)
src/fixtures/    synthetic input + per-layer sample artifacts, as typed consts
src/scripts/     one-off dev CLIs (not part of any eval) + runScript
```

The worker has **no build** — it runs through `tsx`, and nothing imports it as a
library (it is top-of-graph, not a dependency), so `typecheck` already catches the
ESM mistakes a build would. The one barrel is `schema/index.ts`, where a single
import surface beats naming eight files at every call site; everywhere else
consumers import the module they mean.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm test` | `vitest run` — the unit tests (`*.test.ts`); `.eval.ts` files are not picked up. |
| `pnpm eval` | `evalite run scorers.eval.ts` — offline scorer regression, free, no key. |
| `pnpm eval:models` | `evalite run model.eval` — every `*.model.eval.ts`, across every model in `llm/models.ts`. Costs money. |
| `pnpm eval:watch` | Evalite watch mode + UI on `localhost:3006`. |
| `pnpm agent` | `src/scripts/agent-run.ts` — orchestrator end-to-end on the synthetic fixture, saving to `.artifacts/`. |

## The agent layer

Four agents, each a directory with `agent.ts` + `prompt.ts`:

- **`orchestrator/`** — `runBrief()`. Offers the other three as tools and decides
  the sequence. After the loop it runs a **guaranteed finalize**: any board slot
  still empty is filled directly, because a budget stop can halt the loop
  mid-pipeline and a valid `Brief` must still assemble. Order matters there —
  predict and summarize read the findings the research step leaves on the board.
  The finalize runs on `finalizeBudget`, not the run's own budget; see below.
- **`research/`** — a `callModel` loop over the news tools. It finishes by calling
  `record_findings`, whose *input schema is the findings shape*: the submission is
  SDK-validated and `hasToolCall('record_findings')` ends the loop cleanly, with
  no separate structured finalize call.
- **`prediction/`** and **`summary/`** — single no-tools structured calls through
  `shared/structured.ts`.

Each specialist also exports a `create*Tool(ctx)` returning the orchestrator-facing
tool. Those tools return a **compact digest** (counts and titles), not the payload
— the payload goes on the blackboard.

### The blackboard

`shared/blackboard.ts` is the typed hand-off store: `input` plus optional
`findings`, `prediction`, `summary`. The orchestrator model sequences the agents;
the blackboard carries the actual payloads so they never travel as
model-serialized tool arguments. `AgentContext` (`shared/run-context.ts`) bundles
`{ model, board, pool, budget, client }` so every agent's `run` signature is
uniform and each layer stays testable in isolation. The `client` is carried
rather than reached for, so a loop can be driven without an API key.

### The budget

`shared/budget.ts` keeps **one USD pool per brief**. Both the orchestrator's turns
and the nested research loop's turns fold into it via `onTurnEnd`, so the ceiling
bounds the whole run rather than any single loop — the SDK's own `maxCost` only
sees the current loop, which is why `budgetStop` exists alongside it.
`budgetStopWhen` is the trio every loop shares: global pool, per-loop `maxCost`,
`stepCountIs`.

Crossing the **soft** limit does not stop anything; `withBudgetNotice` attaches a
`notice` field to the specialist tools' digests. The nudge arrives as *data in a
tool result* rather than a mid-loop message injection, because the orchestrator
already reads tool results. The **hard** limit stops the loop.

`finalizeBudget` is what then lets a brief still assemble. Because `budgetStop`
closes over the shared pool, the condition that halted the orchestrator is
*already true* for every nested loop — so on the run's own budget the finalize
research would be stopped before its first turn and `runResearch` would throw.
`finalizeBudget` lifts the ceiling to `spent + reserveUsd` (default: half the
hard limit), giving that path room the loop cannot have consumed while the pool
keeps one honest total. `shared/budget.test.ts` asserts both halves. Note that
`runPrediction` and `runSummary` are single calls with no stop condition at all,
so the finalize can overshoot the reserve — a deliberate trade, since refusing to
run would lose the brief the finalize exists to save.

Default budget is a cautious `{ soft: 0.15, hard: 0.30 }`; a real caller passes
limits sized to the model and corpus.

### Two clients, deliberately

Both live in `llm/client.ts`, which owns the credential and memoizes each:

- the `@openrouter/agent` client, for the loops — narrowed to `LoopClient` on the
  way into `AgentContext`.
- the `@openrouter/sdk` transport, for single structured calls, reached only
  through `agent/shared/structured.ts` so the agents never touch transport
  directly. That seam re-exports the transport's own `StructuredRequest` rather
  than restating it.

## Structured output

`llm/` pairs the wire constraint with runtime validation so the shape asked for
cannot drift from the shape enforced. `ResponseSchema<T>` is `{ name, schema }`,
one Zod schema driving both directions.

`json-schema.ts` converts Zod via `z.toJSONSchema` and **strips bound keywords**
(`minLength`, `maxItems`, `format`, `minimum`, …) because strict mode rejects
them: the wire schema guarantees *shape* (fields, types, enums, valid JSON) and
Zod still guarantees *bounds* after parsing. This is not cosmetic — when it was
measured, stripping took one model from consistently-invalid JSON to consistently
valid, while another was unaffected either way.

The consequence is that **prompt prose is the only channel that carries a bound
to the model**, and Zod rejects a violation afterwards as a thrown decode error
rather than a retry. So the prose is not written by hand: `schema/` exports the
bounds as named constants (`STORY_COUNT`, `CONFIDENCE`, `MARKET_SUMMARY_LENGTH`,
`INSTRUMENT_LENGTH`, `MAX_HORIZON_DAYS`), the schemas are built from them, and
`agent/prompts/bounds.ts` renders the fragments the prompts interpolate from the
same constants. Widening a bound updates every prompt that states it.
`MAX_HORIZON_DAYS` is there too even though the schema cannot enforce it —
`resolvesAt` has no reference date to measure from — so the prompt and
`grading/checks.ts` at least agree by construction rather than by coincidence.

`decode.ts` tolerates a markdown-fenced response rather than failing, and raises
schema mismatches with the offending path.

`models.ts` holds `DEFAULT_MODEL`, `COMPARED_MODELS` (whose first entry is the
default), and `resolveModel(override?)` — the single override-then-`OPENROUTER_MODEL`-then-default rule.

## Tools

`tools/news.ts` exposes `search_news` and `fetch_article` over the in-memory
`SourceDoc[]` from the input. **Search deliberately withholds article bodies** —
ids, titles and timestamps only — so the model must decide which stories are
worth a fetch rather than being handed the whole corpus in one turn. `search_news`
is keyword-scored today; swapping in semantic search (embeddings + pgvector) is an
implementation change behind the same tool, and nothing else moves.

## Fixtures

Fixtures are **TypeScript modules exporting typed consts**, not JSON read at
runtime. Each parses itself with its own Zod schema at module load and carries a
`satisfies` annotation, so a mistyped key is a compile error and an out-of-bounds
value fails on import rather than mid-eval.

The payoff is comments: `brief-hallucinated.ts` annotates each deliberate defect
with the check in `grading/checks.ts` it trips, which the old `_note` blob could
only list in aggregate. Comments also cannot leak into a prompt the way a stray
data field can.

This applies to *hand-authored* fixtures only. Recorded tool-call responses do
not exist yet; when they arrive they stay JSON with a loader, since a machine
writes them and nobody hand-edits them. The per-layer fixtures (`findings-*`,
`prediction-*`, `summary-*`) are **derived** from the two `brief-*` fixtures
rather than re-authored, so each deliberate defect stays annotated in exactly one
place.

Fixtures are synthetic. Never fabricate real-looking reporting attributed to real
organizations.

## Grading and evals

`grading/` and `eval/` are split so the checks never import evalite. Scoring a
brief is domain logic the agent loop may want at runtime; the evalite adapter is
test-harness plumbing.

`grading/checks.ts` is one set of primitives composed into per-layer arrays —
`RESEARCH_CHECKS`, `PREDICTION_CHECKS`, `SUMMARY_CHECKS`, `BRIEF_CHECKS`.
`eval/scorers.ts` wraps each named check as an evalite scorer for its artifact
type.

Its number handling is the trickiest pure logic here, so `checks.test.ts` asserts
it directly: scale words, comma grouping, the deliberate asymmetry that lets a
source's "310 thousand" back prose written as "310,000" while still rejecting
"310 million", and the float drift `round` exists to absorb. The two documented
false positives (a rounded restatement, a derived figure) are asserted as
*accepted* — the eval only reports, so without these the parser has no gate.

The `*.model.eval.ts` suites run the model, each fed a **fixed upstream fixture**
so a layer is scored in isolation, and are what `pnpm eval:models` runs (filtered
by the `model.eval` substring). `trialCount` is set on the structured layer evals
because those JSON failures are intermittent — `temperature: 0` is not
deterministic across providers, so a single trial proves nothing.

`eval/models.ts` carries what all four suites share — `acrossModels()`, the
`LAYER_BUDGET` / `E2E_BUDGET` pair, and `layerContext(input, model)` for the
per-run pool, board and client.

`scorers.eval.ts` is the free offline guard: for every layer, if a hallucinated
fixture converges on its reference's score, that layer's scorers have stopped
discriminating and every model eval on it is meaningless.

## Config

`vite.config.ts` loads the repo-root `.env` via `envDir` — evalite does not read
`.env` on its own, and already-set variables still take precedence. `envPrefix`
must be set to `OPENROUTER_` because Vite only copies matching keys and defaults
to `VITE_`. That list also governs what a Vite *client* build would inline, so it
must stay Node-only secrets and this package must stay unbundled for the browser.

`evalite.config.ts` carries only the timeout, generous because `eval:models` fans
out across providers.
