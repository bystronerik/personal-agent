# `@personal-agent/agent`

The standalone brief worker: the framework-free agent core (schema, agents,
tools), its eval harness, and the long-running process that fires briefs on the
schedules in Postgres and delivers them. See the
[root CLAUDE.md](../../CLAUDE.md) for the constraints this exists to satisfy.

`src/worker/` is the **only** part that touches a caller's world — Prisma,
Telegram, croner, signals. Everything else here is reachable with no database,
no key, and no network, which is what keeps the core testable and the
non-negotiable ("the agent core imports no caller framework") true by structure
rather than by discipline.

## Layout

```
src/schema/      Zod schemas, one narrow file each + barrel (source of truth),
                 including the bound constants the schemas are built from
src/config.ts    loadAgentConfig — the OPENROUTER_* spec, validated by
                 @personal-agent/env
src/llm/         client.ts memoizes the one SDK client; the Zod↔JSON-Schema
                 pair (json-schema.ts, decode.ts); model ids
src/agent/       shared/ (budget, blackboard, structured, run-context, session)
                 + prompts/ (fragments more than one agent needs)
                 + research/ prediction/ summary/ orchestrator/ — each an agent
                 with its own prompt
src/tools/       news search/fetch, as @openrouter/agent `tool()`s
src/grading/     checks.ts — scoring logic, imports no test framework
src/eval/        scorers.ts adapts grading/ to evalite; models.ts is the shared
                 fan-out/budget/context; *.eval.ts are the suites
                 (*.model.eval.ts run the model)
src/fixtures/    synthetic input + per-layer sample artifacts, as typed consts
src/worker/      the long-running process — main.ts is wiring; runtime/ owns the
                 process lifecycle, scheduling/ the reconcile loop, delivery/ a
                 fired run; config.ts and db.ts sit at the top with main.ts
src/scripts/     one-off dev CLIs (not part of any eval) + runScript
```

