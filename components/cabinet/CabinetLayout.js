import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useSession, signOut } from 'next-auth/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faGamepad,
  faLayerGroup,
  faRightFromBracket,
  faUser,
  faUsers,
  faGaugeHigh,
  faSliders,
  faChevronDown,
  faMoon,
  faSun,
  faCode,
} from '@fortawesome/free-solid-svg-icons'
import { LOCATIONS } from '@server/serverConstants'
import isUserAdmin from '@helpers/isUserAdmin'
import canManageTransactions from '@helpers/canManageTransactions'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'

const normalizeLocationName = (locationKey) => {
  const location = locationKey ? LOCATIONS[locationKey] : null
  const rawName = location?.townRu ?? ''

  if (!rawName) {
    return 'Ваш город'
  }

  return rawName.charAt(0).toUpperCase() + rawName.slice(1)
}

const baseMenuItems = [
  { id: 'dashboard', label: 'Обзор', href: '/cabinet', icon: faGaugeHigh },
  { id: 'games', label: 'Игры', href: '/cabinet/games', icon: faGamepad },
  { id: 'teams', label: 'Мои команды', href: '/cabinet/teams', icon: faUsers },
  {
    id: 'profile',
    label: 'Мой профиль',
    href: '/cabinet/profile',
    icon: faUser,
  },
]

const adminMenuItems = [
  {
    id: 'admin',
    label: 'Администрирование',
    href: '/cabinet/admin',
    icon: faLayerGroup,
  },
  {
    id: 'settings',
    label: 'Управление сайтом',
    href: '/cabinet/settings',
    icon: faSliders,
  },
]

const developerMenuItem = {
  id: 'developer',
  label: 'Разработчик',
  href: '/cabinet/developer',
  icon: faCode,
}

const adminSubmenuItems = [
  {
    id: 'admin-users',
    label: 'Управление пользователями',
    href: '/cabinet/admin/users',
  },
  {
    id: 'admin-teams',
    label: 'Управление командами',
    href: '/cabinet/admin/teams',
  },
  {
    id: 'admin-reports',
    label: 'Статистика и отчёты',
    href: '/cabinet/admin/reports',
  },
  {
    id: 'admin-transactions',
    label: 'Транзакции',
    href: '/cabinet/admin/transactions',
  },
]

const gamesSubmenuItems = [
  {
    id: 'games-upcoming',
    label: 'Предстоящие игры',
    href: '/cabinet/games?view=upcoming',
  },
  {
    id: 'games-past',
    label: 'Прошедшие игры',
    href: '/cabinet/games?view=past',
  },
]

const getInitials = (name, fallback) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  }

  if (fallback) {
    return fallback.slice(0, 2).toUpperCase()
  }

  return 'AQ'
}

const ROLE_PREVIEW_OPTIONS = [
  { value: 'client', label: 'Пользователь' },
  { value: 'admin', label: 'Админ' },
  { value: 'dev', label: 'Разработчик' },
]

