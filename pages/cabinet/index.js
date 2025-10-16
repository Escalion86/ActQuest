import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getSession, signIn, signOut, useSession } from 'next-auth/react'
import { LOCATIONS } from '@server/serverConstants'
import TelegramLogin from '@components/cabinet/TelegramLogin'
import NotificationsCard from '@components/cabinet/NotificationsCard'
import usePwaNotifications from '@helpers/usePwaNotifications'
import { decodeCommandKeys } from 'telegram/func/commandShortcuts'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

const formatText = (text) =>
  (text || '')
    .split('\n')
    .map((part) => part.trim())
    .join('\n')

const decodeCallbackParam = (rawValue) => {
  if (!rawValue) return null

  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
  if (typeof value !== 'string' || !value) return null

  let decoded = value

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded)
      if (nextDecoded === decoded) break
      decoded = nextDecoded
    } catch (error) {
      break
    }
  }

  return decoded
}

const extractRelativePath = (url, baseOrigin) => {
  if (!url) return null

  if (typeof url === 'string' && url.startsWith('/')) {
    return url
  }

  if (!baseOrigin) return null

  try {
    const parsed = new URL(url, baseOrigin)
    const base = new URL(baseOrigin)

    if (parsed.host !== base.host) {
      return null
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch (error) {
    return null
  }
}

const getRequestOrigin = (req) => {
  if (!req?.headers) return null

  const forwardedProto = req.headers['x-forwarded-proto']
  const forwardedHost = req.headers['x-forwarded-host']
  const hostHeader = req.headers.host

  const rawProtocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0]?.trim()
    : null

  const protocol =
    rawProtocol ||
    (hostHeader?.startsWith('localhost') || hostHeader?.startsWith('127.0.0.1')
      ? 'http'
      : 'https')

  const rawHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : typeof forwardedHost === 'string'
    ? forwardedHost.split(',')[0]?.trim()
    : null

  const host = rawHost || hostHeader

  if (!host) return null

  return `${protocol}://${host}`
}

const isButtonVisible = (button) =>
  Boolean(
    button &&
      !button.hidden &&
      !button.hide &&
      !button.is_hidden &&
      !button.hidden_by_condition &&
      (button.text || button.url)
  )

const buildBlocksFromResult = (result) => {
  if (!result) return []

  const blocks = []
  const formattedText = formatText(result.text)

  if (formattedText) {
    blocks.push({
      id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'text',
      content: formattedText,
    })
  }

  const media = []

  if (Array.isArray(result.images)) {
    media.push(...result.images.filter(Boolean))
  }

  if (Array.isArray(result.photos)) {
    media.push(...result.photos.filter(Boolean))
  }

  if (result.photo) {
    media.push(result.photo)
  }

  if (result.image) {
    media.push(result.image)
  }

  media.forEach((url, index) => {
    blocks.push({
      id: `image-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      type: 'image',
      content: url,
    })
  })

  return blocks
}

const CabinetPage = ({ initialCallbackUrl, initialCallbackSource }) => {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const [location, setLocation] = useState(
    () => session?.user?.location ?? defaultLocation
  )
  const [authCallbackUrl, setAuthCallbackUrl] = useState(() => {
    if (typeof initialCallbackUrl === 'string' && initialCallbackUrl) {
      return initialCallbackUrl
    }

    return '/cabinet'
  })
  const [input, setInput] = useState('')
  const [displayBlocks, setDisplayBlocks] = useState([])
  const [keyboardButtons, setKeyboardButtons] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState(null)
  const [notificationsExpanded, setNotificationsExpanded] = useState(false)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const [hasSyncedLocation, setHasSyncedLocation] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [theme, setTheme] = useState('light')
  const authCallbackSourceRef = useRef(initialCallbackSource)
  const processedCallbackRef = useRef(null)
  const lastInteractionRef = useRef('bot')
  const displayRef = useRef(null)
  const hasLoadedInitialMenuRef = useRef(false)
  const gameTeamCacheRef = useRef(new Map())
  const pushNotifications = usePwaNotifications({ location, session })

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!router.isReady) return

    const queryTab = router.query?.tab
    if (queryTab === 'notifications') {
      setNotificationsExpanded(true)
    }

    const queryLocation = router.query?.location
    if (
      typeof queryLocation === 'string' &&
      LOCATIONS[queryLocation] &&
      queryLocation !== location
    ) {
      setLocation(queryLocation)
    }
  }, [router.isReady, router.query, location])

  useEffect(() => {
    if (!router.isReady) return

    const decodedCallback = decodeCallbackParam(router.query?.callbackUrl)

    if (!decodedCallback) {
      setAuthCallbackUrl('/cabinet')
      if (authCallbackSourceRef.current !== null) {
        processedCallbackRef.current = null
      }
      authCallbackSourceRef.current = null
      return
    }

    if (!isClient) return

    const relativeTarget = extractRelativePath(
      decodedCallback,
      window.location.origin
    )

    if (relativeTarget) {
      if (authCallbackSourceRef.current !== decodedCallback) {
        processedCallbackRef.current = null
      }
      setAuthCallbackUrl(relativeTarget)
      authCallbackSourceRef.current = decodedCallback
      return
    }

    console.error(
      'Не удалось разобрать callbackUrl авторизации',
      decodedCallback
    )
    setAuthCallbackUrl('/cabinet')
    if (authCallbackSourceRef.current !== decodedCallback) {
      processedCallbackRef.current = null
    }
    authCallbackSourceRef.current = decodedCallback
  }, [router.isReady, router.query, isClient])

  useEffect(() => {
    if (!isClient || !router.isReady) return

    const rawCallbackParam = router.query?.callbackUrl
    if (!rawCallbackParam) {
      processedCallbackRef.current = null
      return
    }

    if (status !== 'authenticated') return

    if (!authCallbackUrl) return

    const decodedSource = authCallbackSourceRef.current
    if (!decodedSource) return

    if (processedCallbackRef.current === decodedSource) return

    const navigateToCallback = async () => {
      const targetPath = authCallbackUrl.startsWith('/')
        ? authCallbackUrl
        : `/${authCallbackUrl}`

      try {
        processedCallbackRef.current = decodedSource

        if (targetPath === '/cabinet') {
          await router.replace('/cabinet', '/cabinet')
          return
        }

        await router.replace(targetPath, targetPath)
      } catch (navError) {
        console.error('Не удалось перейти по сохранённому callbackUrl', navError)
        await router.replace('/cabinet', '/cabinet').catch(() => null)
      }
    }

    navigateToCallback()
  }, [
    authCallbackUrl,
    isClient,
    router,
    router.isReady,
    router.query?.callbackUrl,
    status,
  ])

  useEffect(() => {
    if (!isClient) return

    const storedTheme = window.localStorage.getItem('aq-theme')

    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
      return
    }

    const prefersDark = window.matchMedia?.(
      '(prefers-color-scheme: dark)'
    ).matches
    setTheme(prefersDark ? 'dark' : 'light')
  }, [isClient])

  useEffect(() => {
    if (!isClient) return

    window.document.documentElement.classList.toggle('dark', theme === 'dark')
    window.document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('aq-theme', theme)
  }, [theme, isClient])

  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.user?.location &&
      !hasSyncedLocation
    ) {
      setLocation(session.user.location)
      setHasSyncedLocation(true)
      return
    }

    if (status === 'unauthenticated' && hasSyncedLocation) {
      setHasSyncedLocation(false)
      setLocation(defaultLocation)
    }
  }, [session, status, hasSyncedLocation])

  useEffect(() => {
    if (!session) {
      setDisplayBlocks([])
      setKeyboardButtons([])
      lastInteractionRef.current = 'bot'
      hasLoadedInitialMenuRef.current = false
      setNotifications([])
      setNotificationsError(null)
      setHasUnreadNotifications(false)
      setNotificationsExpanded(false)
    }
  }, [session])

  useEffect(() => {
    if (!session || status !== 'authenticated') {
      hasLoadedInitialMenuRef.current = false
      return
    }

    if (hasLoadedInitialMenuRef.current) {
      return
    }

    hasLoadedInitialMenuRef.current = true
    loadMainMenu({ resetDisplay: true, initiatedByUser: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status])

  useEffect(() => {
    if (!notifications || notifications.length === 0) {
      setHasUnreadNotifications(false)
      return
    }

    setHasUnreadNotifications(notifications.some((item) => !item.readAt))
  }, [notifications])

  useEffect(() => {
    if (hasUnreadNotifications) {
      setNotificationsExpanded(true)
    }
  }, [hasUnreadNotifications])

  const loadMainMenu = async ({
    resetDisplay = false,
    initiatedByUser = true,
    targetLocation,
  } = {}) => {
    await sendCommand({
      command: 'mainMenu',
      meta: 'Главное меню',
      skipUserEcho: true,
      initiatedByUser,
      resetDisplay,
      targetLocation,
    })
  }

  const fetchNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!session) {
        setNotifications([])
        setNotificationsError(null)
        setHasUnreadNotifications(false)
        if (!silent) {
          setNotificationsLoading(false)
        }
        return
      }

      if (!silent) {
        setNotificationsLoading(true)
      }
      setNotificationsError(null)

      try {
        const response = await fetch(
          `/api/webapp/notifications?location=${encodeURIComponent(location)}`
        )

        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Не удалось загрузить уведомления')
        }

        const items = Array.isArray(data.notifications)
          ? data.notifications
          : []

        setNotifications(
          items.map((item) => {
            const rawId = item.id || item._id
            const resolvedId =
              typeof rawId === 'string'
                ? rawId
                : rawId?.toString?.() ||
                  `notification-${Math.random().toString(36).slice(2)}`

            return {
              id: resolvedId,
              title: item.title || 'Уведомление',
              body: item.body || '',
              data: item.data || {},
              readAt: item.readAt || null,
              createdAt: item.createdAt || null,
            }
          })
        )
        setNotificationsError(null)
      } catch (fetchError) {
        setNotificationsError(fetchError.message)
      } finally {
        if (!silent) {
          setNotificationsLoading(false)
        }
      }
    },
    [session, location]
  )

  const handleRefreshNotifications = useCallback(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkNotificationsAsRead = useCallback(async () => {
    if (!session) return

    const unreadIds = notifications
      .filter((item) => !item.readAt)
      .map((item) => item.id)

    if (unreadIds.length === 0) return

    try {
      setNotificationsError(null)
      const response = await fetch('/api/webapp/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location, notificationIds: unreadIds }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось обновить уведомления')
      }

      const readAt = data?.readAt || new Date().toISOString()

      setNotifications((prev) =>
        prev.map((item) =>
          unreadIds.includes(item.id)
            ? {
                ...item,
                readAt,
              }
            : item
        )
      )

      setHasUnreadNotifications(false)
    } catch (updateError) {
      setNotificationsError(updateError.message)
    }
  }, [session, notifications, location])

  useEffect(() => {
    if (!session) return
    fetchNotifications()
  }, [session, location, fetchNotifications])

  useEffect(() => {
    if (
      notificationsExpanded &&
      session &&
      !notifications.length &&
      !notificationsLoading
    ) {
      fetchNotifications({ silent: true })
    }
  }, [
    notificationsExpanded,
    session,
    notifications.length,
    notificationsLoading,
    fetchNotifications,
  ])

  const sendCommand = async ({
    command,
    message,
    meta: _meta,
    skipUserEcho: _skipUserEcho,
    initiatedByUser = true,
    resetDisplay = false,
    targetLocation,
  } = {}) => {
    if (!session) return

    const shouldAppend =
      !initiatedByUser && !resetDisplay && lastInteractionRef.current === 'bot'

    if (initiatedByUser) {
      lastInteractionRef.current = 'user'
    }

    if (resetDisplay) {
      setDisplayBlocks([])
      setKeyboardButtons([])
    }

    setIsLoading(true)
    setError(null)

    try {
      const resolvedLocation = targetLocation ?? location
      const response = await fetch('/api/webapp/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location: resolvedLocation, command, message }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Не удалось выполнить команду')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Не удалось выполнить команду')
      }

      const keyboard = data.result?.keyboard?.inline_keyboard || []
      setKeyboardButtons(keyboard)

      const blocks = buildBlocksFromResult(data.result)

      if (blocks.length > 0) {
        setDisplayBlocks((prev) =>
          shouldAppend ? [...prev, ...blocks] : blocks
        )
      } else if (!shouldAppend) {
        setDisplayBlocks([])
      }

      lastInteractionRef.current = 'bot'
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const submitInput = () => {
    const value = input.trim()

    if (!value) {
      return false
    }

    const isCommand = value.startsWith('/')

    sendCommand({
      command: isCommand ? value : undefined,
      message: isCommand ? undefined : value,
      meta: value,
    })

    setInput('')
    return true
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submitInput()
  }

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submitInput()
    }
  }

  const parseCallbackData = useCallback((value) => {
    if (!value) return null

    if (typeof value !== 'string') {
      return decodeCommandKeys(value)
    }

    try {
      return decodeCommandKeys(JSON.parse(value))
    } catch (error) {
      return null
    }
  }, [])

  const isEnterGameButton = useCallback((text) => {
    if (!text) return false

    const normalized = text
      .replace(/["'«»“”()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    if (!normalized) return false

    return (
      normalized.includes('войти в игру') || normalized.includes('зайти в игру')
    )
  }, [])

  const navigateToGameEntry = useCallback(
    async (button) => {
      if (!button) return false

      if (!isEnterGameButton(button.text)) {
        return false
      }

      const callbackValue =
        button.callback_data ?? button.callbackData ?? button.c ?? null

      if (!callbackValue || typeof callbackValue !== 'string') {
        return false
      }

      const decoded = parseCallbackData(callbackValue)
      const gameTeamId = decoded?.gameTeamId || decoded?.gt

      if (!gameTeamId || typeof gameTeamId !== 'string') {
        return false
      }

      const cache = gameTeamCacheRef.current
      let cachedInfo = cache.get(gameTeamId)

      if (cachedInfo && typeof cachedInfo === 'string') {
        cachedInfo = { gameId: cachedInfo }
      }

      if (!cachedInfo?.gameId) {
        try {
          const params = new URLSearchParams({ gameTeamId })
          if (location) {
            params.set('location', location)
          }

          const response = await fetch(
            `/api/webapp/game-team?${params.toString()}`
          )

          if (!response.ok) {
            return false
          }

          const data = await response.json().catch(() => null)

          if (!data?.success || !data?.gameTeam?.gameId) {
            return false
          }

          cachedInfo = {
            gameId: data.gameTeam.gameId,
            teamId: data.gameTeam.teamId || null,
            location: data.gameTeam.location || null,
          }

          cache.set(gameTeamId, cachedInfo)
        } catch (error) {
          console.error('Не удалось получить информацию об игре', error)
          return false
        }
      }

      const targetGameId = cachedInfo?.gameId
      const targetTeamId = cachedInfo?.teamId || null
      const resolvedLocation = cachedInfo?.location || null

      if (!targetGameId) {
        return false
      }

      const targetLocation =
        resolvedLocation ||
        location ||
        session?.user?.location ||
        defaultLocation ||
        null

      if (!targetLocation) {
        return false
      }

      const targetPath = targetTeamId
        ? `/${targetLocation}/game/${targetGameId}/${targetTeamId}`
        : `/${targetLocation}/game/${targetGameId}`

      try {
        await router.push(targetPath)
      } catch (navigationError) {
        console.error('Не удалось перейти на страницу игры', navigationError)
        return false
      }

      return true
    },
    [
      isEnterGameButton,
      location,
      parseCallbackData,
      router,
      session?.user?.location,
    ]
  )

  const handleKeyboardAction = async (button) => {
    if (!button) return

    if (button.url) {
      window.open(button.url, '_blank', 'noopener,noreferrer')
      return
    }

    const handled = await navigateToGameEntry(button)

    if (handled) {
      return
    }

    sendCommand({
      command: button.callback_data,
      meta: button.text,
    })
  }

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleSignOut = async () => {
    try {
      if (
        pushNotifications?.isSubscribed &&
        typeof pushNotifications.unsubscribe === 'function'
      ) {
        await pushNotifications.unsubscribe().catch(() => null)
      }
      await signOut({ redirect: false })
    } finally {
      router.push('/')
    }
  }

  const handleLocationChange = (value) => {
    setLocation(value)
    loadMainMenu({
      resetDisplay: true,
      initiatedByUser: true,
      targetLocation: value,
    })
  }

  useEffect(() => {
    if (!displayRef.current) return
    displayRef.current.scrollTop = displayRef.current.scrollHeight
  }, [displayBlocks])

  const handleTelegramAuth = async (userData) => {
    if (!userData) return

    try {
      setError(null)
      const payload = JSON.stringify(userData)
      let absoluteCallbackUrl = authCallbackUrl

      if (isClient) {
        try {
          absoluteCallbackUrl = new URL(
            authCallbackUrl,
            window.location.origin
          ).toString()
        } catch (buildUrlError) {
          console.error(
            'Не удалось сформировать callbackUrl авторизации',
            buildUrlError
          )
          absoluteCallbackUrl = `${window.location.origin}/cabinet`
        }
      }

      const result = await signIn('telegram', {
        redirect: false,
        callbackUrl: absoluteCallbackUrl,
        data: payload,
        location,
      })

      if (result?.error) {
        let errorMessage = result.error

        if (result.error === 'CredentialsSignin') {
          try {
            const debugResponse = await fetch('/api/webapp/telegram/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ location, data: payload }),
            })

            const debugData = await debugResponse.json().catch(() => null)

            if (debugData) {
              if (debugData.success) {
                errorMessage =
                  'Авторизация прошла успешно, но не удалось обновить сессию. Попробуйте перезагрузить страницу.'
              } else if (debugData.errorMessage) {
                errorMessage = debugData.errorMessage
              } else if (debugData.errorCode) {
                errorMessage = `Ошибка авторизации Telegram (${debugData.errorCode}).`
              }
            }
          } catch (debugError) {
            console.error('Telegram auth debug error', debugError)
          }
        }

        throw new Error(errorMessage)
      }

      await updateSession()

      const getRedirectTarget = () => {
        if (!isClient) {
          return absoluteCallbackUrl
        }

        const safeResultUrl = extractRelativePath(
          result?.url,
          window.location.origin
        )

        if (
          safeResultUrl &&
          !safeResultUrl.startsWith('/cabinet') &&
          !safeResultUrl.startsWith('/api/auth')
        ) {
          return new URL(safeResultUrl, window.location.origin).toString()
        }

        return absoluteCallbackUrl
      }

      const redirectTarget = getRedirectTarget()

      if (isClient && redirectTarget) {
        try {
          const targetUrl = new URL(redirectTarget, window.location.origin)

          if (targetUrl.origin === window.location.origin) {
            const relativeTarget = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`

            if (relativeTarget && relativeTarget !== router.asPath) {
              await router.replace(relativeTarget)
            }
          } else {
            window.location.assign(targetUrl.toString())
          }

          return
        } catch (redirectError) {
          if (redirectTarget.startsWith('/')) {
            await router.replace(redirectTarget)
            return
          }

          window.location.assign(redirectTarget)
          return
        }
      }
    } catch (authError) {
      console.error('Telegram auth error', authError)
      setError(
        authError.message || 'Не удалось авторизоваться. Попробуйте ещё раз.'
      )
    }
  }

  const renderLogin = () => (
    <>
      {/* <button
        className="btn btn-primary"
        onClick={() =>
          handleTelegramAuth({
            id: 261102161,
            first_name: 'Алексей',
            last_name: 'Белинский Иллюзионист',
            username: 'Escalion',
            photo_url:
              'https://t.me/i/userpic/320/i4TFzvCH_iU5FLtMAmYEpCPz7guDcuETRzLoynlZamo.jpg',
            auth_date: 1760503777,
            hash: 'b1ff0088369bdfb0ab507d8f005dfe4688c610d311df993235721896e66c18fd',
          })
        }
      >
        Войти
      </button> */}
      <TelegramLogin
        availableLocations={availableLocations}
        location={location}
        onLocationChange={handleLocationChange}
        onAuth={handleTelegramAuth}
        isClient={isClient}
      />
    </>
  )

  const renderDashboard = () => (
    <div className="flex flex-col w-full max-w-5xl gap-8 mx-auto mt-10">
      <div className="flex flex-col gap-6 p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-primary dark:text-white">
            Личный кабинет ActQuest -{' '}
            {LOCATIONS[location]?.townRu
              ? `${
                  LOCATIONS[location].townRu[0].toUpperCase() +
                  LOCATIONS[location].townRu.slice(1)
                }`
              : 'Регион не выбран'}
          </h3>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <span className="text-sm text-blue-500 dark:text-blue-300">
                Загрузка…
              </span>
            ) : null}
            <button
              type="button"
              onClick={() =>
                loadMainMenu({ resetDisplay: true, initiatedByUser: true })
              }
              className="flex items-center justify-center w-10 h-10 text-blue-700 transition border border-blue-200 rounded-full bg-blue-50 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
              title="Обновить"
              aria-label="Обновить"
              disabled={isLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path d="M16.023 9.348h4.284m0 0V5.064m0 4.284-5.99-5.99A9.035 9.035 0 0 0 11.88 2.25c-4.978 0-9.023 4.045-9.023 9.023 0 .755.09 1.488.26 2.192" />
                <path d="M7.977 14.652H3.693m0 0v4.284m0-4.284 5.99 5.99a9.035 9.035 0 0 0 2.438 1.122c4.978 0 9.023-4.045 9.023-9.023a9.06 9.06 0 0 0-.26-2.192" />
              </svg>
            </button>
          </div>
        </div>
        <div
          ref={displayRef}
          className="min-h-[260px] max-h-[480px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left text-gray-800 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100"
        >
          {displayBlocks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-slate-400">
              Нажмите кнопку или отправьте сообщение, чтобы получить ответ
              сервера.
            </div>
          ) : (
            displayBlocks.map((block, index) => {
              if (block.type === 'image') {
                return (
                  <div key={block.id} className={index > 0 ? 'mt-4' : ''}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={block.content}
                      alt="Изображение от сервера ActQuest"
                      className="object-contain w-full border border-gray-200 rounded-2xl dark:border-slate-700"
                    />
                  </div>
                )
              }

              return (
                <div
                  key={block.id}
                  className={`leading-relaxed ${index > 0 ? 'mt-4' : ''}`}
                  dangerouslySetInnerHTML={{
                    __html: block.content.replace(/\n/g, '<br />'),
                  }}
                />
              )
            })
          )}
        </div>

        {keyboardButtons.length ? (
          <div className="flex flex-col gap-2">
            {keyboardButtons.map((row, rowIndex) => {
              const visibleButtons = Array.isArray(row)
                ? row.filter(isButtonVisible)
                : []

              if (visibleButtons.length === 0) {
                return null
              }

              return (
                <div key={`row-${rowIndex}`} className="flex flex-wrap gap-2">
                  {visibleButtons.map((button) => {
                    if (button.url) {
                      return (
                        <a
                          key={button.url}
                          href={button.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 px-3 py-2 text-sm font-semibold text-center text-blue-700 transition border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                        >
                          {button.text}
                        </a>
                      )
                    }

                    return (
                      <button
                        key={button.callback_data || button.text}
                        className="flex-1 px-3 py-2 text-sm font-semibold text-center text-blue-700 transition border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                        onClick={() => handleKeyboardAction(button)}
                        type="button"
                        disabled={isLoading}
                      >
                        {button.text}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 md:flex-row"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Введите команду или ответ..."
            rows={3}
            className="flex-1 px-4 py-3 text-base border border-gray-200 shadow-sm rounded-2xl focus:border-blue-400 focus:outline-none focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 resize-y"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-6 py-3 text-base font-semibold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            Отправить
          </button>
        </form>
        {error ? (
          <div className="px-4 py-3 text-sm text-red-600 rounded-xl bg-red-50 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <NotificationsCard
          notifications={notifications}
          hasUnread={hasUnreadNotifications}
          isExpanded={notificationsExpanded}
          onToggle={() => setNotificationsExpanded((prev) => !prev)}
          onRefresh={handleRefreshNotifications}
          onMarkAllRead={handleMarkNotificationsAsRead}
          isLoading={notificationsLoading}
          error={notificationsError}
          pushState={pushNotifications}
        />
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>ActQuest — Личный кабинет</title>
      </Head>
      <div className="min-h-screen bg-[#F5F6F8] pb-16 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <header className="transition-colors bg-white border-b border-gray-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between max-w-6xl px-4 py-5 mx-auto">
            <Link
              href="/"
              className="text-2xl font-bold transition-colors text-primary dark:text-white"
            >
              ActQuest
            </Link>
            <nav className="flex items-center gap-6 text-sm font-semibold text-gray-600 dark:text-slate-300">
              <a
                href="https://t.me/ActQuest_bot"
                className="transition hover:text-primary dark:hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Бот в Telegram
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleThemeToggle}
                className="px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
              >
                {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              </button>
              {session ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  Выйти
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-4">
          {session ? renderDashboard() : renderLogin()}
        </main>
      </div>
    </>
  )
}

CabinetPage.propTypes = {
  initialCallbackUrl: PropTypes.string,
  initialCallbackSource: PropTypes.string,
}

CabinetPage.defaultProps = {
  initialCallbackUrl: null,
  initialCallbackSource: null,
}

export const getServerSideProps = async (context) => {
  const { req, query } = context

  const session = await getSession({ req })
  const rawCallbackParam = query?.callbackUrl
  const decodedCallback = decodeCallbackParam(rawCallbackParam)
  const requestOrigin = getRequestOrigin(req)
  const relativeCallback = extractRelativePath(decodedCallback, requestOrigin)

  const isSafeCallback =
    typeof relativeCallback === 'string' &&
    relativeCallback &&
    !relativeCallback.startsWith('/cabinet') &&
    !relativeCallback.startsWith('/api/auth')

  if (session && isSafeCallback) {
    return {
      redirect: {
        destination: relativeCallback,
        permanent: false,
      },
    }
  }

  return {
    props: {
      initialCallbackUrl: relativeCallback || null,
      initialCallbackSource: decodedCallback || null,
    },
  }
}

export default CabinetPage
