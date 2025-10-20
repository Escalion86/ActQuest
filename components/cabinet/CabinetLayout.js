import { useMemo, useState, useCallback, useEffect } from 'react'
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
} from '@fortawesome/free-solid-svg-icons'
import { LOCATIONS } from '@server/serverConstants'
import isUserAdmin from '@helpers/isUserAdmin'

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
  { id: 'profile', label: 'Моя анкета', href: '/cabinet/profile', icon: faUser },
]

const adminMenuItems = [
  { id: 'admin', label: 'Администрирование', href: '/cabinet/admin', icon: faLayerGroup },
  { id: 'settings', label: 'Настройки сайта', href: '/cabinet/settings', icon: faSliders },
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

const CabinetLayout = ({ children, title, description, activePage }) => {
  const router = useRouter()
  const { data: session } = useSession()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)

  const role = session?.user?.role ?? null
  const userName = session?.user?.name || session?.user?.username || 'Пользователь'
  const userAvatar = session?.user?.photoUrl ?? null
  const locationKey = session?.user?.location ?? null
  const locationName = normalizeLocationName(locationKey)

  const menuItems = useMemo(() => {
    if (isUserAdmin({ role })) {
      return [...baseMenuItems, ...adminMenuItems]
    }

    return baseMenuItems
  }, [role])

  const closeSidebarOnMobile = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (window.innerWidth < 768) {
      setIsSidebarExpanded(false)
    }
  }, [])

  useEffect(() => {
    const handleRouteChange = () => {
      closeSidebarOnMobile()
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [closeSidebarOnMobile, router])

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/' })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <div
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-slate-200 transition-all duration-200 md:static md:translate-x-0 md:w-64 ${
          isSidebarExpanded ? 'w-64 translate-x-0 shadow-xl' : 'w-16 -translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-center h-16 border-b border-slate-200">
          <span className="text-lg font-semibold text-primary">AQ</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive =
              activePage === item.id || router.pathname === item.href

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-primary bg-blue-50 border-r-4 border-primary'
                    : 'text-slate-600 hover:text-primary hover:bg-blue-50'
                } ${isSidebarExpanded ? 'justify-start' : 'justify-center md:justify-start'}`}
                onClick={closeSidebarOnMobile}
              >
                <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
                <span className={`${isSidebarExpanded ? 'opacity-100' : 'opacity-0 md:opacity-100'} transition-opacity duration-150`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center w-full gap-3 px-3 py-2 text-sm font-medium text-slate-500 transition-colors duration-150 bg-slate-100 rounded-xl hover:text-primary hover:bg-blue-100"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
            <span className={`${isSidebarExpanded ? 'opacity-100' : 'opacity-0 md:opacity-100'} transition-opacity duration-150`}>
              Выйти
            </span>
          </button>
        </div>
      </div>

      {isSidebarExpanded && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          aria-hidden="true"
          onClick={() => setIsSidebarExpanded(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-h-screen">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-4 md:px-8">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="flex items-center justify-center w-10 h-10 text-slate-600 transition-colors duration-150 bg-slate-100 rounded-xl md:hidden hover:text-primary hover:bg-blue-100"
                onClick={() => setIsSidebarExpanded((prev) => !prev)}
                aria-label="Открыть меню"
              >
                <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-primary md:text-2xl">ActQuest</h1>
                <p className="text-sm text-slate-500">{locationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <p className="text-sm font-semibold text-primary">{userName}</p>
                <p className="text-xs text-slate-500">{isUserAdmin({ role }) ? 'Администратор' : 'Участник'}</p>
              </div>
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="object-cover w-10 h-10 rounded-full shadow-sm"
                />
              ) : (
                <div className="flex items-center justify-center w-10 h-10 text-sm font-semibold text-white bg-primary rounded-full shadow-sm">
                  {getInitials(userName, session?.user?.username)}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-primary">{title}</h2>
              {description ? (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              ) : null}
            </div>
            <div className="space-y-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}

CabinetLayout.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  activePage: PropTypes.string.isRequired,
}

CabinetLayout.defaultProps = {
  description: null,
}

export default CabinetLayout
