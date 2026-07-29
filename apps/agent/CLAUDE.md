# @personal-agent/agent

The brief worker and the agent core. Entry point: `src/worker/main.ts`. It loads the
delivery clients, starts one croner job for each enabled schedule, and reconciles the
job set against the table every 30 seconds.

## Scripts

| Script | Effect |
| --- | --- |
| `start:dev` | Run the worker. Add `--once <scheduleId>` to fire one schedule now and exit |
| `agent` | Run the orchestrator on the synthetic fixture. No database is necessary |
| `probe-corpus "<query>"` | Print what `search_news` returns for a query. Use it to separate a retrieval problem from a prompt problem |
| `seed-schedule --cron "0 7 * * *"` | Write a schedule row into an empty database |
| `eval` | Score the scorers against the good and hallucinated fixtures. Offline |
| `eval:models` / `eval:watch` | Run the layer evals against real models. These cost money |
| `test` | Vitest |
| `build` | `tsc`, then rolldown to `dist/main.js` |

## Structure

- `src/agent/` — the four agents: `orchestrator/` decides the order, and `research/`,
  `prediction/` and `summary/` are the specialists. `shared/` holds the blackboard that
  carries payloads between them, the USD budget pool, and the `AgentContext` type.
- `src/sources/` — `provider.ts` is the `SourceProvider` interface. `fixture.ts` reads
  an in-memory array; `corpus.ts` reads Postgres with a fused vector and full-text query.
- `src/worker/scheduling/` — reconcile, catch-up and overlap control.
  `src/worker/delivery/` — recipient choice, rendering, send, and the delivery record.
- `src/schema/`, `src/grading/`, `src/eval/`, `src/fixtures/` — the Zod output shapes,
  the deterministic checks, the evalite suites and their data.

## Gotchas

- `src/config.ts` splits the config on purpose. `loadAgentConfig` and
  `loadEmbeddingConfig` need no `DATABASE_URL`; `loadDatabaseConfig` and
  `loadDeliveryConfig` do. `src/config.test.ts` protects this split. Keep the evals and
  the unit tests able to run with no Postgres.
- `AgentContext.sources` has no default. Always pass a provider, or an eval can reach
  the real corpus.
- The worker and `apps/server` must receive the same `UNSUBSCRIBE_SECRET`. The worker
  signs the link and the API verifies it.
- `markRun` writes `lastRunAt` only after a successful delivery. Do not move it earlier;
  the catch-up pass needs the untouched value to retry.
- `pnpm agent` writes each brief to `.artifacts/`, which is gitignored.
