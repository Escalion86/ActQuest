'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import NoticeBanner from '@components/NoticeBanner'
import AuthSplitLayout from '@components/cabinet/auth/AuthSplitLayout'

import { defaultSiteAccess } from '@helpers/cabinetSiteAccess'
import {
  extractRelativePath,
} from '@helpers/cabinetAuth'
import { formatPhoneInput, normalizePhoneForSubmit } from '@helpers/phoneInputMask'
import { mapVkSignInError } from '@helpers/vkAuthErrors'
import {
  loadVkSdk,
  resolveVkIdCallbackUrl,
} from '@helpers/vkIdClient'
import { LOCATIONS } from '@server/serverConstants'

const PUBLIC_API_BASE = '/api/public'

const defaultLocation =
  Object.entries(LOCATIONS).find(([, value]) => !value.hidden)?.[0] ?? ''
const isVkDebugEnabled =
  process.env.NEXT_PUBLIC_VK_AUTH_DEBUG === 'true' ||
  process.env.NEXT_PUBLIC_VK_DEBUG_LOGS === 'true'

const mapPasswordSignInError = (errorCode) => {
  if (!errorCode) {
    return 'Не удалось авторизоваться по номеру телефона и паролю. Попробуйте ещё раз.'
  }

  if (errorCode === 'CredentialsSignin') {
    return 'Не удалось выполнить вход по номеру телефона.'
  }

  return String(errorCode)
}

const removeVkHintFromError = (message) =>
  String(message || '').replace(/\s*или войдите через VK\.?/i, '.')

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


