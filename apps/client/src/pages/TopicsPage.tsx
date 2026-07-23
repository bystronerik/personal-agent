import {
  Alert,
  Button,
  Card,
  CloseButton,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CreateTopicSchema } from '@personal-agent/schemas/topics'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import {
  getListTopicsQueryKey,
  useCreateTopic,
  useDeleteTopic,
  useListTopics,
} from '../generated/api/topics/topics'
import { ApiError } from '../lib/api-fetcher'

const describe = (error: unknown): string =>
  error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong'

const notifyFailure = (title: string) => (error: unknown) => {
  notifications.show({ color: 'red', title, message: describe(error) })
}

export function TopicsPage() {
  const [subject, setSubject] = useState('')
  const [subjectIssue, setSubjectIssue] = useState<string>()
  const queryClient = useQueryClient()
  const topics = useListTopics()

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey() })

  const create = useCreateTopic({
    mutation: {
      onSuccess: () => {
        setSubject('')
        return refresh()
      },
      onError: notifyFailure('Could not add that subject'),
    },
  })

  // Documented error responses widen the generated union, so the success case
  // is picked out by status. The mutator throws on anything else.
  const topicList = topics.data?.status === 200 ? topics.data.data : undefined

  const remove = useDeleteTopic({
    mutation: {
      onSuccess: refresh,
      onError: notifyFailure('Could not remove that subject'),
    },
  })

  /** The same schema the API validates against, so the round trip is skipped. */
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = CreateTopicSchema.safeParse({ subject })
    if (!parsed.success) {
      setSubjectIssue(`Subject ${parsed.error.issues[0]?.message}`)
      return
    }
    setSubjectIssue(undefined)
    create.mutate({ data: parsed.data })
  }

  return (
    <Container size="sm">
      <Stack>
        <div>
          <Title order={2}>News topics</Title>
          <Text c="dimmed" size="sm">
            Subjects the brief should research. One per line.
          </Text>
        </div>

        <form onSubmit={submit}>
          <Group align="flex-start" gap="sm">
            <TextInput
              flex={1}
              placeholder="semiconductor export controls"
              aria-label="New subject"
              value={subject}
              error={subjectIssue}
              onChange={(event) => {
                setSubject(event.currentTarget.value)
                setSubjectIssue(undefined)
              }}
            />
            <Button type="submit" loading={create.isPending}>
              Add
            </Button>
          </Group>
        </form>

        {topics.isPending && <Loader />}

        {topics.isError && (
          <Alert color="red" title="Could not load your subjects">
            {describe(topics.error)}
          </Alert>
        )}

        {topicList?.length === 0 && (
          <Text c="dimmed" size="sm">
            Nothing yet — add the first subject above.
          </Text>
        )}

        {topicList?.map((topic) => (
          <Card key={topic.id} withBorder padding="sm" radius="md">
            <Group justify="space-between" wrap="nowrap">
              <Text>{topic.subject}</Text>
              <CloseButton
                aria-label={`Remove ${topic.subject}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: topic.id })}
              />
            </Group>
          </Card>
        ))}
      </Stack>
    </Container>
  )
}