Nothing imports the worker — it is top-of-graph, not a dependency — so
`typecheck` already catches the ESM mistakes a build would. The one barrel is
`schema/index.ts`, where a single import surface beats naming eight files at
every call site; everywhere else consumers import the module they mean.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm test` | `vitest run` — the unit tests (`*.test.ts`); `.eval.ts` files are not picked up. |
| `pnpm eval` | `evalite run scorers.eval.ts` — offline scorer regression, free, no key. |
| `pnpm eval:models` | `evalite run model.eval` — every `*.model.eval.ts`, across every model in `llm/models.ts`. Costs money. |
| `pnpm eval:watch` | Evalite watch mode + UI on `localhost:3006`. |
| `pnpm agent` | `src/scripts/agent-run.ts` — orchestrator end-to-end on the synthetic fixture, saving to `.artifacts/`. |
| `pnpm worker` | The scheduled worker. Long-running; needs Postgres and the `TELEGRAM_*` variables. |
| `pnpm worker --once <id>` | Fire one schedule immediately and exit — the whole delivery path without waiting for a cron hour. Run it in `apps/agent`; the root script goes through Turbo, which swallows the flag. |
| `pnpm seed-schedule --cron "0 7 * * *"` | Write a schedule row (`--timezone`, `--edition`, `--user` optional), until the admin API owns them. Re-running **rewrites** the row for that `(user, edition)` rather than adding a second one that would bill every brief twice. |

**`worker` is deliberately not called `dev`**, so root `pnpm dev` starts the API
and the portal without also starting paid LLM scheduling.

## The worker

`src/worker/main.ts` is the long-running process, and past boot it is *only*
wiring — every piece it assembles is a module with no module-level state, so each
is drivable in a test. **croner owns the scheduling** — pattern parsing, timezone
and DST arithmetic, firing, and error containment (`catch`) — so the only
scheduling logic here is keeping the live job set equal to what the `schedules`
table says. Four consequences worth knowing before changing any of it:

- **There is no `nextRunAt` column, and no due-check query.** croner holds the
  jobs in memory, so nothing outside the process can answer "when is my next
  brief?" — a mistyped pattern that fires every minute bills real money, and
  nothing prints its next fire to warn before the bill. The no-restart edit path
  (a row changed in `db:studio` takes effect with no boot) is the one with no
  warning at all, so watch reconcile output when editing a pattern.
- **`scheduling/pass.ts` runs on a timer** (`*/30 * * * * *`, croner's six-field
  form, armed by `scheduling/reconciler.ts`), so a row edited in `db:studio`
  takes effect within half a minute and no restart. A row is rebuilt only when
  its `cron|timezone|edition` fingerprint changes — **`lastRunAt` is excluded on
  purpose**, since a run writes it and rebuilding on that would reset the
  pattern's phase on every fire.
- **Overlap protection is the worker's, not croner's.** `protect` sees only the
  job it is set on, and the catch-up pass fires the same schedule from outside
  it, so a boot catch-up could overlap the live job on an hourly pattern and bill
  the brief twice. `scheduling/run-occurrence.ts` keeps one `running` set
  instead, and both paths go through the single instance `main.ts` hands them.
  It also folds in the shutdown `track`, so a new fire site cannot forget it and
  silently discard a paid brief.
- **A single instance is assumed.** That guard is per-process, so two replicas
  would each fire every schedule.

`scheduling/schedules.ts` parses each row and **drops a bad one with a log rather than
throwing**: one typo must not cost every other schedule its briefs, and because
the parse re-runs each reconcile, fixing the row is enough. It remembers what it
last said about each row, so a broken one is reported when it breaks and when the
problem *changes* — not every half minute, which would bury the lines that mean
something. The `edition` column is a plain string in Postgres, so that parse is
the only thing between a typo and a run that cannot assemble a brief.
`scheduling/pattern-checks.ts` holds the two refinements it uses; `isTimeZone`
exists because croner accepts an unknown `timezone` *silently* — an invalid zone
would fire at some unintended hour instead of being rejected.

### Missed runs

croner does not catch up on its own, so `scheduling/catch-up.ts` compares a
schedule's last occurrence against `lastRunAt` and fires once if the gap is
inside `CATCHUP_GRACE_MINUTES` (45, with the predicate, in
`scheduling/missed-run.ts`). A 07:00 brief arriving at 07:40 is worth having;
the same brief at noon is worse than none. Its `now` is a **function**, not a
`Date`, and read once per iteration: a brief takes minutes, so a clock hoisted
out of the loop would measure the window from a moment already past.

**That comparison is what makes catch-up idempotent**, and it is the only reason
this is safe to leave on: a run writes `lastRunAt` *after* the occurrence it was
for, so restarting the worker all day cannot re-fire the same occurrence. Without
it, every restart would bill another brief. Two details keep that true:

- **The floor is `lastRunAt ?? createdAt`.** A row seeded at 07:20 has never run,
  and would otherwise count the 07:00 that passed before it existed as missed —
  billing a brief nobody asked for on the first `pnpm worker`.
- **`previousOccurrence` (`scheduling/occurrences.ts`) adds a second before
  asking croner.** `previousRuns`
  searches back from a whole second *earlier* than the moment it is given, so a
  worker booting at 07:00:00 would read *yesterday's* 07:00, decide nothing was
  missed, and silently skip the day's brief.

Catch-up runs on **the reconcile timer, not only at boot** — a delivery that
fails at 07:00 is retried while the brief is still worth having, which is the
whole point of the grace window and the reason `packages/telegram` fails a long
rate-limit fast instead of parking. Because a failed run leaves `lastRunAt`
untouched, that would re-fire every half minute, so
`scheduling/catch-up-ledger.ts` bounds it: `CATCHUP_ATTEMPTS` (3) tries per
occurrence, `CATCHUP_RETRY_MINUTES` (5) apart.

`markRun` — the one write in `scheduling/schedules.ts` that `delivery/run.ts`
calls — lands **after** delivery for the mirror-image reason: a brief that was
generated but never sent leaves `lastRunAt` untouched, so catch-up retries it.
**A send that failed partway is the exception** — `PartialSendError` says how many
chunks are already in the chat, and a retry would bill a second brief only to
repeat them in different words, so that occurrence is recorded as run and the
error raised anyway.

### Shutdown

`runtime/shutdown.ts` stops the jobs, awaits whatever is in flight, then
disconnects — there is no `process.exit`, so the event loop drains on its own and
a signal mid-brief finishes and delivers the run instead of discarding something
already paid for. `runtime/signals.ts` installs the handlers with `once`, so a
second signal takes the default path. Four things that look incidental are not:

- **The handlers are installed before the first paid run**, boot catch-up and
  `--once` included. `main.ts` therefore calls `listenForShutdown` *above* the
  `--once` branch, leaving one install site in the codebase: registering per
  branch — the obvious reading order — is exactly the window where a rolling
  restart discards a brief already paid for.
- **A `stopping` flag, not just `stopAll()`.** A reconcile pass awaiting Postgres
  when the signal lands would otherwise resume against an emptied registry, read
  every row as new, and re-arm every job the shutdown had just stopped.
- **It is `stopping()`, a predicate, not a boolean field.** Four modules read it
  across two folders, and a function is what leaves nothing to snapshot: a
  destructured copy still reads the one flag. It is required on every deps type
  that reads it and never defaulted, since `() => false` would disable the guard
  with no compile error — the same argument as `sessionId` on `AgentContext`.
- **The signal handler catches.** `shutdown` disconnects Postgres, which can
  reject if the connection is already gone; unhandled, that turns a clean drain
  into a crash exit.

And the reason `worker` is the one script launched as `node --import tsx/esm`
rather than through the `tsx` CLI: **the CLI runs the program in a child process
and exits 143 the moment it forwards a signal**, cutting the drain off mid-brief
and reporting a crash to the supervisor. `--import` runs it in *this* process, so
the handlers above are the ones that decide when it stops. Measured, not
theorised: under the CLI a handler's own `setTimeout` never fires.

### The corpus seam

`delivery/input.ts` is where a fired run gets its `BriefInput`, and it still returns the
**synthetic fixture**: only `edition` and `asOf` come from the schedule. Live
retrieval is its own change with its own eval. Nothing downstream reaches past
this function for a corpus, so replacing it moves nothing else.

`delivery/format.ts` renders a `Brief` as **plain text** — `splitMessage` packs at
paragraph boundaries with no notion of markup, so a chunk boundary inside an
entity would leave a tag unclosed and Telegram would reject that chunk, which is
also why delivery sets no `parse_mode`. The prediction carries its
not-financial-advice line in the delivered text. Two things it must not drop:

- **`sourceIds`, on every headline.** The schema makes at least one mandatory and
  search withholds article bodies precisely so the model has to cite; a rendering
  that omits them makes an invented headline indistinguishable from a fetched one
  in the only artifact a human reads.
- **The day a prediction resolves.** `IsoDateTime` is a `Date.parse` refinement
  and the `format` keyword is stripped from the wire schema, so `resolvesAt` may
  arrive date-only. `Date.parse` puts that at UTC midnight, and projecting it into
  a negative-offset zone would print the day *before* the model committed to — so
  a date-only value is formatted in UTC and only a real instant gets the
  schedule's zone.

`delivery/deliver.ts` memoizes the Telegram config and `main` calls it **first**,
so a missing token fails while someone is watching rather than at 07:00 tomorrow
with a paid brief already generated. It is also the only module allowed to name
grammY's `PartialSendError`: `deliveredBefore` exists so that type never travels
up into `delivery/run.ts`.

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
the blackboard carries the payloads so they never travel as model-serialized tool
arguments. `AgentContext` (`shared/run-context.ts`) bundles `{ model, board,
pool, budget, client, sessionId }` so every agent's `run` signature is uniform
and each layer stays testable in isolation. The `client` is carried rather than
reached for, so a loop can be driven without an API key.

### The budget

`shared/budget.ts` keeps **one USD pool per brief**. Both the orchestrator's turns
and the nested research loop's turns fold into it, so the ceiling bounds the whole
run rather than any single loop — the SDK's own `maxCost` only sees the current
loop, which is why `budgetStop` exists alongside it. `meterLoop` is what every
loop wires: it carries the stop-condition trio (global pool, per-loop `maxCost`,
`stepCountIs`) and meters the turns that feed the pool they read.

**Metering takes three points, because none of them sees a whole loop.**
`callModel` fires `onTurnEnd` only after a *follow-up* request, so it covers
every turn but the loop's initial one — wiring the pool to it alone silently
dropped one turn per loop, under-reporting every run. The initial turn does
reach the `steps` a stop condition is handed (it is how `maxCost` sees it), but
only once a follow-up has been made; and a loop that never iterates has no steps
at all, so `meter.settle(result)` after the loop reads that turn off the final
response. The metering condition is ordered ahead of `budgetStop` so the pool is
current before the ceiling is read.

Crossing the **soft** limit does not stop anything; `withBudgetNotice` attaches a
`notice` field to the specialist tools' digests. The nudge arrives as *data in a
tool result* rather than a mid-loop message injection, because the orchestrator
already reads tool results. The **hard** limit stops the loop.

`finalizeBudget` is what then lets a brief still assemble. Because `budgetStop`
closes over the shared pool, the condition that halted the orchestrator is
*already true* for every nested loop — so on the run's own budget the finalize
research would be stopped before its first turn and `runResearch` would throw.
`finalizeBudget` lifts the ceiling to `spent + reserveUsd` (default: half the
hard limit), giving that path room while the pool keeps one honest total;
`shared/budget.test.ts` asserts both halves. `runPrediction` and `runSummary`
have no stop condition at all, so the finalize can overshoot the reserve — a
deliberate trade, since refusing to run would lose the brief it exists to save.

Default budget is a cautious `{ soft: 0.15, hard: 0.30 }`; a real caller passes
limits sized to the model and corpus.

### One client

`llm/client.ts` memoizes the single `@openrouter/agent` client and reads the key
through `loadAgentConfig()`, narrowed to `LoopClient` on the way into
`AgentContext`. Every model call goes through `callModel` — the tool-using loops
and the no-tools structured transforms alike, the latter via
`agent/shared/structured.ts`, which passes `text.format` (the Responses-API
spelling of a `json_schema` response format) and no tools. So no agent reaches
for a client, and all four are drivable in a test without a key.

**Cost is read from the response there, not from `onTurnEnd`.** The SDK fires
`onTurnEnd` only after a *follow-up* request; a call with no tools never makes
one, so wiring the pool to it would silently record nothing.

### Session ids

Every `callModel` request carries a `sessionId` (`session_id` on the wire), so
OpenRouter files a whole run under one id — the orchestrator's turns, the nested
research loop's, and the two structured calls — instead of a pile of unrelated
generations. `callModel` spreads anything that is not one of its own control
fields into the request body, and every follow-up turn rebuilds from that same
object, so one field per call site covers a whole loop. It rides on
`AgentContext` as a **required** field for the same reason `client` is carried:
two places build a context, and required is what stops a new agent path from
quietly dropping the id. The finalize path inherits it by spreading `ctx`.

`shared/session.ts` holds one recipe per kind of run — slugified parts plus a
random suffix, capped at OpenRouter's 256 characters, truncating description
before the suffix. The descriptive parts are there to be *read*; the suffix is
what makes an id unique, and it is not cosmetic: `pnpm agent` replays one fixture
with a fixed `asOf`, so without it every local run would share a session.

- `briefSessionId(input)` — `brief-<edition>-<asOf>-…`, used by `runBrief`'s
  default and by a caller that wants the id *before* the run rather than off
  `BriefRun`. `RunBriefOptions.sessionId` overrides it, which is how the worker
  will pass its own run id.
- `evalSessionId(layer, trial)` — `eval-<layer>-t<trial>-…`, with **no model in
  it**: OpenRouter files the model against every generation anyway. Its suffix is
  twice as long to compensate, since two models on one layer and trial then differ
  by suffix alone.

**It is also a routing key.** OpenRouter pins a session's requests to one
provider to maximise prompt cache hits, so a brief's turns — which share a long
corpus prefix — should get cheaper, while a run can also be held on a provider
that is not the hour's cheapest. Hence a fresh id per eval layer, model and trial
rather than one shared across them: the runs being compared stay independent.
Provider choice affects strict-JSON behaviour, so a structured layer whose score
moves without a prompt change is worth suspecting pinning for.

## Structured output

`llm/` pairs the wire constraint with runtime validation so the shape asked for
cannot drift from the shape enforced. `ResponseSchema<T>` is `{ name, schema }`,
one Zod schema driving both directions.

`json-schema.ts` converts Zod via `z.toJSONSchema` and **strips bound keywords**
(`minLength`, `maxItems`, `format`, `minimum`, …) because strict mode rejects
them: the wire schema guarantees *shape* (fields, types, enums, valid JSON) and
Zod still guarantees *bounds* after parsing. Not cosmetic — measured, stripping
took one model from consistently-invalid JSON to consistently valid, and left
another unaffected.

The consequence is that **prompt prose is the only channel that carries a bound
to the model**, and Zod rejects a violation afterwards as a thrown decode error
rather than a retry. So the prose is not written by hand: `schema/` exports the
bounds as named constants (`STORY_COUNT`, `CONFIDENCE`, `MARKET_SUMMARY_LENGTH`,
`INSTRUMENT_LENGTH`, `RATIONALE_LENGTH`, `MAX_HORIZON_DAYS`) — **every** bound, or
the model is never told: `rationale` was once an inline `.max(600)` with no
fragment and no line in the prompt, and the only sign was one model failing the
eval on length it had no way to know about. The schemas are built from them, and
`agent/prompts/bounds.ts` renders the fragments the prompts interpolate from the
same constants. Widening a bound updates every prompt that states it.
`MAX_HORIZON_DAYS` is there too even though the schema cannot enforce it —
`resolvesAt` has no reference date to measure from — so the prompt and
`grading/checks.ts` at least agree by construction rather than by coincidence.

`decode.ts` tolerates a markdown-fenced response rather than failing, and raises
schema mismatches with the offending path.

`models.ts` holds `COMPARED_MODELS` (whose first entry is
`DEFAULT_OPENROUTER_MODEL`) and `resolveModel(override?)` — the single
override-then-`OPENROUTER_MODEL` rule, the default now living on the variable's
schema rather than here.

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
with the check in `grading/checks.ts` it trips, and a comment cannot leak into a
prompt the way a stray data field can. The per-layer fixtures (`findings-*`,
`prediction-*`, `summary-*`) are **derived** from the two `brief-*` fixtures
rather than re-authored, so each defect stays annotated in exactly one place.

This applies to *hand-authored* fixtures only. Recorded tool-call responses do
not exist yet; when they arrive they stay JSON with a loader, since a machine
writes them and nobody hand-edits them.

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
so a layer is scored in isolation. `trialCount` is set on the structured layer
evals because those JSON failures are intermittent — `temperature: 0` is not
deterministic across providers, so a single trial proves nothing.

`eval/models.ts` carries what all four suites share — `acrossModels()`, the
`LAYER_BUDGET` / `E2E_BUDGET` pair, `layerContext(input, model, sessionId)` for
the per-run pool, board and client, and `reportingPerModel(layer, task)`, which
every suite wraps its task in. Evalite reports one averaged score per *file* and a
failed task raises a stack naming the layer but not the model, so without it a red
run says only *that* something failed — the `PASS`/`FAIL` line per model and trial
is how you read one without rerunning it. It also mints the run's session id and
prints it on that line — since the id names no model, that line is the only place
the two are written together, and so the only way back from an OpenRouter session
to the result it produced.

`scorers.eval.ts` is the free offline guard: for every layer, if a hallucinated
fixture converges on its reference's score, that layer's scorers have stopped
discriminating and every model eval on it is meaningless.

## Config

`src/config.ts` is where the **core** reads the environment:
`loadAgentConfig()` selects `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from
`@personal-agent/env` and validates both through the shared `loadEnv`, so a
missing key and a malformed model id are reported together, keyed by their real
variable names. It is called lazily — from the memoized client factories and from
`resolveModel()` — so importing the agent core never requires a key, and
`resolveModel(override)` short-circuits before the load.

`src/worker/config.ts` is the worker's own, selecting `DATABASE_URL` alone — kept
separate so importing the core still requires no database. The `TELEGRAM_*`
variables stay in `packages/telegram`'s loader; the worker never re-declares
them.

`vite.config.ts` loads the repo-root `.env` via `envDir` — evalite does not read
`.env` on its own, and already-set variables still take precedence. `envPrefix`
must be set to `OPENROUTER_` because Vite defaults to `VITE_`. That list also
governs what a Vite *client* build would inline, so it must stay Node-only
secrets and this package must stay unbundled for the browser.

`evalite.config.ts` carries only the timeout, generous because `eval:models` fans
out across providers.
