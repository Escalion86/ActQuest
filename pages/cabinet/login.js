import Head from 'next/head'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import NoticeBanner from '@components/NoticeBanner'

import getSessionSafe from '@helpers/getSessionSafe'
import {
  extractRelativePath,
  resolveCabinetCallback,
} from '@helpers/cabinetAuth'
import { formatPhoneInput, normalizePhoneForSubmit } from '@helpers/phoneInputMask'
import { LOCATIONS } from '@server/serverConstants'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'
const defaultSiteAccess = {
  allowSiteAuth: true,
  allowSiteRegistration: true,
  enableVkOneTap: true,
}
const isVkDebugEnabled =
  process.env.NEXT_PUBLIC_VK_AUTH_DEBUG === 'true' ||
  process.env.NEXT_PUBLIC_VK_DEBUG_LOGS === 'true'

const VK_SIGNIN_ERROR_MESSAGES = {
  VK_BAD_REQUEST: 'Неполные данные для входа через VK ID. Обновите страницу.',
  VK_AUTH_DISABLED: 'Вход через VK ID временно отключен для выбранного региона.',
  VK_EXCHANGE_FAILED:
    'VK ID временно недоступен. Попробуйте позже или войдите по номеру телефона.',
  VK_USERINFO_FAILED:
    'Не удалось получить профиль VK. Попробуйте позже или войдите по номеру телефона.',
  VK_PROFILE_INVALID: 'Профиль VK ID передан некорректно.',
  VK_SERVER_UNAVAILABLE: 'Сервис авторизации временно недоступен.',
  VK_ACCOUNT_NOT_FOUND:
    'Аккаунт не найден. Зарегистрируйтесь по номеру телефона или через VK позже.',
  CredentialsSignin:
    'Не удалось завершить вход через VK ID. Попробуйте снова или войдите по номеру телефона.',
}

const mapVkSignInError = (errorCode) =>
  VK_SIGNIN_ERROR_MESSAGES[errorCode] ||
  'Не удалось выполнить вход через VK ID. Попробуйте позже.'