const resolveInitialTheme = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null
  }

  const storedTheme = window.localStorage.getItem('cabinet-theme')
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme
  }

  const htmlTheme = document.documentElement.getAttribute('data-theme')
  if (htmlTheme === 'dark' || htmlTheme === 'light') {
    return htmlTheme
  }

  if (document.documentElement.classList.contains('dark')) {
    return 'dark'
  }

  if (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const normalizePath = (value) => {
  if (!value || typeof value !== 'string') {
    return null
  }

  if (typeof window === 'undefined') {
    return value
  }

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) {
      return value
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}

const CabinetLayout = ({
  children,
  title,
  description,
  activePage,
  headerTitle,
  showPageTitle,
}) => {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [isGamesMenuOpen, setIsGamesMenuOpen] = useState(
    () => router.pathname === '/cabinet/games',
  )
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(
    () => router.pathname.startsWith('/cabinet/admin'),
  )
  const [theme, setTheme] = useState(null)
  const [isLocationSaving, setIsLocationSaving] = useState(false)
  const [locationPromptValue, setLocationPromptValue] = useState('')
  const [locationPromptError, setLocationPromptError] = useState('')
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const routeLoadingTimeoutRef = useRef(null)

  const sessionRole = session?.user?.role ?? 'client'
  const { isDeveloper, effectiveRole, setRolePreview } =
    useCabinetRolePreview(sessionRole)
  const role = effectiveRole
  const userName =
    session?.user?.name || session?.user?.username || 'Пользователь'
  const userAvatar = session?.user?.photoUrl ?? null
  const locationKey = session?.user?.location ?? null
  const hasUserIdentity =
    Boolean(session?.user?.globalUserId) ||
    Boolean(session?.user?._id) ||
    Boolean(session?.user?.vkId) ||
    Boolean(session?.user?.phone) ||
    Boolean(session?.user?.telegramId)
  const shouldForceLocationSelection = hasUserIdentity && !locationKey
  const isDarkTheme = theme === 'dark'
  const availableLocations = useMemo(
    () =>
      Object.entries(LOCATIONS)
        .filter(([, value]) => !value.hidden)
        .map(([key, value]) => ({
          key,
          label: normalizeLocationName(key),
          townRu: value.townRu,
        })),
    [],
  )

  const menuItems = useMemo(() => {
    const nextItems = [...baseMenuItems]

    if (isUserAdmin({ role })) {
      nextItems.push(...adminMenuItems)
    }

    if (role === 'dev') {
      nextItems.push(developerMenuItem)
    }

    return nextItems
  }, [role])
  const gamesView =
    typeof router.query?.view === 'string'
      ? router.query.view.toLowerCase()
      : ''

  useIsomorphicLayoutEffect(() => {
    const initialTheme = resolveInitialTheme() ?? 'light'
    setTheme(initialTheme)

    if (typeof document !== 'undefined') {
      const isDark = initialTheme === 'dark'
      document.documentElement.setAttribute('data-theme', initialTheme)
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    }
  }, [])

  const closeSidebarOnMobile = useCallback(() => {
    if (typeof window === 'undefined' || !theme) {
      return
    }

    if (window.innerWidth < 960) {
      setIsSidebarExpanded(false)
    }
  }, [theme])

  const stopRouteLoading = useCallback(() => {
    if (routeLoadingTimeoutRef.current) {
      clearTimeout(routeLoadingTimeoutRef.current)
      routeLoadingTimeoutRef.current = null
    }
    setIsRouteLoading(false)
  }, [])

  const startRouteLoading = useCallback(() => {
    if (routeLoadingTimeoutRef.current) {
      clearTimeout(routeLoadingTimeoutRef.current)
    }

    setIsRouteLoading(true)
    routeLoadingTimeoutRef.current = setTimeout(() => {
      setIsRouteLoading(false)
      routeLoadingTimeoutRef.current = null
    }, 15000)
  }, [])

  useEffect(() => {
    const handleRouteChangeStart = () => {
      startRouteLoading()
    }

    const handleRouteChangeComplete = () => {
      stopRouteLoading()
      closeSidebarOnMobile()
    }

    const handleRouteChangeError = () => {
      stopRouteLoading()
    }

    router.events.on('routeChangeStart', handleRouteChangeStart)
    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    router.events.on('routeChangeError', handleRouteChangeError)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
      router.events.off('routeChangeError', handleRouteChangeError)
      stopRouteLoading()
    }
  }, [closeSidebarOnMobile, router, startRouteLoading, stopRouteLoading])

  useEffect(() => {
    stopRouteLoading()
  }, [router.asPath, stopRouteLoading])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (theme !== 'dark' && theme !== 'light') {
      return
    }

    window.localStorage.setItem('cabinet-theme', theme)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
      document.documentElement.classList.toggle('dark', isDarkTheme)
      document.documentElement.style.colorScheme = isDarkTheme
        ? 'dark'
        : 'light'
    }
  }, [isDarkTheme, theme])

  useEffect(() => {
    if (!shouldForceLocationSelection) {
      setLocationPromptValue('')
      setLocationPromptError('')
      return
    }

    if (locationPromptValue) return
    const fallbackLocation = availableLocations[0]?.key ?? ''
    setLocationPromptValue(fallbackLocation)
  }, [availableLocations, locationPromptValue, shouldForceLocationSelection])

  const applyTheme = useCallback((nextTheme) => {
    const isDark = nextTheme === 'dark'
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cabinet-theme', nextTheme)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nextTheme)
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark'
      applyTheme(nextTheme)
      return nextTheme
    })
  }, [applyTheme])

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/' })
  }

  const handleToggleGamesMenu = useCallback(() => {
    setIsGamesMenuOpen((prev) => {
      const nextValue = !prev
      if (nextValue) {
        setIsAdminMenuOpen(false)
      }
      return nextValue
    })
  }, [])

  const handleToggleAdminMenu = useCallback(() => {
    setIsAdminMenuOpen((prev) => {
      const nextValue = !prev
      if (nextValue) {
        setIsGamesMenuOpen(false)
      }
      return nextValue
    })
  }, [])

  const handleNavLinkClick = useCallback(
    (href, event) => {
      closeSidebarOnMobile()

      if (!event || event.defaultPrevented) {
        return
      }

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return
      }

      const target = normalizePath(href)
      const current = normalizePath(router.asPath)

      if (!target || !current || target === current) {
        return
      }

      startRouteLoading()
    },
    [closeSidebarOnMobile, router.asPath, startRouteLoading],
  )

  const handleLocationChange = useCallback(
    async (event) => {
      const nextLocation = event.target.value
      if (!nextLocation || nextLocation === locationKey || isLocationSaving) {
        return
      }

      try {
        setIsLocationSaving(true)
        setLocationPromptError('')
        const response = await fetch('/api/cabinet/users/location', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ location: nextLocation }),
        })

        if (!response.ok) {
          throw new Error('Не удалось обновить город')
        }

        if (typeof update === 'function') {
          await update({ location: nextLocation })
        }
      } catch (error) {
        console.error('Failed to change active location', error)
        setLocationPromptError('Не удалось сохранить город. Попробуйте снова.')
      } finally {
        setIsLocationSaving(false)
      }
    },
    [isLocationSaving, locationKey, update],
  )

  const appBgClass = isDarkTheme ? 'bg-[#0B001A]' : 'bg-slate-100'
  const decorClass = isDarkTheme
    ? {
        one: 'bg-[#7A00FF]/20',
        two: 'bg-[#00D1FF]/12',
        three: 'bg-[#1A0033]',
      }
    : {
        one: 'bg-blue-200/45',
        two: 'bg-cyan-200/45',
        three: 'bg-violet-200/45',
      }
  const sidebarClass = isDarkTheme
    ? 'border-[#7A00FF]/25 bg-[#0b011c]/92'
    : 'border-slate-200 bg-white/95 shadow-lg shadow-slate-200/50'
  const sidebarHeaderClass = isDarkTheme
    ? 'border-[#7A00FF]/25'
    : 'border-slate-200'
  const logoTextClass = isDarkTheme ? 'text-[#e6d8ff]' : 'text-slate-800'
  const navActiveClass = isDarkTheme
    ? 'border-r-4 border-[#00D1FF] bg-[#00D1FF]/12 text-[#bdf4ff]'
    : 'border-r-4 border-cyan-500 bg-cyan-100/70 text-violet-700'
  const navIdleClass = isDarkTheme
    ? 'text-slate-300 hover:bg-[#00D1FF]/10 hover:text-[#bdf4ff]'
    : 'text-slate-600 hover:bg-cyan-50 hover:text-violet-700'
  const subNavActiveClass = isDarkTheme
    ? 'bg-[#00D1FF]/12 text-[#bdf4ff]'
    : 'bg-cyan-100/70 text-violet-700'
  const subNavIdleClass = isDarkTheme
    ? 'text-slate-300 hover:bg-[#00D1FF]/10 hover:text-[#bdf4ff]'
    : 'text-slate-500 hover:bg-cyan-50 hover:text-violet-700'
  const sidebarFooterClass = isDarkTheme
    ? 'border-[#7A00FF]/25 bg-[#0b011c]/95'
    : 'border-slate-200 bg-white/95'
  const signOutClass = isDarkTheme
    ? 'border-[#7A00FF]/35 bg-[#7A00FF]/10 text-[#d8c8ff] hover:bg-[#7A00FF]/18 hover:text-white'
    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  const headerClass = isDarkTheme
    ? 'border-[#00D1FF]/20 bg-[#090018]/86'
    : 'border-slate-200 bg-white/92'
  const mobileMenuBtnClass = isDarkTheme
    ? 'border-[#00D1FF]/35 bg-[#00D1FF]/10 text-[#bdf4ff] hover:bg-[#00D1FF]/20'
    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  const themeBtnClass = isDarkTheme
    ? 'border-[#7A00FF]/40 bg-[#7A00FF]/12 text-[#d8c8ff] hover:bg-[#7A00FF]/20'
    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  const rolePreviewSelectClass = isDarkTheme
    ? 'border-[#00D1FF]/35 bg-[#090018]/88 text-[#bdf4ff]'
    : 'border-slate-300 bg-white text-slate-700'
  const userNameClass = isDarkTheme ? 'text-[#e8dcff]' : 'text-slate-800'
  const userRoleClass = isDarkTheme ? 'text-[#9fd9ff]' : 'text-slate-500'
  const mainTextClass = isDarkTheme ? 'text-slate-100' : 'text-slate-900'
  const pageTitleClass = isDarkTheme ? 'text-[#e8dcff]' : 'text-slate-900'
  const pageDescriptionClass = isDarkTheme ? 'text-[#9fd9ff]' : 'text-slate-600'
  const resolvedHeaderTitle = headerTitle || title || 'ActQuest'
  const overlayClass = isDarkTheme ? 'bg-[#05000d]/70' : 'bg-slate-900/35'
  const forceLocationOverlayClass = isDarkTheme
    ? 'bg-slate-950/80'
    : 'bg-slate-900/55'
  const forceLocationCardClass = isDarkTheme
    ? 'border-slate-700 bg-slate-900'
    : 'border-slate-200 bg-white'
  const forceLocationTitleClass = isDarkTheme
    ? 'text-slate-100'
    : 'text-slate-900'
  const forceLocationTextClass = isDarkTheme
    ? 'text-slate-300'
    : 'text-slate-600'
  const forceLocationSelectClass = isDarkTheme
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-300 bg-white text-slate-700'

  if (!theme) {
    return (
      <div className="cabinet-neon min-h-screen bg-transparent" aria-hidden="true" />
    )
  }

  return (
    <div className="cabinet-neon">
      <div
        className={`relative flex h-[100dvh] min-h-[100dvh] overflow-hidden laptop:min-h-screen ${appBgClass}`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className={`absolute -left-24 top-8 h-72 w-72 rounded-full blur-3xl ${decorClass.one}`}
          />
          <div
            className={`absolute right-0 top-1/3 h-80 w-80 rounded-full blur-3xl ${decorClass.two}`}
          />
          <div
            className={`absolute bottom-0 left-1/3 h-80 w-80 rounded-full blur-3xl ${decorClass.three}`}
          />
        </div>
        <div
          className={`fixed left-0 top-0 z-40 flex h-[100dvh] max-h-[100dvh] border-r backdrop-blur-xl transition-all duration-200 laptop:inset-y-0 laptop:h-screen laptop:max-h-screen laptop:w-64 laptop:translate-x-0 ${sidebarClass} ${
            isSidebarExpanded
              ? 'w-64 translate-x-0 shadow-xl'
              : 'w-16 -translate-x-full'
          }`}
        >
          <div className="flex flex-col w-full h-full overflow-hidden">
            <div
              className={`flex h-16 items-center justify-center border-b ${sidebarHeaderClass}`}
            >
              <span
                className={`text-lg font-semibold tracking-wide ${logoTextClass}`}
              >
                ActQuest
              </span>
            </div>
            <nav className="flex-1 min-h-0 py-4 space-y-1 overflow-y-auto select-none">
              {menuItems.map((item) => {
                if (item.id === 'games') {
                  const isGamesSectionActive =
                    activePage === item.id || router.pathname === item.href

                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={handleToggleGamesMenu}
                        className={`flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                          isGamesSectionActive ? navActiveClass : navIdleClass
                        } ${isSidebarExpanded ? 'justify-start' : 'justify-center laptop:justify-start'}`}
                      >
                        <FontAwesomeIcon icon={item.icon} className="w-5 h-5 shrink-0" />
                        <span
                          className={`${isSidebarExpanded ? 'opacity-100' : 'opacity-0 laptop:opacity-100'} transition-opacity duration-150`}
                        >
                          {item.label}
                        </span>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`ml-auto h-3 w-3 shrink-0 transition-transform duration-150 ${
                            isGamesMenuOpen ? 'rotate-180' : ''
                          } ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 laptop:opacity-100'}`}
                        />
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                          isGamesMenuOpen
                            ? 'max-h-40 opacity-100 translate-y-0'
                            : 'max-h-0 opacity-0 -translate-y-1'
                        }`}
                        aria-hidden={!isGamesMenuOpen}
                      >
                        <div className="pb-1 pr-3 space-y-1 pl-11">
                          {gamesSubmenuItems.map((subItem) => {
                            const isSubActive =
                              router.pathname === '/cabinet/games' &&
                              ((subItem.id === 'games-upcoming' &&
                                gamesView === 'upcoming') ||
                                (subItem.id === 'games-past' &&
                                  gamesView === 'past'))

                            return (
                              <Link
                                key={subItem.id}
                                href={subItem.href}
                                className={`block cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ${
                                  isSubActive
                                    ? subNavActiveClass
                                    : subNavIdleClass
                                }`}
                                onClick={(event) =>
                                  handleNavLinkClick(subItem.href, event)
                                }
                              >
                                {subItem.label}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                }

                if (item.id === 'admin') {
                  const isAdminSectionActive =
                    router.pathname.startsWith('/cabinet/admin')

                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={handleToggleAdminMenu}
                        className={`flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                          isAdminSectionActive ? navActiveClass : navIdleClass
                        } ${isSidebarExpanded ? 'justify-start' : 'justify-center laptop:justify-start'}`}
                      >
                        <FontAwesomeIcon
                          icon={item.icon}
                          className="w-5 h-5 shrink-0"
                        />
                        <span
                          className={`${isSidebarExpanded ? 'opacity-100' : 'opacity-0 laptop:opacity-100'} transition-opacity duration-150`}
                        >
                          {item.label}
                        </span>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`ml-auto h-3 w-3 shrink-0 transition-transform duration-150 ${
                            isAdminMenuOpen ? 'rotate-180' : ''
                          } ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 laptop:opacity-100'}`}
                        />
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                          isAdminMenuOpen
                            ? 'max-h-64 opacity-100 translate-y-0'
                            : 'max-h-0 opacity-0 -translate-y-1'
                        }`}
                        aria-hidden={!isAdminMenuOpen}
                      >
                        <div className="pt-1 pb-1 pr-3 space-y-1 pl-11">
                          {adminSubmenuItems.map((subItem) => {
                            if (
                              subItem.id === 'admin-transactions' &&
                              !canManageTransactions({ role })
                            ) {
                              return null
                            }

                            const isSubActive = router.pathname === subItem.href

                            return (
                              <Link
                                key={subItem.id}
                                href={subItem.href}
                                className={`block cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ${
                                  isSubActive
                                    ? subNavActiveClass
                                    : subNavIdleClass
                                }`}
                                onClick={(event) =>
                                  handleNavLinkClick(subItem.href, event)
                                }
                              >
                                {subItem.label}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                }

                const isActive =
                  activePage === item.id || router.pathname === item.href

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex cursor-pointer items-center gap-4 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                      isActive ? navActiveClass : navIdleClass
                    } ${isSidebarExpanded ? 'justify-start' : 'justify-center laptop:justify-start'}`}
                    onClick={(event) => handleNavLinkClick(item.href, event)}
                  >
                    <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
                    <span
                      className={`${isSidebarExpanded ? 'opacity-100' : 'opacity-0 laptop:opacity-100'} transition-opacity duration-150`}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </nav>
            <div
              className={`mt-auto border-t px-4 py-4 backdrop-blur-xl ${sidebarFooterClass}`}
            >
              {isDeveloper ? (
                <div className="mb-3">
                  <label className="sr-only" htmlFor="cabinet-role-preview">
                    Режим отображения ролей
                  </label>
                  <select
                    id="cabinet-role-preview"
                    value={role}
                    onChange={(event) => setRolePreview(event.target.value)}
                    className={`h-10 w-full cursor-pointer rounded-xl border px-3 text-xs font-semibold transition-colors duration-150 ${rolePreviewSelectClass}`}
                    title="Режим отображения интерфейса"
                  >
                    {ROLE_PREVIEW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <button
                type="button"
                onClick={toggleTheme}
                className={`mb-3 flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-colors duration-150 ${themeBtnClass}`}
                aria-label={
                  isDarkTheme
                    ? 'Включить светлую тему'
                    : 'Включить тёмную тему'
                }
              >
                <FontAwesomeIcon
                  icon={isDarkTheme ? faSun : faMoon}
                  className="mr-2 h-4 w-4"
                />
                {isDarkTheme ? 'Светлая тема' : 'Тёмная тема'}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-150 ${signOutClass}`}
              >
                <FontAwesomeIcon
                  icon={faRightFromBracket}
                  className="w-4 h-4"
                />
                <span
                  className={`${isSidebarExpanded ? 'opacity-100' : 'opacity-0 laptop:opacity-100'} transition-opacity duration-150`}
                >
                  Выйти
                </span>
              </button>
            </div>
          </div>
        </div>

        {isSidebarExpanded && (
          <div
            className={`fixed inset-0 z-30 laptop:hidden ${overlayClass}`}
            aria-hidden="true"
            onClick={() => setIsSidebarExpanded(false)}
          />
        )}

        <div className="flex h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden laptop:pl-64 laptop:min-h-screen">
          <header
            className={`z-20 shrink-0 border-b backdrop-blur-xl ${headerClass}`}
          >
            <div className="flex items-center justify-between px-4 py-4 laptop:px-8">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-150 laptop:hidden ${mobileMenuBtnClass}`}
                  onClick={() => setIsSidebarExpanded((prev) => !prev)}
                  aria-label="Открыть меню"
                >
                  <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
                </button>
                <div>
                  <h1
                    className={`text-xl font-semibold laptop:text-2xl ${userNameClass}`}
                  >
                    {resolvedHeaderTitle}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3 laptop:gap-4">
                <div className="hidden text-right laptop:block">
                  <p className={`text-sm font-semibold ${userNameClass}`}>
                    {userName}
                  </p>
                  <p className={`text-xs ${userRoleClass}`}>
                    {role === 'dev'
                      ? 'Разработчик'
                      : isUserAdmin({ role })
                        ? 'Администратор'
                        : 'Участник'}
                  </p>
                </div>
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="object-cover w-10 h-10 rounded-full shadow-sm"
                  />
                ) : (
                  <div className="flex items-center justify-center w-10 h-10 text-sm font-semibold text-white rounded-full shadow-sm bg-primary dark:bg-blue-500">
                    {getInitials(userName, session?.user?.username)}
                  </div>
                )}
              </div>
            </div>
          </header>

          <main
            className={`relative z-10 flex-1 overflow-y-auto px-4 py-6 laptop:px-8 ${mainTextClass}`}
          >
            <div className="max-w-5xl mx-auto">
              {showPageTitle ? (
                <div className="mb-6">
                  <h2 className={`text-2xl font-semibold ${pageTitleClass}`}>
                    {title}
                  </h2>
                  {description ? (
                    <p className={`mt-1 text-sm ${pageDescriptionClass}`}>
                      {description}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-6">{children}</div>
            </div>
          </main>
        </div>
      </div>

      {shouldForceLocationSelection ? (
        <div
          className={`fixed inset-0 z-[80] flex items-center justify-center px-4 ${forceLocationOverlayClass}`}
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${forceLocationCardClass}`}
          >
            <h3 className={`text-lg font-semibold ${forceLocationTitleClass}`}>
              Выберите город для участия
            </h3>
            <p className={`mt-2 text-sm ${forceLocationTextClass}`}>
              Какой город для участия в играх вас интересует?
            </p>
            <div className="mt-4 space-y-3">
              <select
                value={locationPromptValue}
                onChange={(event) => setLocationPromptValue(event.target.value)}
                disabled={isLocationSaving}
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${forceLocationSelectClass}`}
              >
                {availableLocations.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isLocationSaving || !locationPromptValue}
                onClick={() => {
                  if (!locationPromptValue) {
                    setLocationPromptError('Выберите город, чтобы продолжить.')
                    return
                  }

                  handleLocationChange({
                    target: { value: locationPromptValue },
                  })
                }}
                className="w-full px-4 py-2 text-sm font-semibold text-white transition rounded-xl bg-primary hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLocationSaving ? 'Сохраняем...' : 'Продолжить'}
              </button>
              {locationPromptError ? (
                <p className="text-xs text-rose-300">{locationPromptError}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isRouteLoading ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-300/60 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-800 shadow-xl dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            Загружаем страницу...
          </div>
        </div>
      ) : null}
    </div>
  )
}

CabinetLayout.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  activePage: PropTypes.string.isRequired,
  headerTitle: PropTypes.string,
  showPageTitle: PropTypes.bool,
}

CabinetLayout.defaultProps = {
  description: null,
  headerTitle: null,
  showPageTitle: false,
}

export default CabinetLayout
