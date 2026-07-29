# `@personal-agent/client`

The React + Mantine admin portal. Vite, TanStack Query, Auth0 SPA. Reaches
`apps/server` over HTTP only — the workspace dependency on it is a devDependency,
for codegen input alone. `@personal-agent/schemas` is a real runtime dependency,
so the portal validates against the same Zod objects the API does. See the
[root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm dev` (root) | Vite on `:5173`. Needs `.env` and the API running. |
| `build` / `preview` | Production bundle, and serve it locally. |
| `generate:api` | orval → `src/generated/api/`. Runs as part of root `pnpm generate:api`. |

## The generated API client

The portal consumes the API **only** through orval-generated TanStack Query
hooks. `src/generated/api/` is regenerated output — never hand-edit it, and never
hand-write a fetch call alongside it. **`pages/UnsubscribePage.tsx` is the single
exception**, and it is one the rule cannot cover: the route it calls is
`@ApiExcludeController()` on the server precisely *because* it is unauthenticated,
so there is no hook to generate and a generated one would attach a token that is
not there. Names come from the API (see the root
file). Output is split by OpenAPI tag — `generated/topics/topics.ts`,
`generated/me/me.ts` — with every schema under `generated/model/`.

**A generated hook is consumed from one module per resource, never from a page**:
`src/preferences/usePreferences.ts` for `/me/preferences`, and
`src/schedules/useSchedules.ts` for `/schedules`. `useGetMe` and the topics hooks
are still generated but unused: topics are written once through
`CreateSchedule.topics` and read back off the schedule, so nothing yet calls the
per-topic routes.

The input is `../server/src/generated/openapi.yaml`. If a hook is missing after
an API change, regenerate from the root rather than running `orval` here.

That input is **outside this package and gitignored**, so Turbo cannot hash it:
`generate:api` therefore declares `dependsOn: ["@personal-agent/server#generate:spec"]`
in `turbo.json`. Without it the task is a cache hit after every contract change
and the portal compiles against a stale client.

The mutator (`src/lib/api-fetcher.ts`) must return orval's
**`{ data, status, headers }` envelope** — that is orval's contract for its fetch
client, not a choice, and the generated response types are written to match it.
It also prefixes the API origin, attaches the bearer token, tolerates a
204/empty body, and turns a non-OK response into an `ApiError` carrying the
status, `errorCode` and `params` it parses out of the API's `ApiError` body.

Because the API documents its error responses, a generated response type is a
**union discriminated by `status`**, so a caller narrows on `status === 200` to
reach the payload. The other arm is unreachable in practice: the mutator throws
before a non-OK response ever becomes `data`.

## Auth

The access token reaches the mutator through a **module-level slot**
(`src/auth/token.ts`) set by `AuthTokenBridge`: the mutator is a plain function
and cannot call `useAuth0()`. The bridge renders its children only once the
getter is installed, so no request can leave without an `Authorization` header.

`main.tsx` wraps the app in `Auth0Provider` with the API audience in
`authorizationParams` — without that audience Auth0 issues an opaque token the
API cannot verify. Queries are configured `retry: false`, so an auth or
validation failure surfaces immediately instead of after backoff.

**There is no sign-in screen: `App.tsx` redirects to Auth0 itself.** An
unauthenticated visitor sees a loader, never a log-in button. Three conditions
guard the effect and all are load-bearing: `error` short-circuits it, or a
rejected sign-in bounces straight back to Auth0 in a loop; a `useRef` latch keeps
StrictMode's double-invoked effect from opening two PKCE transactions; and
`isPublic` exempts one path.

**`/unsubscribe` is that path, and it renders outside the router.** It is reached
from a link in a delivered brief, and a reader who wants out is exactly the
reader who will not sign in to get there. The check has to live in `App.tsx`
rather than in the route tree — the Auth0 redirect fires before `RouterProvider`
ever mounts — and rendering it outside the router keeps the typed tree describing
only the authenticated portal. The API's `GET /unsubscribe` has already verified
the token and redirected here **without changing anything**; this page is the
asking, and its button is what `POST`s. nginx already serves the shell for any
unknown path, so no server config changes with it.

## Env

`vite.config.ts` sets `envDir: '../..'` to load the repo-root `.env`; only
`VITE_`-prefixed keys are copied, and Vite inlines them into the bundle. The
Auth0 SPA client uses PKCE and has no secret to leak; keep it that way.

`src/env.ts` validates the four `VITE_*` variables at module load and throws one
message listing every problem, so a misconfigured portal fails loudly at startup
rather than as a confusing redirect loop.

## Validation

**A form parses with the schema from `@personal-agent/schemas` that the API
validates the same request against**, so an invalid value never becomes a request.
`pages/schedules/ScheduleForm.tsx` is the one form, built on
`@tanstack/react-form` — zod 4 implements Standard Schema, so the schema goes in
as the validator with no adapter.

It validates against **`CreateScheduleSchema`, in edit mode too**.
`UpdateScheduleSchema` is `.partial()`, so a field cleared to `""` would pass here
and fail at the API; the form always holds a complete schedule, so the create
schema is the honest one. What it adds locally is only the removal of optionality
the API's defaults buy *other* callers — `ScheduleFormSchema` extends `enabled` to
required and unwraps `topics`, which keeps the `.max()` the package declares
rather than restating it.

The runtime imports crossing a workspace boundary are `lib/api-fetcher.ts`
reaching for `ApiErrorSchema`, the `Locale`/`Theme` schemas and
defaults in `src/i18n/`, `src/preferences/` and `pages/AccountPage.tsx`, the
`DeliveryChannel`/`TelegramChatId` schemas in `pages/account/DeliveryCard.tsx`,
and the schedules schemas and limits in `pages/SchedulesPage.tsx` and
`pages/schedules/ScheduleForm.tsx` — see
[Internationalisation](#internationalisation) and [Preferences](#preferences).

## Internationalisation

`i18next` + `react-i18next`, initialised once as a side effect of
`import './i18n'` in `main.tsx`. **One namespace, one bundle
(`src/i18n/locales/en.ts`), statically imported** — so `init` resolves
synchronously and there is no `<Suspense>` boundary and no loading state.
Splitting locales into dynamic imports is what would change that; until a second
locale exists it would buy nothing.

Two typecheck-enforced guarantees, and both are the point of the setup:

- **Keys are a typed union.** `src/i18n/index.ts` merges the bundle into
  i18next's `CustomTypeOptions`, so `t('acount.title')` fails `pnpm build` with a
  did-you-mean rather than rendering the raw key. Same shape as the router's
  `Register` block, and the second `interface` that needs a `biome-ignore`.
- **The error map is exhaustive.** `errors.byCode` is typed
  `Record<ErrorCode, string>` against `@personal-agent/schemas/common`, so **an
  error code added server-side fails the client build** instead of silently
  falling through to the API's English `message`.

`lib/errors.ts` translates on `error.errorCode`, passing `error.params` as
interpolation values — that pair is what the API sends them for. The server's
`message` is the fallback for a failure from *in front of* the API (a proxy, a
gateway), which carries no code.

### Where the locale comes from

**The stored preference is the source of truth; localStorage is its cache.**
`GET`/`PATCH /me/preferences` own the value; `i18next-browser-languagedetector`
reads `localStorage → navigator` at boot, which is what lets the pre-auth failure
alert and the first paint pick a language before any request resolves.
`usePreferenceSync` corrects the rare disagreement once the query lands, so the
common path has no flash — see [Preferences](#preferences).

`supportedLngs` is **derived from `LocaleSchema.options`**, not maintained
separately — the API rejects a locale the portal has no bundle for, and adding
one means a bundle here plus a deploy of both sides. `nonExplicitSupportedLngs`
maps `en-GB` onto `en`, so `resolvedLanguage` — never `language` — is what the
`<html lang>` attribute and `useLocale` read.

## Preferences

`src/preferences/usePreferences.ts` is the **only** caller of the generated
preferences hooks, and it exports two things:

- **`usePreferences`** — the query, the mutations, their cache invalidation and
  their error notification in one place. Every control patches through its
  `save`, so a partial `PATCH` never drops a sibling field. It also exposes
  **`resumeEmail`**, which is a *separate route* rather than part of `save`: an
  unsubscribe is the reader's decision, so no other control on the page can
  reverse it as a side effect.
- **`usePreferenceSync`** — the effects that apply the stored `locale` and
  `theme` to i18next and Mantine. **`AppLayout` mounts it, not the page
  that edits them**: the controls live on `AccountPage` now, so an effect owned by
  a control would stop correcting the moment the reader navigated away.

The two controls are thin by design — `useLocale` (in `src/i18n/`) and
`useTheme` each pair `usePreferences().save` with the client-side setter
they front (`i18n.changeLanguage`, Mantine's `setColorScheme`), so the UI updates
immediately and the request confirms it. Both read `current` from that setter's
own state rather than from the query, which is what keeps the control responsive
while the `PATCH` is in flight; `ThemeSchema.catch`/`LocaleSchema.catch`
guard the parse because neither library's stored value is typed by us.

**`theme` carries Mantine's `light | dark | auto`** all the way to the column —
**the name is ours, the values are Mantine's**, so `useTheme` is the one place
the two vocabularies meet and it needs no mapping to do it.
`MantineProvider` still sets `defaultColorScheme="auto"`, so an unauthenticated
first paint follows the OS, and the stored value takes over once it lands.

## Routing

`@tanstack/react-router` with a **code-defined** route tree (`src/router.tsx`) —
not file-based, so there is no Vite plugin and no generated route tree to sequence
into `pnpm generate`. The `declare module` block registering `typeof router` is
what makes `Link to=` a typed union: a path that is not a route fails
`pnpm typecheck` instead of 404ing at runtime. It has to stay an `interface`
(declaration merging), which is one of the two `biome-ignore`s in the workspace —
`src/i18n/index.ts` merges into i18next's `CustomTypeOptions` the same way.

**`/` must stay a route that renders in place.** Auth0 returns to the origin
carrying `?code=&state=`, and a redirect firing before the SDK consumes those
params would break the callback — so the index route renders `DashboardPage`
directly rather than redirecting to a `/dashboard` path. Five routes today:
`/` (dashboard), `/schedules`, `/schedules/new`, `/schedules/$id`, `/account` —
a static segment outranks a dynamic sibling, so `new` is not read as an id.
`/unsubscribe` is deliberately **not** among them; it renders above the router,
for the reason given under [Auth](#auth).

`AppShell.Section grow` on the navbar's main list is what keeps the footer
pinned to the bottom.

`App.tsx` keeps the auth gate and renders `RouterProvider` only once
authenticated, with `AuthTokenBridge` still **outside** the router — so the
no-request-without-a-token guarantee above is unchanged. The root route's
component is `layout/AppLayout`, so every page renders inside the shell.

## UI

Mantine with `defaultColorScheme="auto"`, `AppShell` for the frame, and
`@mantine/notifications` for mutation errors. Component styles come from Mantine
props and PostCSS (`postcss-preset-mantine`) — there is no CSS-in-JS layer and no
separate design system. Icons are `lucide-react`, imported per icon.

The frame is navbar-only: `layout/AppNavbar` fills it with three
`AppShell.Section`s — brand, the main `NavLink` list (`Dashboard`, `Schedules`),
and a footer stacking `Account` and `Log out`. The signed-in email is
deliberately **not** in the navbar; it lives on `AccountPage`, one click away,
and **so does every preference control** — the navbar names destinations, not
settings. `Log out` is a `NavLink` (`component="button"`) rather than a `Button`
so both footer rows match.

**A header exists only below `sm`**, where a collapsed navbar would have nothing
to reopen it; `header={{ height: { base: 56, sm: 0 } }}` plus `hiddenFrom="sm"`
leaves desktop with no header at all.

`NavLink`s are wired with **`renderRoot`, not `component={Link}`** — the
polymorphic `component` prop erases the router's typed `to`, which is the whole
point of the typed tree, and the same reason the schedules list wires its row
`Button`s and `ActionIcon`s that way. Active state is a **prefix** match, so
`/schedules/$id` keeps Schedules lit; `/` is the exception and stays exact, or it
would claim every route.

Feature pages live in `src/pages`. **No page carries a heading or a strapline** —
the navbar's active item is the only thing naming the current page, by decision:
the UI is meant to read without being captioned. A page that needs a title is a
page whose content is not carrying itself. `DashboardPage` renders nothing at all
until it has something real to show.

`AccountPage` shows the Auth0
profile — name, email, picture — above a second card holding the preference
controls: a `Select` for language and a `SegmentedControl` for theme, both fed
from their schema's `options` so a value the contract does not admit cannot be
offered. The API's `userId` is still not something a reader needs to see.

A third card, `pages/account/DeliveryCard.tsx`, is where a brief's channel is
chosen. Three things about it are decisions rather than accidents:

- **The chat-id field is rendered whatever the channel is.** The API rejects
  `telegram` without a chat id, so a field revealed only *by* that selection
  would be unreachable at the moment it is needed.
- **The channel saves on change; the chat id saves on a button.** One is a
  discrete choice, the other is typing, and a `PATCH` per keystroke is not a
  contract the API should have to absorb.
- **The suspension warning carries its own action.** `emailSuspendedReason` is a
  closed enum, so `suspensionReasons` in `en.ts` is typed `Record<…, string>`
  the same way `byCode` is — a reason added server-side fails `pnpm build` here.
**The schedules pages are live against `/schedules`** — a list with a working
enable toggle, a create route and a detail route that patches or deletes.
`pages/schedules/cron.ts` holds `describeCron`, which turns a cron field into
`07:30 · Mon–Fri` via `Intl`; it labels each row and doubles as the create form's
live preview.

Two things the list reads off the contract rather than restating: the row's
sun/moon icon keys off `edition`, not a guess at the cron hour, and the **New**
button disables at `MAX_SCHEDULES_PER_USER`, so the cap is visible before the API
answers 409. Every `SCHEDULE_*` code is already in `errors.byCode`, so the two
failures a type cannot catch — the per-user cap, and croner rejecting a pattern
`CronExpressionSchema` admits — arrive translated with no client change.

Mutations invalidate the query key they affect rather than mutating the cache by
hand, and a failed request renders through `useDescribeError`
(`src/lib/errors.ts`) — as an `Alert` for a query (`lib/RequestFailure.tsx`), as a
notification for a mutation.

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
