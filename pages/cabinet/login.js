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

const VK_SDK_URL = 'https://unpkg.com/@vkid/sdk@2.6.5/dist-sdk/umd/index.js'
let vkSdkLoadPromise = null

const loadVkSdk = () => {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.VKIDSDK) return Promise.resolve(true)
  if (vkSdkLoadPromise) return vkSdkLoadPromise

  vkSdkLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = VK_SDK_URL
    script.async = true
    script.onload = () => resolve(Boolean(window.VKIDSDK))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return vkSdkLoadPromise
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
  const vkidAppId = Number.parseInt(
    String(
      process.env.NEXT_PUBLIC_VK_ID_APP_ID ||
        process.env.NEXT_PUBLIC_VKID_ONETAP_APP_ID ||
        process.env.NEXT_PUBLIC_VK_APP_ID ||
        '',
    ),
    10,
  )
  const vkidCallbackUrl =
    process.env.NEXT_PUBLIC_VK_ID_REDIRECT_URI ||
    process.env.NEXT_PUBLIC_VKID_CALLBACK_URL
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
    if (!isClient || !Number.isFinite(vkidAppId) || !vkIdWidgetContainerRef.current) {
      return undefined
    }

    const container = vkIdWidgetContainerRef.current
    let isMounted = true

    const init = async () => {
      const loaded = await loadVkSdk()
      if (!loaded || !isMounted || !container) {
        if (isMounted) {
          setVkError('VK One Tap SDK недоступен. Проверьте подключение.')
        }
        return
      }

      const VKID = window.VKIDSDK

      try {
        VKID.Config.init({
          app: vkidAppId,
          redirectUrl: resolveVkIdCallbackUrl(vkidCallbackUrl),
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        })
      } catch (error) {
        // может быть уже инициализировано
      }

      const oneTap = new VKID.OneTap()
      oneTap
        .render({
          container,
          showAlternativeLogin: true,
        })
        .on(VKID.WidgetEvents.ERROR, (error) => {
          if (!isMounted) return
          const vkWidgetError = error?.type || error?.code || error?.message
          setVkError(
            vkWidgetError
              ? `Ошибка виджета VK ID (${vkWidgetError}). Попробуйте вход по паролю.`
              : 'Ошибка виджета VK ID. Попробуйте вход по паролю.',
          )
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload) => {
          if (!isMounted) return

          const code = payload?.code
          const deviceId = payload?.device_id
          const codeVerifier =
            payload?.code_verifier ||
            payload?.codeVerifier ||
            payload?.verifier

          if (!code || !deviceId) {
            setVkError('VK ID не вернул код авторизации.')
            return
          }

          try {
            const exchangeResult = codeVerifier
              ? await VKID.Auth.exchangeCode(code, deviceId, codeVerifier)
              : await VKID.Auth.exchangeCode(code, deviceId)
            const accessToken =
              exchangeResult?.access_token || exchangeResult?.accessToken || null
            const vkId =
              exchangeResult?.user?.id ||
              exchangeResult?.id ||
              exchangeResult?.userId ||
              exchangeResult?.vkId ||
              null
            const firstName =
              exchangeResult?.user?.first_name ||
              exchangeResult?.user?.firstName ||
              exchangeResult?.firstName ||
              ''
            const lastName =
              exchangeResult?.user?.last_name ||
              exchangeResult?.user?.lastName ||
              exchangeResult?.lastName ||
              ''
            const photoUrl =
              exchangeResult?.user?.photo ||
              exchangeResult?.user?.photo_200 ||
              exchangeResult?.photoUrl ||
              null

            if (!accessToken || !vkId) {
              setVkError('Не удалось получить данные VK после авторизации.')
              return
            }

            await handleVkAuth({
              accessToken,
              vkId,
              firstName,
              lastName,
              photoUrl,
            })
          } catch (error) {
            console.error('VK OneTap exchange error', error)
            setVkError(
              'VK ID временно недоступен. Попробуйте позже или войдите по паролю.',
            )
          }
        })

      setIsVkIdReady(true)
    }

    init()

    return () => {
      isMounted = false
      setIsVkIdReady(false)
      if (container) container.innerHTML = ''
    }
  }, [isClient, vkidAppId, vkidCallbackUrl, handleVkAuth])

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
                      autoComplete="tel"
                      disabled={isAuthenticating}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                    />
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(event) => setPasswordInput(event.target.value)}
                      placeholder="Пароль"
                      autoComplete="current-password"
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
                      />
                      {!isVkIdReady ? (
                        <div className="mt-2 flex h-6 items-center justify-center text-xs text-slate-500">
                          Загрузка VK One Tap...
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-center text-slate-500 bg-slate-100 rounded-xl">
                      Укажите{' '}
                      <code className="px-1 bg-white dark:bg-slate-900/80 rounded">
                        NEXT_PUBLIC_VK_ID_APP_ID
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
