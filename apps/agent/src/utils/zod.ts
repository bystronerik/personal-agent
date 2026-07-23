import type { z } from 'zod'

/** Flattens Zod issues into one line, keyed by path, for error messages. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}
