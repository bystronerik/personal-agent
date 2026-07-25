import { useAuth0 } from '@auth0/auth0-react'
import { AppShell, Divider, NavLink, Stack, Text } from '@mantine/core'
import { Link, useLocation } from '@tanstack/react-router'
import { LogOut, Newspaper, UserRound } from 'lucide-react'

const NAV_ITEMS = [{ to: '/', label: 'Topics', icon: Newspaper }] as const

/** Sits in the footer rather than the main list, next to `Log out`. */
const ACCOUNT_ITEM = {
  to: '/account',
  label: 'Account',
  icon: UserRound,
} as const

type NavItem = (typeof NAV_ITEMS)[number] | typeof ACCOUNT_ITEM

const ICON_SIZE = 18

function NavItemLink({
  item: { to, label, icon: Icon },
  onNavigate,
}: {
  item: NavItem
  onNavigate: () => void
}) {
  const { pathname } = useLocation()

  return (
    <NavLink
      label={label}
      active={pathname === to}
      leftSection={<Icon size={ICON_SIZE} />}
      onClick={onNavigate}
      // `renderRoot` over `component={Link}`: the polymorphic prop erases the
      // router's typed `to`, which a wrong path then fails to catch.
      renderRoot={(props) => <Link to={to} {...props} />}
    />
  )
}

export function AppNavbar({ onNavigate }: { onNavigate: () => void }) {
  const { logout } = useAuth0()

  return (
    <>
      {/* Below `sm` the header carries the brand, so showing it here too duplicates it. */}
      <AppShell.Section visibleFrom="sm">
        <Text fw={600} size="lg">
          Personal Agent
        </Text>
      </AppShell.Section>

      <AppShell.Section grow my="md">
        <Stack gap={4}>
          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </Stack>
      </AppShell.Section>

      <AppShell.Section>
        <Divider mb="sm" />
        <Stack gap={4}>
          <NavItemLink item={ACCOUNT_ITEM} onNavigate={onNavigate} />
          <NavLink
            component="button"
            type="button"
            label="Log out"
            leftSection={<LogOut size={ICON_SIZE} />}
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
          />
        </Stack>
      </AppShell.Section>
    </>
  )
}
