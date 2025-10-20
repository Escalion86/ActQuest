import Head from 'next/head'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { signIn, useSession } from 'next-auth/react'

import getSessionSafe from '@helpers/getSessionSafe'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import { LOCATIONS } from '@server/serverConstants'
import getTelegramBotNameByLocation from '@utils/telegram/getTelegramBotNameByLocation'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

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

    if (parsed.origin !== base.origin) {
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

const quickActions = [
  {
    id: 'create-game',
    title: 'Создать новую игру',
    description:
      'Заполните сценарий, настройте расписание и пригласите команды в несколько шагов.',
    href: '/cabinet/games',
  },
  {
    id: 'invite-team',
    title: 'Пригласить команду',
    description:
      'Отправьте ссылку на участие, назначьте капитана и управляйте составом.',
    href: '/cabinet/teams',
  },
  {
    id: 'update-profile',
    title: 'Обновить анкету',
    description:
      'Укажите актуальные контакты и роль в проекте, чтобы коллеги могли вас найти.',
    href: '/cabinet/profile',
  },
]

const activityFeed = [
  {
    id: 'activity-1',
    title: 'Команда «Северный свет» добавлена',
    time: '5 минут назад',
    category: 'Команды',
  },
  {
    id: 'activity-2',
    title: 'Игра «Осенний марафон» опубликована',
    time: '2 часа назад',
    category: 'Игры',
  },
  {
    id: 'activity-3',
    title: 'Обновлены контактные данные организатора',
    time: 'вчера',
    category: 'Профиль',
  },
]

const statsConfig = [
  {
    id: 'games',
    title: 'Активные игры',
    value: 4,
    delta: '+2 за неделю',
  },
  {
    id: 'teams',
    title: 'Команд участвует',
    value: 18,
    delta: '+5 новых',
  },
  {
    id: 'players',
    title: 'Игроков задействовано',
    value: 112,
    delta: 'стабильно',
  },
]

const CabinetDashboard = ({ authCallbackUrl, authCallbackSource, session: initialSession }) => {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [location, setLocation] = useState(
    () => session?.user?.location || initialSession?.user?.location || defaultLocation
  )
  const [authError, setAuthError] = useState(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const widgetContainerRef = useRef(null)

  const activeSession = session ?? initialSession ?? null
  const botName = useMemo(() => getTelegramBotNameByLocation(location), [location])
  const normalizedStats = useMemo(
    () =>
      statsConfig.map((item) => ({
        ...item,
        value: new Intl.NumberFormat('ru-RU').format(item.value),
      })),
    []
  )

  const updateSession = useCallback(() => {
    if (typeof update === 'function') {
      return update()
    }

    return Promise.resolve()
  }, [update])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (activeSession?.user?.location) {
      setLocation(activeSession.user.location)
    }
  }, [activeSession?.user?.location])

  const effectiveCallbackUrl = authCallbackUrl || '/cabinet'

  const handleTelegramAuth = useCallback(
    async (userData) => {
      if (!userData || isAuthenticating) return

      try {
        setAuthError(null)
        setIsAuthenticating(true)
        const payload = JSON.stringify(userData)
        let absoluteCallbackUrl = effectiveCallbackUrl

        if (isClient) {
          try {
            absoluteCallbackUrl = new URL(effectiveCallbackUrl, window.location.origin).toString()
          } catch (buildUrlError) {
            console.error('Не удалось сформировать callbackUrl авторизации', buildUrlError)
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

        const resolveRedirectTarget = () => {
          if (!isClient) {
            return absoluteCallbackUrl
          }

          const safeResultUrl = extractRelativePath(result?.url, window.location.origin)

          if (
            safeResultUrl &&
            safeResultUrl !== '/' &&
            !safeResultUrl.startsWith('/cabinet') &&
            !safeResultUrl.startsWith('/api/auth')
          ) {
            return new URL(safeResultUrl, window.location.origin).toString()
          }

          return absoluteCallbackUrl
        }

        const redirectTarget = resolveRedirectTarget()

        if (isClient && redirectTarget) {
          try {
            const targetUrl = new URL(redirectTarget, window.location.origin)

            if (targetUrl.origin === window.location.origin) {
              const relativeTarget = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`

              if (relativeTarget && relativeTarget !== router.asPath) {
                await router.replace(relativeTarget)
              }

              return
            }

            window.location.assign(targetUrl.toString())
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
        setAuthError(authError.message || 'Не удалось авторизоваться. Попробуйте ещё раз.')
      } finally {
        setIsAuthenticating(false)
      }
    },
    [effectiveCallbackUrl, isAuthenticating, isClient, location, router, updateSession]
  )

  useEffect(() => {
    if (!isClient) return undefined

    const container = widgetContainerRef.current
    if (!container) return undefined

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    if (!botName) return undefined

    if (typeof window !== 'undefined') {
      window.actquestTelegramAuth = (user) => handleTelegramAuth(user)
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '16')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-lang', 'ru')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-onauth', 'actquestTelegramAuth')

    container.appendChild(script)

    return () => {
      if (typeof window !== 'undefined' && window.actquestTelegramAuth) {
        delete window.actquestTelegramAuth
      }

      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
    }
  }, [botName, handleTelegramAuth, isClient])

  if (!activeSession && status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <span className="text-sm font-semibold tracking-widest uppercase">Загрузка кабинета…</span>
      </div>
    )
  }

  if (!activeSession) {
    const callbackDescription =
      effectiveCallbackUrl && effectiveCallbackUrl !== '/cabinet'
        ? 'После входа мы автоматически перенаправим вас на исходную страницу.'
        : 'После входа откроется панель управления ActQuest.'

    return (
      <>
        <Head>
          <title>ActQuest — вход в кабинет</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="px-4 py-16 mx-auto max-w-6xl">
            <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] items-start">
              <div className="space-y-6 text-white">
                <p className="inline-flex items-center px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/10">
                  Личный кабинет ActQuest
                </p>
                <h1 className="text-3xl font-semibold md:text-4xl">
                  Управляйте играми и командами в едином центре управления
                </h1>
                <p className="text-base text-slate-200 md:text-lg">
                  Собирайте команды, планируйте игры, контролируйте статистику и настройки проекта без переключения между ботами и таблицами. Всё, что нужно организатору, — в одном кабинете.
                </p>
                <ul className="space-y-3 text-sm text-slate-200 md:text-base">
                  <li className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 bg-white rounded-full">
                      1
                    </span>
                    <span>Выберите игровой регион, чтобы подключить нужную базу данных ActQuest.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 bg-white rounded-full">
                      2
                    </span>
                    <span>Подтвердите вход через Telegram — мы сверим данные с ботом и подготовим рабочую сессию.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 bg-white rounded-full">
                      3
                    </span>
                    <span>Вернём вас в нужный раздел кабинета и подгрузим все связанные данные.</span>
                  </li>
                </ul>
              </div>

              <div className="p-8 bg-white rounded-3xl shadow-2xl">
                <h2 className="text-2xl font-semibold text-primary">Войти в кабинет</h2>
                <p className="mt-2 text-sm text-slate-500">{callbackDescription}</p>
                {authCallbackSource ? (
                  <p className="mt-1 text-xs text-slate-400 break-words">
                    Запрошенный адрес: {authCallbackSource}
                  </p>
                ) : null}

                <div className="mt-6 space-y-5">
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    Игровой регион
                    <select
                      className="px-4 py-3 text-base transition border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      disabled={isAuthenticating}
                    >
                      {availableLocations.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.townRu[0].toUpperCase() + item.townRu.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-col items-center gap-3">
                    <div
                      ref={widgetContainerRef}
                      className="flex items-center justify-center w-full h-20"
                    />
                    {!botName ? (
                      <div className="px-4 py-3 text-xs text-center text-slate-500 bg-slate-100 rounded-xl">
                        Укажите переменную окружения <code className="px-1 bg-white rounded">NEXT_PUBLIC_TELEGRAM_{location.toUpperCase()}_BOT_NAME</code>, чтобы включить авторизацию.
                      </div>
                    ) : null}
                    <p className="text-xs text-center text-slate-400">
                      Нажимая кнопку входа, вы подтверждаете передачу данных Telegram для авторизации в ActQuest.
                    </p>
                    {authError ? (
                      <p className="w-full px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                        {authError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Кабинет</title>
      </Head>
      <CabinetLayout
        title="Обзор"
        description="Следите за активными играми, командами и ключевыми событиями вашего города."
        activePage="dashboard"
      >
        <section className="grid gap-4 md:grid-cols-3">
          {normalizedStats.map((stat) => (
            <article
              key={stat.id}
              className="p-5 transition-shadow bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-500">{stat.title}</p>
              <p className="mt-3 text-3xl font-semibold text-primary">{stat.value}</p>
              <p className="mt-2 text-xs font-medium text-emerald-600">{stat.delta}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h3 className="text-lg font-semibold text-primary">Быстрые действия</h3>
            <p className="mt-1 text-sm text-slate-500">
              Сосредоточьтесь на задачах — переходите к нужным разделам без лишних шагов.
            </p>
            <div className="mt-4 space-y-4">
              {quickActions.map((action) => (
                <a
                  key={action.id}
                  href={action.href}
                  className="block p-4 transition bg-slate-50 rounded-xl hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-primary">{action.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{action.description}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h3 className="text-lg font-semibold text-primary">Лента активности</h3>
            <p className="mt-1 text-sm text-slate-500">
              Последние изменения, которые произошли в вашем кабинете.
            </p>
            <ul className="mt-4 space-y-4">
              {activityFeed.map((item) => (
                <li key={item.id} className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-primary">{item.title}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>{item.category}</span>
                    <span>{item.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="p-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl text-white shadow-md">
          <h3 className="text-xl font-semibold">Запланируйте следующую игру</h3>
          <p className="mt-2 text-sm text-blue-100">
            Создавайте сценарии заранее, чтобы вовремя запустить квест и подготовить команды к старту.
          </p>
          <div className="flex flex-col gap-3 mt-6 md:flex-row">
            <a
              href="/cabinet/games"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-blue-700 bg-white rounded-xl shadow-sm"
            >
              Перейти к списку игр
            </a>
            <a
              href="/cabinet/admin"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white border border-white/40 rounded-xl hover:bg-white/10"
            >
              Управление доступами
            </a>
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)
  const { req, query } = context

  const rawCallbackParam = query?.callbackUrl
  const decodedCallback = decodeCallbackParam(rawCallbackParam)
  const requestOrigin = getRequestOrigin(req)
  const relativeCallback = extractRelativePath(decodedCallback, requestOrigin)

  const isSafeCallback =
    typeof relativeCallback === 'string' &&
    relativeCallback &&
    relativeCallback !== '/' &&
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
      session,
      authCallbackUrl: isSafeCallback ? relativeCallback : '/cabinet',
      authCallbackSource: decodedCallback || null,
    },
  }
}

export default CabinetDashboard
