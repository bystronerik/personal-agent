import { z } from 'zod'

/**
 * A closed set, not a BCP-47 string: the portal derives its `supportedLngs` from
 * `LocaleSchema.options`, so a locale the UI has no bundle for cannot be stored.
 * Adding one means a bundle here and a deploy of both sides.
 */
export const LocaleSchema = z.enum(['en']).meta({ id: 'Locale' })
export type Locale = z.infer<typeof LocaleSchema>

/** Mirrors `User.locale`'s database default, which no migration can import. */
export const DEFAULT_LOCALE = 'en' satisfies Locale

/**
 * `auto` rather than `system` because the members are Mantine's own
 * `MantineColorScheme` values — the portal hands a stored value straight to
 * `setColorScheme`, and renaming a member buys a mapping layer and nothing else.
 */
export const ThemeSchema = z
  .enum(['light', 'dark', 'auto'])
  .meta({ id: 'Theme' })
export type Theme = z.infer<typeof ThemeSchema>

/** Mirrors `User.theme`'s database default, which no migration can import. */
export const DEFAULT_THEME = 'auto' satisfies Theme

export const UserPreferencesSchema = z
  .object({
    locale: LocaleSchema,
    theme: ThemeSchema,
  })
  .meta({ id: 'UserPreferences' })
export type UserPreferences = z.infer<typeof UserPreferencesSchema>

export const UpdateUserPreferencesSchema = UserPreferencesSchema.partial().meta(
  {
    id: 'UpdateUserPreferences',
  },
)
export type UpdateUserPreferences = z.infer<typeof UpdateUserPreferencesSchema>
