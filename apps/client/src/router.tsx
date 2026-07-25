import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { AppLayout } from './layout/AppLayout'
import { AccountPage } from './pages/AccountPage'
import { TopicsPage } from './pages/TopicsPage'

const rootRoute = createRootRoute({ component: AppLayout })

/**
 * Topics is the index route rather than `/topics`: Auth0 returns to the origin
 * carrying `?code=&state=`, and a redirect firing before the SDK consumes those
 * params would break the callback.
 */
const topicsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TopicsPage,
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: AccountPage,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([topicsRoute, accountRoute]),
})

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: merging into the router's own `Register` needs an interface
  interface Register {
    router: typeof router
  }
}
