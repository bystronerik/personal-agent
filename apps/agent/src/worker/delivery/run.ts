import { runBrief } from '../../agent/orchestrator/agent'
import type { Budget } from '../../agent/shared/budget'
import { briefSessionId } from '../../agent/shared/session'
import { corpusProvider } from '../../sources/corpus'
import { markRun, type ScheduleDefinition } from '../scheduling/schedules'
import { deliverBrief, deliveredBefore } from './deliver'
import { recordDelivered } from './delivered'
import { buildBriefInput } from './input'
import { resolveRecipient } from './recipient'

/**
 * Sized for a scheduled run rather than left to the core's cautious default,
 * which exists for a caller that has not decided.
 */
const WORKER_BUDGET: Budget = { softLimitUsd: 0.2, hardLimitUsd: 0.4 }

/**
 * One fired occurrence, end to end. `markRun` lands *after* delivery on purpose:
 * a brief that was generated but never sent leaves `lastRunAt` untouched, so the
 * catch-up pass will retry it while it is still worth having.
 *
 * A send that failed *partway* is the exception: the reader already has the
 * opening chunks, so a retry would bill a second brief only to repeat them in
 * different words. That occurrence is recorded as run and the error still raised.
 */
export async function runScheduledBrief(
  schedule: ScheduleDefinition,
  now: Date,
): Promise<void> {
  const recipient = await resolveRecipient(schedule.userId)
  if (recipient.kind === 'skip') {
    console.warn(
      `[${schedule.id}] not delivering — ${recipient.reason}; no brief generated`,
    )
    return
  }

  const input = await buildBriefInput(schedule, now)
  const sessionId = briefSessionId(input)
  console.log(`[${schedule.id}] ${input.edition} brief starting — ${sessionId}`)

  const { brief, costUsd } = await runBrief(input, {
    sources: corpusProvider({ scheduleId: schedule.id }),
    budget: WORKER_BUDGET,
    sessionId,
  })

  let messages: number
  try {
    messages = await deliverBrief(brief, schedule.timezone, recipient)
  } catch (error) {
    const partial = deliveredBefore(error)
    if (partial > 0) {
      await markRun(schedule.id, now)
      console.error(
        `[${schedule.id}] delivery stopped after ${partial} message(s) — not retrying a brief already partly sent`,
      )
    }
    throw error
  }
  await markRun(schedule.id, now)
  const recorded = await recordDelivered(schedule.id, brief, now)

  console.log(
    `[${schedule.id}] delivered by ${recipient.kind} in ${messages} message(s), ${recorded} article(s) recorded — $${costUsd.toFixed(4)}`,
  )
}
