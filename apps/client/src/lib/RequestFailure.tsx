import { Alert } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'

import { useDescribeError } from './errors'

export function RequestFailure({ error }: { error: unknown }) {
  const describeError = useDescribeError()

  return (
    <Alert color="red" icon={<TriangleAlert size={16} />}>
      {describeError(error)}
    </Alert>
  )
}
