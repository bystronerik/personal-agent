import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { AppLayout } from './layout/AppLayout'
import { AccountPage } from './pages/AccountPage'
import { DashboardPage } from './pages/DashboardPage'
import { NewSchedulePage } from './pages/NewSchedulePage'
import { SchedulePage } from './pages/SchedulePage'
import { SchedulesPage } from './pages/SchedulesPage'

const rootRoute = createRootRoute({ component: AppLayout })

/**
 * `/` must stay a route that renders in place: Auth0 returns to the origin
 * carrying `?code=&state=`, and a redirect firing before the SDK consumes those
 * params would break the callback.
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const schedulesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schedules',
  component: SchedulesPage,
})

/** Static segments outrank dynamic ones, so `new` is not read as an id. */
const newScheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schedules/new',
  component: NewSchedulePage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schedules/$id',
  component: SchedulePage,
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: AccountPage,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    schedulesRoute,
    newScheduleRoute,
    scheduleRoute,
    accountRoute,
  ]),
})

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: merging into the router's own `Register` needs an interface
  interface Register {
    router: typeof router
  }
}
