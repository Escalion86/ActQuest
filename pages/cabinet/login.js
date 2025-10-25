import Head from 'next/head'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { signIn, useSession } from 'next-auth/react'

import getSessionSafe from '@helpers/getSessionSafe'
import {
  extractRelativePath,
  resolveCabinetCallback,
} from '@helpers/cabinetAuth'
import { LOCATIONS } from '@server/serverConstants'
import getTelegramBotNameByLocation from '@utils/telegram/getTelegramBotNameByLocation'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

const parseBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (!normalized) return false

    return ['1', 'true', 'yes', 'on'].includes(normalized)
  }

  return false
}

const rawMode = process.env.MODE ?? process.env.NODE_ENV ?? 'production'

const isTestAuthEnabled =
  rawMode !== 'production' || parseBooleanFlag(process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH)

const CabinetLoginPage = ({ authCallbackUrl, authCallbackSource }) => {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [location, setLocation] = useState(
    () => session?.user?.location || defaultLocation
  )
  const [authError, setAuthError] = useState(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const widgetContainerRef = useRef(null)

  const botName = useMemo(() => getTelegramBotNameByLocation(location), [location])
  const effectiveCallbackUrl = authCallbackUrl || '/cabinet'

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session?.user?.location) {
      setLocation(session.user.location)
    }
  }, [session?.user?.location])

  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      return
    }

    const redirectTarget =
      effectiveCallbackUrl && effectiveCallbackUrl !== '/cabinet/login'
        ? effectiveCallbackUrl
        : '/cabinet'

    if (redirectTarget && redirectTarget !== router.asPath) {
      router.replace(redirectTarget).catch(() => {})
    }
  }, [effectiveCallbackUrl, router, session, status])

  const updateSession = useCallback(() => {
    if (typeof update === 'function') {
      return update()
    }

    return Promise.resolve()
  }, [update])

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
            absoluteCallbackUrl = new URL(
              effectiveCallbackUrl,
              window.location.origin
            ).toString()
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

          const safeResultUrl = extractRelativePath(
            result?.url,
            window.location.origin
          )

          if (safeResultUrl && safeResultUrl !== '/cabinet/login') {
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
        setAuthError(
          authError.message || 'Не удалось авторизоваться. Попробуйте ещё раз.'
        )
      } finally {
        setIsAuthenticating(false)
      }
    },
    [
      effectiveCallbackUrl,
      isAuthenticating,
      isClient,
      location,
      router,
      updateSession,
    ]
  )

  const handleTestLogin = useCallback(() => {
    if (!isTestAuthEnabled || isAuthenticating) return

    handleTelegramAuth({
      id: '261102161',
      __isTestAuth: true,
      __testLocation: location,
    })
  }, [handleTelegramAuth, isAuthenticating, location])

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
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/80 rounded-full">
                    1
                  </span>
                  <span>Выберите игровой регион, чтобы подключить нужную базу данных ActQuest.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/80 rounded-full">
                    2
                  </span>
                  <span>Подтвердите вход через Telegram — мы сверим данные с ботом и подготовим рабочую сессию.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/80 rounded-full">
                    3
                  </span>
                  <span>Вернём вас в нужный раздел кабинета и подгрузим все связанные данные.</span>
                </li>
              </ul>
            </div>

            <div className="p-8 bg-white dark:bg-slate-900/80 rounded-3xl shadow-2xl">
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
                    className="px-4 py-3 text-base transition border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                  <div ref={widgetContainerRef} className="flex items-center justify-center w-full h-20" />
                  {!botName ? (
                    <div className="px-4 py-3 text-xs text-center text-slate-500 bg-slate-100 rounded-xl">
                      Укажите переменную окружения <code className="px-1 bg-white dark:bg-slate-900/80 rounded">NEXT_PUBLIC_TELEGRAM_{location.toUpperCase()}_BOT_NAME</code>, чтобы включить авторизацию.
                    </div>
                  ) : null}
                  {isTestAuthEnabled ? (
                    <button
                      type="button"
                      onClick={handleTestLogin}
                      disabled={isAuthenticating}
                      className="w-full px-4 py-3 text-sm font-semibold text-white transition bg-slate-600 rounded-xl hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Тестовый вход без Telegram
                    </button>
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

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)
  const { decodedCallback, relativeCallback, isSafe } = resolveCabinetCallback(
    context?.query?.callbackUrl,
    context?.req
  )

  if (session) {
    const destination = isSafe && relativeCallback ? relativeCallback : '/cabinet'

    return {
      redirect: {
        destination,
        permanent: false,
      },
    }
  }

  return {
    props: {
      authCallbackUrl: isSafe && relativeCallback ? relativeCallback : '/cabinet',
      authCallbackSource: decodedCallback || null,
    },
  }
}

export default CabinetLoginPage
