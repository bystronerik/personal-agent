import {
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  CreateScheduleSchema,
  EditionSchema,
  MAX_TOPICS_PER_SCHEDULE,
} from '@personal-agent/schemas/schedules'

import { describeCron } from './cron'

/**
 * The API's schema, minus the optionality its defaults buy other callers: every
 * control here is always rendered, so the form holds a complete schedule and
 * `topics` keeps the length limit it is declared with.
 */
const ScheduleFormSchema = CreateScheduleSchema.extend({
  enabled: z.boolean(),
  topics: CreateScheduleSchema.shape.topics.unwrap(),
})

export type ScheduleFormValues = z.infer<typeof ScheduleFormSchema>

export const emptySchedule = (): ScheduleFormValues => ({
  cron: '30 7 * * 1-5',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  edition: 'morning',
  enabled: true,
  topics: [],
})

/** The same source `TimeZoneSchema` validates against, so no offered value is refusable. */
const TIME_ZONES = Intl.supportedValuesOf('timeZone')

const firstError = (errors: readonly unknown[]): string | undefined => {
  const issue = errors.at(0)
  return issue && typeof issue === 'object' && 'message' in issue
    ? String(issue.message)
    : undefined
}

/**
 * Both modes validate against the create schema rather than `UpdateScheduleSchema`:
 * the update schema's `.partial()` would let a field cleared to `""` pass here and
 * fail at the API.
 */
export function ScheduleForm({
  initialValues,
  mode,
  isSaving,
  onSubmit,
  onCancel,
}: {
  initialValues: ScheduleFormValues
  mode: 'create' | 'edit'
  isSaving: boolean
  onSubmit: (values: ScheduleFormValues) => void
  onCancel: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'en'

  const form = useForm({
    defaultValues: initialValues,
    validators: { onChange: ScheduleFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
    >
      <Stack>
        <form.Field name="cron">
          {(field) => {
            const error = field.state.meta.isTouched
              ? firstError(field.state.meta.errors)
              : undefined
            const { time, days } = describeCron(
              field.state.value,
              locale,
              t('schedules.everyDay'),
            )

            return (
              <TextInput
                label={t('schedules.cron')}
                description={error ? undefined : `${time} · ${days}`}
                value={field.state.value}
                error={error}
                onBlur={field.handleBlur}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.value)
                }
              />
            )
          }}
        </form.Field>

        <form.Field name="timezone">
          {(field) => (
            <Select
              label={t('schedules.timezone')}
              searchable
              allowDeselect={false}
              data={TIME_ZONES}
              value={field.state.value}
              error={
                field.state.meta.isTouched
                  ? firstError(field.state.meta.errors)
                  : undefined
              }
              onBlur={field.handleBlur}
              onChange={(value) => value && field.handleChange(value)}
            />
          )}
        </form.Field>

        <form.Field name="edition">
          {(field) => (
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {t('schedules.edition')}
              </Text>
              <SegmentedControl
                value={field.state.value}
                data={EditionSchema.options.map((value) => ({
                  value,
                  label: t(`editions.${value}`),
                }))}
                onChange={(value) =>
                  field.handleChange(EditionSchema.parse(value))
                }
              />
            </Stack>
          )}
        </form.Field>

        {/* Topics are edited through their own routes, so `UpdateSchedule` cannot carry them. */}
        {mode === 'create' && (
          <form.Field name="topics">
            {(field) => (
              <TagsInput
                label={t('schedules.topics')}
                description={t('schedules.topicsHint')}
                maxTags={MAX_TOPICS_PER_SCHEDULE}
                value={field.state.value}
                error={
                  field.state.meta.isTouched
                    ? firstError(field.state.meta.errors)
                    : undefined
                }
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        )}

        <form.Field name="enabled">
          {(field) => (
            <Switch
              label={t('schedules.enabled')}
              checked={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.checked)
              }
            />
          )}
        </form.Field>

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            {t('schedules.cancel')}
          </Button>
          <form.Subscribe selector={(state) => state.canSubmit}>
            {(canSubmit) => (
              <Button type="submit" disabled={!canSubmit} loading={isSaving}>
                {t('schedules.save')}
              </Button>
            )}
          </form.Subscribe>
        </Group>
      </Stack>
    </form>
  )
}