const summarizeVkMessageData = (data) => {
  if (!data || typeof data !== 'object') {
    return { type: typeof data }
  }

  return {
    action: data.action ?? null,
    event: data.event ?? null,
    handler: data.handler ?? null,
    type: data.type ?? null,
    code: data.code ?? null,
    hasPayload: Boolean(data.payload && typeof data.payload === 'object'),
    payloadKeys:
      data.payload && typeof data.payload === 'object'
        ? Object.keys(data.payload).sort()
        : [],
    keys: Object.keys(data).sort(),
  }
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

const parseVkAppId = (value) => {
  const raw = String(value || '').trim().replace(/^['"]|['"]$/g, '')
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const normalizeEnvUrl = (value) => {
  const raw = String(value || '').trim().replace(/^['"]|['"]$/g, '')
  if (!raw) return ''
  try {
    return new URL(raw).toString()
  } catch {
    return ''
  }
}

const CabinetLoginPage = ({
  authCallbackUrl,
  authCallbackSource,
  isVkAuthVisible,
  vkidAppId,
  vkidCallbackUrl,
  vkidScope,
}) => {
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
  const [siteAccess, setSiteAccess] = useState(defaultSiteAccess)
  const [isSiteAccessLoading, setIsSiteAccessLoading] = useState(false)
  const [authDebugEvents, setAuthDebugEvents] = useState([])
  const vkIdWidgetContainerRef = useRef(null)
  const isAuthenticatingRef = useRef(false)
  const vkAuthInFlightRef = useRef(false)
  const handleVkAuthRef = useRef(null)
  const vkWidgetInstanceRef = useRef(null)
  const vkWidgetConfigKeyRef = useRef('')
  const effectiveCallbackUrl = authCallbackUrl || '/cabinet'
  const isVkSignInEnabled =
    isVkAuthVisible && siteAccess.allowSiteAuth && siteAccess.enableVkOneTap

  const appendAuthDebug = useCallback((stage, payload = null) => {
    if (!isVkDebugEnabled) return
    const event = {
      time: new Date().toISOString(),
      stage,
      payload,
    }
    setAuthDebugEvents((prev) => [event, ...prev].slice(0, 60))
    console.info('[VK_FLOW_DEBUG]', stage, payload)
  }, [])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session?.user?.location) {
      setLocation(session.user.location)
    }
  }, [session?.user?.location])

  useEffect(() => {
    appendAuthDebug('session_status_changed', {
      status,
      hasSession: Boolean(session),
      location: session?.user?.location ?? null,
    })
  }, [appendAuthDebug, session, status])

  useEffect(() => {
    isAuthenticatingRef.current = isAuthenticating
  }, [isAuthenticating])

  useEffect(() => {
    if (!isClient || !location) {
      return undefined
    }

    let cancelled = false

    const fetchSiteAccess = async () => {
      appendAuthDebug('site_access_fetch_start', { location })
      setIsSiteAccessLoading(true)
      try {
        const response = await fetch(
          `/api/public/site-access?location=${encodeURIComponent(location)}`,
        )
        const json = await response.json()
        appendAuthDebug('site_access_fetch_response', {
          location,
          ok: response.ok,
          success: json?.success ?? null,
          data: json?.data ?? null,
        })
        if (!cancelled && response.ok && json?.success && json?.data) {
          setSiteAccess({
            allowSiteAuth: Boolean(json.data.allowSiteAuth),
            allowSiteRegistration: Boolean(json.data.allowSiteRegistration),
            enableVkOneTap: Boolean(json.data.enableVkOneTap),
          })
          return
        }
      } catch (error) {
        console.error('Failed to load site access controls', error)
      } finally {
        if (!cancelled) {
          setIsSiteAccessLoading(false)
        }
      }

      if (!cancelled) {
        setSiteAccess(defaultSiteAccess)
        appendAuthDebug('site_access_fallback_default', { location })
      }
    }

    fetchSiteAccess()

    return () => {
      cancelled = true
    }
  }, [isClient, location])

  useEffect(() => {
    if (!isClient || !isVkDebugEnabled) return undefined

    const onMessage = (event) => {
      const origin = String(event?.origin || '')
      if (!origin.endsWith('.vk.ru') && !origin.endsWith('.vk.com')) return

      appendAuthDebug('vk_message_in', {
        origin,
        data: summarizeVkMessageData(event?.data),
      })
    }

    window.addEventListener('message', onMessage)
    appendAuthDebug('vk_message_listener_attached')
    return () => {
      window.removeEventListener('message', onMessage)
      appendAuthDebug('vk_message_listener_detached')
    }
  }, [appendAuthDebug, isClient])

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
    async ({ code, deviceId, codeVerifier, state, accessToken }) => {
      appendAuthDebug('vk_auth_start', {
        hasCode: Boolean(code),
        hasDeviceId: Boolean(deviceId),
        hasCodeVerifier: Boolean(codeVerifier),
        hasState: Boolean(state),
        hasAccessToken: Boolean(accessToken),
        location,
      })
      if (
        !code ||
        !deviceId ||
        isAuthenticatingRef.current ||
        vkAuthInFlightRef.current
      ) {
        return
      }
      if (!isVkSignInEnabled) {
        setVkError('Вход через VK One Tap отключён для выбранного региона.')
        return
      }

      try {
        vkAuthInFlightRef.current = true
        setAuthError(null)
        setVkError(null)
        setIsAuthenticating(true)

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
          location,
          mode: 'login',
          code,
          deviceId,
          accessToken,
          codeVerifier: codeVerifier || undefined,
          state: state || undefined,
        })
        appendAuthDebug('vk_signin_result', {
          hasError: Boolean(result?.error),
          hasUrl: Boolean(result?.url),
          error: result?.error ?? null,
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
        appendAuthDebug('vk_auth_error', {
          message: authError?.message ?? null,
          name: authError?.name ?? null,
        })
        setVkError(mapVkSignInError(authError.message))
      } finally {
        vkAuthInFlightRef.current = false
        setIsAuthenticating(false)
        appendAuthDebug('vk_auth_finish')
      }
    },
    [
      effectiveCallbackUrl,
      isClient,
      isVkSignInEnabled,
      location,
      router,
      updateSession,
    ],
  )

  useEffect(() => {
    handleVkAuthRef.current = handleVkAuth
  }, [handleVkAuth])

  const handlePhoneAuthSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (isAuthenticating) return

      if (!siteAccess.allowSiteAuth) {
        setAuthError('Авторизация на сайте временно отключена для выбранного региона.')
        return
      }

      const digitsOnly = normalizePhoneForSubmit(phoneInput)
      if (!digitsOnly || digitsOnly.length < 11) {
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
      siteAccess.allowSiteAuth,
      updateSession,
    ],
  )

  useEffect(() => {
    if (
      !isClient ||
      !isVkSignInEnabled ||
      !Number.isFinite(vkidAppId) ||
      !vkIdWidgetContainerRef.current
    ) {
      return undefined
    }

    const container = vkIdWidgetContainerRef.current
    const configKey = [
      vkidAppId,
      vkidCallbackUrl || '',
      vkidScope || '',
      location || '',
      Number(isVkSignInEnabled),
    ].join('|')

    if (vkWidgetConfigKeyRef.current === configKey && vkWidgetInstanceRef.current) {
      appendAuthDebug('vk_widget_init_skipped_same_config', { configKey })
      return undefined
    }
    vkWidgetConfigKeyRef.current = configKey

    let isMounted = true

    const init = async () => {
      appendAuthDebug('vk_widget_init_start', {
        configKey,
        vkidAppId,
        vkidCallbackUrl,
        vkidScope,
        location,
      })
      const loaded = await loadVkSdk()
      if (!loaded || !isMounted || !container) {
        if (isMounted) {
          setVkError('VK One Tap SDK недоступен. Проверьте подключение.')
          appendAuthDebug('vk_sdk_load_failed', {
            loaded,
            isMounted,
            hasContainer: Boolean(container),
          })
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
          scope: vkidScope,
        })
        appendAuthDebug('vk_config_init_ok', {
          responseMode: 'callback',
          source: 'lowcode',
        })
      } catch (error) {
        // может быть уже инициализировано
        appendAuthDebug('vk_config_init_skip_or_error', {
          message: error?.message ?? null,
        })
      }

      const oneTap = new VKID.OneTap()
      vkWidgetInstanceRef.current = oneTap
      oneTap
        .render({
          container,
          showAlternativeLogin: true,
        })
        .on(VKID.WidgetEvents.ERROR, (error) => {
          if (!isMounted) return
          const vkWidgetErrorCode = error?.code ?? error?.type ?? null
          const vkWidgetErrorText =
            error?.text ||
            error?.message ||
            error?.details?.error_description ||
            error?.details?.error ||
            null
          console.error('VK widget error', error)
          appendAuthDebug('vk_widget_error', {
            code: vkWidgetErrorCode,
            text: vkWidgetErrorText,
            raw: summarizeVkMessageData(error),
          })
          setVkError(
            vkWidgetErrorText && vkWidgetErrorCode !== null
              ? `Ошибка виджета VK ID (${vkWidgetErrorCode}): ${vkWidgetErrorText}. Попробуйте вход по паролю.`
              : vkWidgetErrorText
                ? `Ошибка виджета VK ID: ${vkWidgetErrorText}. Попробуйте вход по паролю.`
                : vkWidgetErrorCode !== null
                  ? `Ошибка виджета VK ID (${vkWidgetErrorCode}). Попробуйте вход по паролю.`
                  : 'Ошибка виджета VK ID. Попробуйте вход по паролю.',
          )
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload) => {
          if (!isMounted) return

          if (isVkDebugEnabled) {
            console.info('[VK_DEBUG][client] one_tap_login_success', {
              payloadKeys:
                payload && typeof payload === 'object'
                  ? Object.keys(payload).sort()
                  : [],
              hasCode: Boolean(payload?.code),
              hasDeviceId: Boolean(payload?.device_id),
              hasCodeVerifier: Boolean(
                payload?.code_verifier || payload?.codeVerifier || payload?.verifier,
              ),
            })
          }

          const code = payload?.code
          const deviceId = payload?.device_id
          const codeVerifier =
            payload?.code_verifier || payload?.codeVerifier || payload?.verifier
          const state = payload?.state || null
          appendAuthDebug('vk_login_success_payload', {
            hasCode: Boolean(code),
            hasDeviceId: Boolean(deviceId),
            hasCodeVerifier: Boolean(codeVerifier),
            hasState: Boolean(state),
            payloadKeys:
              payload && typeof payload === 'object'
                ? Object.keys(payload).sort()
                : [],
          })

          if (!code || !deviceId) {
            setVkError('VK ID не вернул код авторизации.')
            return
          }

          try {
            let accessToken = null
            if (!codeVerifier && VKID?.Auth?.exchangeCode) {
              try {
                appendAuthDebug('vk_client_exchange_start')
                const exchangeResult = await VKID.Auth.exchangeCode(code, deviceId)
                accessToken = exchangeResult?.access_token || null
                appendAuthDebug('vk_client_exchange_result', {
                  hasAccessToken: Boolean(accessToken),
                })
              } catch (clientExchangeError) {
                appendAuthDebug('vk_client_exchange_error', {
                  message: clientExchangeError?.message ?? null,
                  name: clientExchangeError?.name ?? null,
                })
                setVkError(
                  'VK ID временно недоступен. Попробуйте позже или войдите по паролю.',
                )
                return
              }
            }

            if (isVkDebugEnabled) {
              console.info('[VK_DEBUG][client] server_exchange_auth_params', {
                hasCode: Boolean(code),
                hasDeviceId: Boolean(deviceId),
                hasCodeVerifier: Boolean(codeVerifier),
                hasState: Boolean(state),
                hasAccessToken: Boolean(accessToken),
              })
            }

            await handleVkAuthRef.current?.({
              code,
              deviceId,
              accessToken,
              codeVerifier: codeVerifier || null,
              state: state || null,
            })
          } catch (error) {
            console.error('VK OneTap auth error', error)
            if (isVkDebugEnabled) {
              console.info('[VK_DEBUG][client] server_exchange_auth_error', {
                message: error?.message ?? null,
                name: error?.name ?? null,
                stack: error?.stack ?? null,
              })
            }
            setVkError(
              'VK ID временно недоступен. Попробуйте позже или войдите по паролю.',
            )
          }
        })

      setIsVkIdReady(true)
      appendAuthDebug('vk_widget_ready')
    }

    init()

    return () => {
      isMounted = false
      setIsVkIdReady(false)
      vkWidgetInstanceRef.current = null
      if (container) container.innerHTML = ''
      appendAuthDebug('vk_widget_cleanup')
    }
  }, [
    appendAuthDebug,
    isClient,
    vkidAppId,
    vkidCallbackUrl,
    vkidScope,
    location,
    isVkSignInEnabled,
  ])

  return (
    <>
      <Head>
        <title>ActQuest — вход в кабинет</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-6xl px-4 py-16 mx-auto">
          <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] items-start">
            <div className="space-y-6 text-white">
              <p className="inline-flex items-center px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/10">
                Личный кабинет ActQuest
              </p>
              <h1 className="text-3xl font-semibold md:text-4xl">
                Открывайте городские игры и проводите время с друзьями
              </h1>
              <p className="text-base text-slate-200 md:text-lg">
                В кабинете вы выбираете игру, собираете команду и отслеживаете
                участие в одном месте. Подходит и для новых игроков, и для тех,
                кто уже регулярно выходит на квесты.
              </p>
              <ul className="space-y-3 text-sm text-slate-200 md:text-base">
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold bg-white rounded-full text-slate-900 dark:text-slate-100 dark:bg-slate-900/80">
                    1
                  </span>
                  <span>
                    Выберите город, чтобы увидеть актуальные игры и события.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold bg-white rounded-full text-slate-900 dark:text-slate-100 dark:bg-slate-900/80">
                    2
                  </span>
                  <span>
                    {isVkAuthVisible
                      ? 'Войдите через VK ID или по номеру телефона и паролю.'
                      : 'Войдите по номеру телефона и паролю.'}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold bg-white rounded-full text-slate-900 dark:text-slate-100 dark:bg-slate-900/80">
                    3
                  </span>
                  <span>
                    Переходите в кабинет: выбирайте игру, собирайте друзей и
                    выходите на маршрут.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-8 bg-white shadow-2xl dark:bg-slate-900/80 rounded-3xl">
              <h2 className="text-2xl font-semibold text-center text-primary">
                Авторизация
              </h2>
              {authCallbackSource ? (
                <p className="mt-2 text-xs text-center break-words text-slate-400">
                  Запрошенный адрес: {authCallbackSource}
                </p>
              ) : null}

              <div className="mt-6 space-y-4">
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

                <div className="flex flex-col items-center gap-4">
                  {isVkSignInEnabled && vkidAppId ? (
                    <div className="w-full">
                      <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Войти через VK ID
                      </div>
                      <div ref={vkIdWidgetContainerRef} className="w-full" />
                      {!isVkIdReady ? (
                        <div className="flex items-center justify-center h-6 mt-2 text-xs text-slate-500">
                          Загрузка VK One Tap...
                        </div>
                      ) : null}
                    </div>
                  ) : isVkSignInEnabled ? (
                    <div className="px-4 py-3 text-xs text-center text-slate-500 bg-slate-100 rounded-xl">
                      Проверьте переменную{' '}
                      <code className="px-1 bg-white rounded dark:bg-slate-900/80">
                        VK_ID_APP_ID
                      </code>{' '}
                      на сервере для входа через VK One Tap.
                    </div>
                  ) : null}

                  {!siteAccess.allowSiteAuth ? (
                    <NoticeBanner tone="warning">
                      Авторизация временно отключена, ведутся работы.
                    </NoticeBanner>
                  ) : null}

                  {isSiteAccessLoading ? (
                    <NoticeBanner className="text-xs" centered>
                      Загружаем настройки доступа...
                    </NoticeBanner>
                  ) : null}

                  <div className="w-full text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    или войдите по номеру телефона
                  </div>

                  <form
                    className="w-full p-4 space-y-3 border rounded-xl border-slate-200 dark:border-slate-700"
                    onSubmit={handlePhoneAuthSubmit}
                  >
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(event) =>
                        setPhoneInput(formatPhoneInput(event.target.value))
                      }
                      placeholder="+7 900 000-00-00"
                      autoComplete="tel"
                      disabled={isAuthenticating || !siteAccess.allowSiteAuth}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                    />
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Пароль
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(event) => setPasswordInput(event.target.value)}
                      placeholder="Введите пароль"
                      autoComplete="current-password"
                      disabled={isAuthenticating || !siteAccess.allowSiteAuth}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isAuthenticating || !siteAccess.allowSiteAuth}
                      className="w-full px-4 py-3 text-sm font-semibold text-white transition bg-emerald-600 rounded-xl hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Войти
                    </button>
                  </form>

                  {siteAccess.allowSiteRegistration ? (
                    <Link
                      href={`/cabinet/register?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                      className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-semibold border rounded-xl border-primary text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    >
                      Я не зарегистрирован
                    </Link>
                  ) : (
                    <NoticeBanner centered>
                      Регистрация временно отключена, ведутся работы.
                    </NoticeBanner>
                  )}

                  <div className="w-full text-sm text-center text-slate-500">
                    Забыли пароль?{' '}
                    <Link
                      href={
                        siteAccess.allowSiteRegistration
                          ? `/cabinet/register?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`
                          : '/cabinet/login'
                      }
                      className={`font-semibold ${
                        siteAccess.allowSiteRegistration
                          ? 'text-primary hover:underline'
                          : 'text-slate-400 cursor-default pointer-events-none'
                      }`}
                    >
                      Восстановить
                    </Link>
                  </div>
                  <div className="w-full text-sm text-center">
                    <Link
                      href="/"
                      className="font-semibold text-primary hover:underline"
                    >
                      Перейти на главную страницу
                    </Link>
                  </div>

                  {vkError ? (
                    <NoticeBanner tone="error">
                      {vkError}
                    </NoticeBanner>
                  ) : null}
                  {authError ? (
                    <NoticeBanner tone="error">
                      {authError}
                    </NoticeBanner>
                  ) : null}
                  {isVkDebugEnabled ? (
                    <div className="w-full p-3 text-xs border rounded-xl border-slate-300 bg-slate-50 text-slate-700 max-h-64 overflow-auto">
                      <div className="font-semibold mb-2">
                        VK/Auth Debug
                      </div>
                      <div className="mb-2">
                        status={status}; isAuthenticating={String(isAuthenticating)};
                        vkReady={String(isVkIdReady)};
                        vkEnabled={String(isVkSignInEnabled)};
                        location={location}
                      </div>
                      {authDebugEvents.length === 0 ? (
                        <div>События пока не получены</div>
                      ) : (
                        authDebugEvents.map((item, index) => (
                          <pre key={`${item.time}-${item.stage}-${index}`} className="mb-2 whitespace-pre-wrap break-words">
                            [{item.time}] {item.stage}
                            {item.payload ? `\n${JSON.stringify(item.payload)}` : ''}
                          </pre>
                        ))
                      )}
                    </div>
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
  const currentMode = String(
    process.env.MODE ?? process.env.NODE_ENV ?? 'production',
  ).toLowerCase()
  const isVkAuthVisible = currentMode !== 'development'
  const vkidAppId = parseVkAppId(process.env.VK_ID_APP_ID)
  const vkidCallbackUrl =
    normalizeEnvUrl(process.env.VK_ID_REDIRECT_URI) ||
    normalizeEnvUrl(
      process.env.DOMAIN ? `${process.env.DOMAIN}/api/vk-id/callback` : '',
    )
  const vkidScope = process.env.VK_ID_SCOPE || 'phone email'

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
      isVkAuthVisible,
      vkidAppId,
      vkidCallbackUrl,
      vkidScope,
    },
  }
}

export default CabinetLoginPage
