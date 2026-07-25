import { AppShell, Burger, Group, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet } from '@tanstack/react-router'

import { AppNavbar } from './AppNavbar'

const NAVBAR_WIDTH = 260
const MOBILE_HEADER_HEIGHT = 56

/**
 * Root route component. The header exists only below `sm`, where a collapsed
 * navbar would otherwise have nothing to reopen it; its zero height at `sm` and
 * up leaves the desktop layout navbar-only.
 */
export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false)

  return (
    <AppShell
      padding="md"
      navbar={{
        width: NAVBAR_WIDTH,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      header={{ height: { base: MOBILE_HEADER_HEIGHT, sm: 0 } }}
    >
      <AppShell.Header hiddenFrom="sm">
        <Group h="100%" px="md" gap="sm">
          <Burger
            opened={opened}
            onClick={toggle}
            size="sm"
            aria-label="Toggle navigation"
          />
          <Text fw={600}>Personal Agent</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppNavbar onNavigate={close} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
