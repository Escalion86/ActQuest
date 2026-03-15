import Head from 'next/head'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'

import getSessionSafe from '@helpers/getSessionSafe'
import {
  extractRelativePath,
  resolveCabinetCallback,
} from '@helpers/cabinetAuth'
import { LOCATIONS } from '@server/serverConstants'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

const normalizePhoneInput = (value) => {
  if (typeof value !== 'string') return ''
  return value.replace(/[^\d+]/g, '')
}

const getVkIdSdk = () => {
  const root = window.VKIDSDK || window.VKID || null
  if (!root) return null
  return root.VKID || root
}

const resolveVkIdCallbackUrl = (explicitCallbackUrl) => {
  if (typeof window === 'undefined') return ''

  const fallback = `${window.location.origin}/api/vk-id/callback`
  if (!explicitCallbackUrl || typeof explicitCallbackUrl !== 'string') {
    return fallback
  }

  try {
    return new URL(explicitCallbackUrl, window.location.origin).toString()
  } catch (error) {
    return fallback
  }
}

const resolveVkIdConfigValue = (enumObject, key, fallback) => {
  if (enumObject && typeof enumObject === 'object' && enumObject[key]) {
    return enumObject[key]
  }
  return fallback
}

const CabinetLoginPage = ({ authCallbackUrl, authCallbackSource }) => {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [location, setLocation] = useState(
    () => session?.user?.location || defaultLocation,
  )
  const [authError, setAuthError] = useState(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isVkIdReady, setIsVkIdReady] = useState(false)
  const [vkError, setVkError] = useState(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const vkIdWidgetContainerRef = useRef(null)
  const vkidAppId =
    process.env.NEXT_PUBLIC_VKID_ONETAP_APP_ID ||
    process.env.NEXT_PUBLIC_VK_APP_ID
  const vkidCallbackUrl = process.env.NEXT_PUBLIC_VKID_CALLBACK_URL
  const vkidSdkUrl =
    process.env.NEXT_PUBLIC_VKID_SDK_URL ||
    'https://unpkg.com/@vkid/sdk@2.0.0/dist-sdk/umd/index.js'
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

  const handleVkAuth = useCallback(
    async ({ accessToken, vkId, firstName, lastName, photoUrl }) => {
      if (!accessToken || !vkId || isAuthenticating) return

      try {
        setAuthError(null)
        setVkError(null)
        setIsAuthenticating(true)

        const payload = JSON.stringify({
          accessToken,
          vkId,
          firstName,
          lastName,
          photoUrl,
        })

        let absoluteCallbackUrl = effectiveCallbackUrl

        if (isClient) {
          try {
            absoluteCallbackUrl = new URL(
              effectiveCallbackUrl,
              window.location.origin,
            ).toString()
          } catch (buildUrlError) {
            console.error(
              'Не удалось сформировать callbackUrl авторизации',
              buildUrlError,
            )
            absoluteCallbackUrl = `${window.location.origin}/cabinet`
          }
        }

        const result = await signIn('vk', {
          redirect: false,
          callbackUrl: absoluteCallbackUrl,
          data: payload,
          location,
        })

        if (result?.error) {
          throw new Error(result.error)
        }

        await updateSession()

        const resolveRedirectTarget = () => {
          if (!isClient) {
            return absoluteCallbackUrl
          }

          const safeResultUrl = extractRelativePath(
            result?.url,
            window.location.origin,
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
          } catch {
            if (redirectTarget.startsWith('/')) {
              await router.replace(redirectTarget)
              return
            }
            window.location.assign(redirectTarget)
            return
          }
        }
      } catch (authError) {
        console.error('VK auth error', authError)
        setVkError(
          authError.message ||
            'Не удалось авторизоваться через VK. Попробуйте ещё раз.',
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
    ],
  )

  const handlePhoneAuthSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (isAuthenticating) return

      const digitsOnly = phoneInput.replace(/\D/g, '')
      if (!digitsOnly || digitsOnly.length < 10) {
        setAuthError('Введите корректный номер телефона.')
        return
      }
      if (!passwordInput) {
        setAuthError('Введите пароль.')
        return
      }

      try {
        setAuthError(null)
        setIsAuthenticating(true)

        const payload = JSON.stringify({
          phone: digitsOnly,
          password: passwordInput,
        })

        let absoluteCallbackUrl = effectiveCallbackUrl
        if (isClient) {
          try {
            absoluteCallbackUrl = new URL(
              effectiveCallbackUrl,
              window.location.origin,
            ).toString()
          } catch (buildUrlError) {
            console.error(
              'Не удалось сформировать callbackUrl авторизации',
              buildUrlError,
            )
            absoluteCallbackUrl = `${window.location.origin}/cabinet`
          }
        }

        const result = await signIn('password', {
          redirect: false,
          callbackUrl: absoluteCallbackUrl,
          data: payload,
          location,
        })

        if (result?.error) {
          if (result.error === 'CredentialsSignin') {
            throw new Error('Не удалось выполнить вход по номеру телефона.')
          }
          throw new Error(result.error)
        }

        await updateSession()

        const resolveRedirectTarget = () => {
          if (!isClient) return absoluteCallbackUrl

          const safeResultUrl = extractRelativePath(
            result?.url,
            window.location.origin,
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
          } catch {
            if (redirectTarget.startsWith('/')) {
              await router.replace(redirectTarget)
              return
            }
            window.location.assign(redirectTarget)
          }
        }
      } catch (authError) {
        console.error('Password auth error', authError)
        setAuthError(
          authError.message ||
            'Не удалось авторизоваться по номеру телефона и паролю. Попробуйте ещё раз.',
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
      phoneInput,
      passwordInput,
      router,
      updateSession,
    ],
  )

  useEffect(() => {
    if (!isClient || !vkidAppId || !vkIdWidgetContainerRef.current)
      return undefined

    const container = vkIdWidgetContainerRef.current
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const script = document.createElement('script')
    script.src = vkidSdkUrl
    script.async = true

    script.onload = () => {
      const VKID = getVkIdSdk()
      if (!VKID) {
        setVkError('VK One Tap SDK недоступен. Проверьте подключение.')
        return
      }

      try {
        const callbackUrl = resolveVkIdCallbackUrl(vkidCallbackUrl)
        const numericVkIdApp = Number(vkidAppId)
        if (!Number.isFinite(numericVkIdApp) || numericVkIdApp <= 0) {
          setVkError(
            'Не задан корректный NEXT_PUBLIC_VKID_ONETAP_APP_ID для VK One Tap.',
          )
          return
        }

        const responseMode = resolveVkIdConfigValue(
          VKID.ConfigResponseMode,
          'Callback',
          'callback',
        )
        const sourceMode = resolveVkIdConfigValue(
          VKID.ConfigSource,
          'LOWCODE',
          'lowcode',
        )

        VKID.Config.init({
          app: numericVkIdApp,
          redirectUrl: callbackUrl,
          responseMode,
          source: sourceMode,
          scope: '',
        })

        const oneTap = new VKID.OneTap()
        const widgetErrorEvent = resolveVkIdConfigValue(
          VKID.WidgetEvents,
          'ERROR',
          null,
        )
        const oneTapSuccessEvent = resolveVkIdConfigValue(
          VKID.OneTapInternalEvents,
          'LOGIN_SUCCESS',
          null,
        )

        if (!widgetErrorEvent || !oneTapSuccessEvent) {
          setVkError(
            'Текущая версия VKID SDK не поддерживает ожидаемые события One Tap.',
          )
          return
        }

        oneTap
          .render({
            container,
            showAlternativeLogin: true,
          })
          .on(widgetErrorEvent, (error) => {
            console.error('VK OneTap error', error)
            setVkError('Ошибка VK One Tap. Попробуйте другой способ входа.')
          })
          .on(oneTapSuccessEvent, (payload) => {
            const code = payload.code
            const deviceId = payload.device_id

            if (!code || !deviceId) {
              setVkError('Не удалось получить данные авторизации VK One Tap.')
              return
            }

            VKID.Auth.exchangeCode(code, deviceId)
              .then((data) => {
                const accessToken =
                  data.access_token || data.accessToken || null
                const vkId =
                  data.user?.id || data.id || data.userId || data.vkId || null
                const firstName =
                  data.user?.first_name ||
                  data.user?.firstName ||
                  data.firstName ||
                  ''
                const lastName =
                  data.user?.last_name ||
                  data.user?.lastName ||
                  data.lastName ||
                  ''
                const photoUrl =
                  data.user?.photo ||
                  data.user?.photo_200 ||
                  data.photoUrl ||
                  null

                if (!accessToken || !vkId) {
                  setVkError('Не удалось получить VK access token из One Tap.')
                  return
                }

                handleVkAuth({
                  accessToken,
                  vkId,
                  firstName,
                  lastName,
                  photoUrl,
                })
              })
              .catch((error) => {
                console.error('Ошибка обмена кода VK OneTap', error)
                setVkError(
                  'Не удалось обменять код VK One Tap. Попробуйте снова.',
                )
              })
          })

        setIsVkIdReady(true)
      } catch (initError) {
        console.error('VK OneTap init error', initError)
        setVkError(
          `Ошибка инициализации VK One Tap: ${initError?.message || 'проверьте настройки приложения.'}`,
        )
      }
    }

    script.onerror = () => {
      setVkError(
        'Не удалось загрузить VK One Tap SDK. Попробуйте обновить страницу.',
      )
    }

    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }

      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild)
        }
      }
    }
  }, [isClient, vkidAppId, vkidCallbackUrl, vkidSdkUrl, handleVkAuth])

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
                Собирайте команды, планируйте игры, контролируйте статистику и
                настройки проекта в одном интерфейсе.
                Всё, что нужно организатору, — в одном кабинете.
              </p>
              <ul className="space-y-3 text-sm text-slate-200 md:text-base">
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/80 rounded-full">
                    1
                  </span>
                  <span>
                    Выберите игровой регион, чтобы подключить нужную базу данных
                    ActQuest.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/80 rounded-full">
                    2
                  </span>
                  <span>
                    Выполните вход любым удобным способом и получите рабочую
                    сессию.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/80 rounded-full">
                    3
                  </span>
                  <span>
                    Вернём вас в нужный раздел кабинета и подгрузим все
                    связанные данные.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-8 bg-white dark:bg-slate-900/80 rounded-3xl shadow-2xl">
              <h2 className="text-2xl font-semibold text-primary">
                Войти в кабинет
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {callbackDescription}
              </p>
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
                  <form
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3"
                    onSubmit={handlePhoneAuthSubmit}
                  >
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Вход по номеру телефона и паролю
                    </p>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(event) =>
                        setPhoneInput(normalizePhoneInput(event.target.value))
                      }
                      placeholder="+7 900 000-00-00"
                      disabled={isAuthenticating}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                    />
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(event) => setPasswordInput(event.target.value)}
                      placeholder="Пароль"
                      disabled={isAuthenticating}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full px-4 py-3 text-sm font-semibold text-white transition bg-emerald-600 rounded-xl hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Войти
                    </button>
                    <p className="text-xs text-slate-500">
                      Нет аккаунта? Перейдите на регистрацию или используйте VK.
                    </p>
                    <Link
                      href={`/cabinet/register?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                      className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-semibold border rounded-xl border-primary text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    >
                      Открыть регистрацию
                    </Link>
                  </form>

                  {vkidAppId ? (
                    <div className="w-full mt-3">
                      <div className="mb-2 text-xs font-medium text-slate-600">
                        VK One Tap
                      </div>
                      <div
                        ref={vkIdWidgetContainerRef}
                        className="w-full h-14 border border-dashed rounded-xl border-slate-300"
                      >
                        {!isVkIdReady ? (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            Загрузка VK One Tap...
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-center text-slate-500 bg-slate-100 rounded-xl">
                      Укажите{' '}
                      <code className="px-1 bg-white dark:bg-slate-900/80 rounded">
                        NEXT_PUBLIC_VKID_ONETAP_APP_ID
                      </code>{' '}
                      для входа через VK One Tap.
                    </div>
                  )}
                  {vkError ? (
                    <p className="w-full px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                      {vkError}
                    </p>
                  ) : null}
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
    context?.req,
  )

  if (session) {
    const destination =
      isSafe && relativeCallback ? relativeCallback : '/cabinet'

    return {
      redirect: {
        destination,
        permanent: false,
      },
    }
  }

  return {
    props: {
      authCallbackUrl:
        isSafe && relativeCallback ? relativeCallback : '/cabinet',
      authCallbackSource: decodedCallback || null,
    },
  }
}

export default CabinetLoginPage
