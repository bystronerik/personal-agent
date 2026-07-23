import { Auth0Provider } from '@auth0/auth0-react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { App } from './App'
import { env } from './env'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const root = document.getElementById('root')
if (!root) {
  throw new Error('index.html is missing its #root element')
}

createRoot(root).render(
  <StrictMode>
    <Auth0Provider
      domain={env.auth0Domain}
      clientId={env.auth0ClientId}
      authorizationParams={{
        audience: env.auth0Audience,
        redirect_uri: window.location.origin,
      }}
    >
      <MantineProvider defaultColorScheme="auto">
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MantineProvider>
    </Auth0Provider>
  </StrictMode>,
)