const CabinetLoginPage = ({
  authCallbackUrl,
  isVkAuthVisible,
  vkidAppId,
  vkidCallbackUrl,
  vkidScope,
}) => {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
  const currentPath = `${pathname || ''}${
    searchParams?.toString() ? `?${searchParams.toString()}` : ''
  }`
  const normalizedSessionLocation =
    typeof session?.user?.location === 'string'
      ? session.user.location.trim().toLowerCase()
      : ''
  const authLocation =
    normalizedSessionLocation &&
    normalizedSessionLocation !== 'all' &&
    LOCATIONS?.[normalizedSessionLocation] &&
    !LOCATIONS[normalizedSessionLocation]?.hidden
      ? normalizedSessionLocation
      : ''
  const siteAccessLocation = authLocation || defaultLocation
  const isVkSignInEnabled =
    isVkAuthVisible && siteAccess.allowSiteAuth && siteAccess.enableVkOneTap
  const isAuthResolvedAsGuest = status === 'unauthenticated'
  const isVkLoginOptionVisible =
    isAuthResolvedAsGuest && isVkSignInEnabled && Boolean(vkidAppId)
  const shouldShowRegisterCtaForAuthError = Boolean(
    authError &&
      typeof authError === 'string' &&
      authError.toLowerCase().includes('пароль не задан') &&
      siteAccess.allowSiteRegistration,
  )

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
    appendAuthDebug('session_status_changed', {
      status,
      hasSession: Boolean(session),
      location: session?.user?.location ?? authLocation ?? null,
    })
  }, [appendAuthDebug, authLocation, session, status])

  useEffect(() => {
    isAuthenticatingRef.current = isAuthenticating
  }, [isAuthenticating])

  useEffect(() => {
    if (!isClient || !siteAccessLocation) {
      return undefined
    }

    let cancelled = false

    const fetchSiteAccess = async () => {
      appendAuthDebug('site_access_fetch_start', { location: siteAccessLocation })
      setIsSiteAccessLoading(true)
      try {
        const response = await fetch(
          `${PUBLIC_API_BASE}/site-access?location=${encodeURIComponent(siteAccessLocation)}`,
        )
        const json = await response.json()
        appendAuthDebug('site_access_fetch_response', {
          location: siteAccessLocation,
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
        appendAuthDebug('site_access_fallback_default', { location: siteAccessLocation })
      }
    }

    fetchSiteAccess()

    return () => {
      cancelled = true
    }
  }, [isClient, siteAccessLocation])

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

    if (redirectTarget && redirectTarget !== currentPath) {
      router.replace(redirectTarget)
    }
  }, [currentPath, effectiveCallbackUrl, router, session, status])

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
        location: authLocation,
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
          location: authLocation || undefined,
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
              if (relativeTarget && relativeTarget !== currentPath) {
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
      authLocation,
      currentPath,
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
          location: authLocation || undefined,
        })

        if (result?.error) {
          const mappedMessage = mapPasswordSignInError(result.error)
          setAuthError(
            isVkLoginOptionVisible
              ? mappedMessage
              : removeVkHintFromError(mappedMessage),
          )
          return
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
              if (relativeTarget && relativeTarget !== currentPath) {
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
        const fallbackMessage =
          authError.message ||
          'Не удалось авторизоваться по номеру телефона и паролю. Попробуйте ещё раз.'
        setAuthError(
          isVkLoginOptionVisible
            ? fallbackMessage
            : removeVkHintFromError(fallbackMessage),
        )
      } finally {
        setIsAuthenticating(false)
      }
    },
    [
      effectiveCallbackUrl,
      isAuthenticating,
      isClient,
      authLocation,
      phoneInput,
      passwordInput,
      currentPath,
      router,
      isVkLoginOptionVisible,
      siteAccess.allowSiteAuth,
      updateSession,
    ],
  )

  useEffect(() => {
    if (
      !isClient ||
      !isAuthResolvedAsGuest ||
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
      authLocation || '',
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
        location: authLocation,
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

      try {
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
      } catch (widgetInitError) {
        console.error('VK widget init error', widgetInitError)
        appendAuthDebug('vk_widget_init_failed', {
          message: widgetInitError?.message ?? null,
          name: widgetInitError?.name ?? null,
        })
        setVkError(
          'Не удалось инициализировать VK ID. Попробуйте позже или войдите по паролю.',
        )
        return
      }

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
    isAuthResolvedAsGuest,
    isClient,
    vkidAppId,
    vkidCallbackUrl,
    vkidScope,
    authLocation,
    isVkSignInEnabled,
  ])

  return (
    <>
<AuthSplitLayout
        variant="neon"
        showLabel={false}
        hideIntroOnMobile
        title="Открывайте городские игры и проводите время с друзьями"
        description="В кабинете вы выбираете игру, собираете команду и отслеживаете участие в одном месте. Подходит и для новых игроков, и для тех, кто уже регулярно выходит на квесты."
        stepTexts={[
          'Авторизуйтесь, чтобы открыть доступ к играм и командам.',
          isVkAuthVisible
            ? 'Войдите через VK ID или по номеру телефона и паролю.'
            : 'Войдите по номеру телефона и паролю.',
          'Переходите в кабинет: выбирайте игру, собирайте друзей и выходите на маршрут.',
        ]}
      >
        <h2 className="text-2xl font-semibold text-center text-white">
          Авторизация
        </h2>
        <div className="mt-6 space-y-4">
          <div className="flex flex-col items-center gap-4">
            {isVkLoginOptionVisible ? (
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
            ) : isAuthResolvedAsGuest && isVkSignInEnabled ? (
              <div className="px-4 py-3 text-xs text-center text-slate-500 bg-slate-100 rounded-xl">
                Проверьте переменную{' '}
                <code className="px-1 bg-white rounded dark:bg-slate-900/80">
                  VK_ID_APP_ID
                </code>{' '}
                на сервере для входа через VK One Tap.
              </div>
            ) : null}

            {!siteAccess.allowSiteAuth ? (
              <NoticeBanner tone="warning" variant="neon">
                Авторизация временно отключена, ведутся работы.
              </NoticeBanner>
            ) : null}

            {isSiteAccessLoading ? (
              <NoticeBanner className="text-xs" centered variant="neon">
                Загружаем настройки доступа...
              </NoticeBanner>
            ) : null}

            <div className="w-full text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#9fd9ff]">
              {isVkLoginOptionVisible
                ? 'или войдите по номеру телефона'
                : 'войдите по номеру телефона'}
            </div>

                  <form
                    className="w-full p-4 space-y-3 border rounded-xl border-[#00D1FF]/30 bg-[#090018]/70"
                    onSubmit={handlePhoneAuthSubmit}
                  >
                    <label className="block text-sm font-semibold text-[#bfeeff]">
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
                      className="w-full px-4 py-3 text-sm text-white border rounded-xl border-[#00D1FF]/35 bg-[#080017]/80 focus:border-[#00D1FF] focus:outline-none"
                    />
                    <label className="block text-sm font-semibold text-[#bfeeff]">
                      Пароль
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(event) => setPasswordInput(event.target.value)}
                      placeholder="Введите пароль"
                      autoComplete="current-password"
                      disabled={isAuthenticating || !siteAccess.allowSiteAuth}
                      className="w-full px-4 py-3 text-sm text-white border rounded-xl border-[#00D1FF]/35 bg-[#080017]/80 focus:border-[#00D1FF] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isAuthenticating || !siteAccess.allowSiteAuth}
                      className="w-full cursor-pointer px-4 py-3 text-sm font-semibold transition border rounded-xl border-[#00D1FF]/50 bg-[#00D1FF]/12 text-[#baf3ff] hover:bg-[#00D1FF]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Войти
                    </button>
                  </form>

                  {siteAccess.allowSiteRegistration ? (
                    <Link
                      href={`/cabinet/register?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                      className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-semibold border rounded-xl border-[#7A00FF]/45 text-[#d9c8ff] hover:bg-[#7A00FF]/12"
                    >
                      Я не зарегистрирован
                    </Link>
                  ) : (
                    <NoticeBanner centered variant="neon">
                      Регистрация временно отключена, ведутся работы.
                    </NoticeBanner>
                  )}

                  <div className="w-full text-sm text-center text-slate-400">
                    Забыли пароль?{' '}
                    <Link
                      href={
                        siteAccess.allowSiteAuth
                          ? `/cabinet/recovery?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`
                          : '/cabinet/login'
                      }
                      className={`font-semibold ${
                        siteAccess.allowSiteAuth
                          ? 'text-[#8fdcff] hover:underline'
                          : 'text-slate-400 cursor-default pointer-events-none'
                      }`}
                    >
                      Восстановить
                    </Link>
                  </div>
                  <div className="w-full text-sm text-center">
                    <Link
                      href="/"
                      className="font-semibold text-[#8fdcff] hover:underline"
                    >
                      Перейти на главную страницу
                    </Link>
                  </div>

                  {vkError ? (
                    <NoticeBanner tone="error" variant="neon">
                      {vkError}
                    </NoticeBanner>
                  ) : null}
                  {authError ? (
                    <NoticeBanner tone="error" variant="neon">
                      <div className="space-y-2">
                        <div>{authError}</div>
                        {shouldShowRegisterCtaForAuthError ? (
                          <Link
                            href={`/cabinet/register?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#ff4d6d]/45 px-3 py-2 text-xs font-semibold text-[#ffd4de] transition hover:bg-[#ff4d6d]/20"
                          >
                            Перейти к регистрации
                          </Link>
                        ) : null}
                      </div>
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
                        vkAllowedBySession={String(isAuthResolvedAsGuest)};
                        location={authLocation}
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
      </AuthSplitLayout>
    </>
  )
}

export default CabinetLoginPage

