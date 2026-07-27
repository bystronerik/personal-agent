import { z } from 'zod'

/**
 * Deliberately carries no `.meta({ id })`: an id makes `z.toJSONSchema` emit a
 * `$ref` into `$defs`, and `apps/agent` feeds this schema to structured outputs,
 * which want the enum inline. The API names the component where it uses it.
 */
export const EditionSchema = z.enum(['morning', 'evening'])
export type Edition = z.infer<typeof EditionSchema>
