import { useAuth0 } from '@auth0/auth0-react'
import { AppShell, Divider, NavLink, Stack, Text } from '@mantine/core'
import { Link, useLocation } from '@tanstack/react-router'
import { CalendarClock, LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const MAIN_ITEMS = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/schedules', label: 'nav.schedules', icon: CalendarClock },
] as const

/** Sits in the footer rather than the main list, next to `Log out`. */
const ACCOUNT_ITEM = {
  to: '/account',
  label: 'nav.account',
  icon: UserRound,
} as const

type NavItem = (typeof MAIN_ITEMS)[number] | typeof ACCOUNT_ITEM

const ICON_SIZE = 18

/** `/` has to stay an exact match, or it would claim every other route. */
const isActive = (pathname: string, to: string): boolean =>
  to === '/' ? pathname === '/' : pathname.startsWith(to)

function NavItemLink({
  item: { to, label, icon: Icon },
  onNavigate,
}: {
  item: NavItem
  onNavigate: () => void
}) {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  return (
    <NavLink
      label={t(label)}
      active={isActive(pathname, to)}
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
  const { t } = useTranslation()

  return (
    <>
      {/* Below `sm` the header carries the brand, so showing it here too duplicates it. */}
      <AppShell.Section visibleFrom="sm">
        <Text fw={600} size="lg">
          {t('app.name')}
        </Text>
      </AppShell.Section>

      {/* `grow` is what keeps the footer pinned to the bottom. */}
      <AppShell.Section grow my="md">
        <Stack gap={4}>
          {MAIN_ITEMS.map((item) => (
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
            label={t('nav.logOut')}
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
