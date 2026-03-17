import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { signIn, useSession } from 'next-auth/react'
import NoticeBanner from '@components/NoticeBanner'
import AuthSplitLayout from '@components/cabinet/auth/AuthSplitLayout'
import AuthLocationSelect from '@components/cabinet/auth/AuthLocationSelect'

import getSessionSafe from '@helpers/getSessionSafe'
import { extractRelativePath, resolveCabinetCallback } from '@helpers/cabinetAuth'
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
const VK_SIGNIN_ERROR_MESSAGES = {
  VK_BAD_REQUEST: 'Неполные данные для входа через VK ID. Обновите страницу.',
  VK_AUTH_DISABLED: 'Вход через VK ID временно отключен для выбранного региона.',
  VK_EXCHANGE_FAILED:
    'VK ID временно недоступен. Попробуйте позже или войдите по номеру телефона.',
  VK_USERINFO_FAILED:
    'Не удалось получить профиль VK. Попробуйте позже или войдите по номеру телефона.',
  VK_PROFILE_INVALID: 'Профиль VK ID передан некорректно.',
  VK_SERVER_UNAVAILABLE: 'Сервис авторизации временно недоступен.',
  VK_PHONE_REQUIRED:
    'Произошла ошибка VK ID: не удалось получить номер телефона. Попробуйте зарегистрироваться по номеру телефона.',
  CredentialsSignin:
    'Не удалось завершить вход через VK ID. Попробуйте снова или войдите по номеру телефона.',
}

const mapVkSignInError = (errorCode) =>
  VK_SIGNIN_ERROR_MESSAGES[errorCode] ||
  'Не удалось выполнить вход через VK ID. Попробуйте позже.'

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

const CabinetRegisterPage = ({
  authCallbackUrl,
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
  const [registerStep, setRegisterStep] = useState('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [confirmedPhone, setConfirmedPhone] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordRepeatInput, setPasswordRepeatInput] = useState('')
  const [authError, setAuthError] = useState(null)
  const [showLoginCtaForExistingPhone, setShowLoginCtaForExistingPhone] =
    useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [siteAccess, setSiteAccess] = useState(defaultSiteAccess)
  const [isSiteAccessLoading, setIsSiteAccessLoading] = useState(false)
  const [isVkIdReady, setIsVkIdReady] = useState(false)
  const [vkError, setVkError] = useState(null)
  const [phoneVerifyCallId, setPhoneVerifyCallId] = useState(null)
  const [phoneVerifyAuthPhone, setPhoneVerifyAuthPhone] = useState(null)
  const [phoneVerifyImageUrl, setPhoneVerifyImageUrl] = useState(null)
  const [phoneVerifyStatus, setPhoneVerifyStatus] = useState('idle')
  const vkIdWidgetContainerRef = useRef(null)
  const vkAuthInFlightRef = useRef(false)
  const vkWidgetInstanceRef = useRef(null)
  const vkWidgetConfigKeyRef = useRef('')
  const phoneCheckInFlightRef = useRef(false)
  const effectiveCallbackUrl = authCallbackUrl || '/cabinet'
  const isVkSignInEnabled =
    status === 'unauthenticated' &&
    isVkAuthVisible &&
    siteAccess.allowSiteAuth &&
    siteAccess.enableVkOneTap
  const isPhoneStep = registerStep === 'phone'
  const isPhoneConfirmed = Boolean(confirmedPhone && phoneVerifyStatus === 'ok')

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session?.user?.location) {
      setLocation(session.user.location)
    }
  }, [session?.user?.location])

  const previousLocationRef = useRef(location)
  useEffect(() => {
    if (previousLocationRef.current !== location && phoneVerifyCallId) {
      resetPhoneVerification()
    }
    previousLocationRef.current = location
  }, [location, phoneVerifyCallId, resetPhoneVerification])

  useEffect(() => {
    if (!isClient || !location) {
      return undefined
    }

    let cancelled = false

    const fetchSiteAccess = async () => {
      setIsSiteAccessLoading(true)
      try {
        const response = await fetch(
          `/api/public/site-access?location=${encodeURIComponent(location)}`,
        )
        const json = await response.json()
        if (!cancelled && response.ok && json?.success && json?.data) {
          setSiteAccess({
            allowSiteAuth: Boolean(json.data.allowSiteAuth),
            allowSiteRegistration: Boolean(json.data.allowSiteRegistration),
            enableVkOneTap: Boolean(json.data.enableVkOneTap),
          })
          return
        }
      } catch (error) {
        console.error('Failed to load site access controls on register', error)
      } finally {
        if (!cancelled) {
          setIsSiteAccessLoading(false)
        }
      }

      if (!cancelled) {
        setSiteAccess(defaultSiteAccess)
      }
    }

    fetchSiteAccess()

    return () => {
      cancelled = true
    }
  }, [isClient, location])

  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      return
    }

    const redirectTarget =
      effectiveCallbackUrl && effectiveCallbackUrl !== '/cabinet/register'
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

  const resetPhoneVerification = useCallback(() => {
    setPhoneVerifyCallId(null)
    setPhoneVerifyAuthPhone(null)
    setPhoneVerifyImageUrl(null)
    setPhoneVerifyStatus('idle')
    setConfirmedPhone('')
  }, [])

  const startPhoneVerification = useCallback(
    async (digitsOnly) => {
      const response = await fetch('/api/phone/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: 'register',
          location,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Не удалось запустить подтверждение номера.')
      }

      setPhoneVerifyCallId(Number(json?.data?.id))
      setPhoneVerifyAuthPhone(json?.data?.auth_phone || null)
      setPhoneVerifyImageUrl(json?.data?.url_image || null)
      setPhoneVerifyStatus('pending')
      setConfirmedPhone('')
    },
    [location],
  )

  const precheckPhoneForRegister = useCallback(
    async (digitsOnly) => {
      const response = await fetch('/api/phone/verify/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: 'register',
          location,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Не удалось проверить номер телефона.')
      }

      return json?.data || { allowed: true, reason: null, message: null }
    },
    [location],
  )

  const checkPhoneVerification = useCallback(
    async (digitsOnly, callId) => {
      if (!digitsOnly || !callId) return 'pending'
      if (phoneCheckInFlightRef.current) return 'pending'

      phoneCheckInFlightRef.current = true
      try {
        const response = await fetch('/api/phone/verify/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: digitsOnly,
            flow: 'register',
            callId,
          }),
        })
        const json = await response.json()
        if (!response.ok || !json?.success) {
          throw new Error(json?.error?.message || 'Не удалось проверить подтверждение номера.')
        }

        const nextStatus = String(json?.data?.status || 'pending').toLowerCase()
        setPhoneVerifyStatus(nextStatus)
        if (nextStatus === 'ok') {
          setConfirmedPhone(digitsOnly)
          setRegisterStep('password')
          setAuthError(null)
        }
        if (nextStatus === 'expired') {
          setPhoneVerifyCallId(null)
          setPhoneVerifyAuthPhone(null)
          setPhoneVerifyImageUrl(null)
          setConfirmedPhone('')
          setAuthError('Время подтверждения истекло. Запросите звонок повторно.')
        }

        return nextStatus
      } finally {
        phoneCheckInFlightRef.current = false
      }
    },
    [],
  )

  const handleVkAuth = useCallback(
    async ({ code, deviceId, codeVerifier, state, accessToken }) => {
      if (!code || !deviceId || isSubmitting || vkAuthInFlightRef.current) {
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
        setIsSubmitting(true)

        let absoluteCallbackUrl = effectiveCallbackUrl
        if (isClient) {
          try {
            absoluteCallbackUrl = new URL(
              effectiveCallbackUrl,
              window.location.origin,
            ).toString()
          } catch (buildUrlError) {
            console.error(
              'Не удалось сформировать callbackUrl авторизации через VK',
              buildUrlError,
            )
            absoluteCallbackUrl = `${window.location.origin}/cabinet`
          }
        }

        const result = await signIn('vk', {
          redirect: false,
          callbackUrl: absoluteCallbackUrl,
          location,
          mode: 'register',
          code,
          deviceId,
          accessToken,
          codeVerifier: codeVerifier || undefined,
          state: state || undefined,
        })

        if (result?.error) {
          throw new Error(result.error)
        }

        await updateSession()

        if (isClient) {
          const safeResultUrl = extractRelativePath(
            result?.url,
            window.location.origin,
          )
          const redirectTarget =
            safeResultUrl && safeResultUrl !== '/cabinet/register'
              ? safeResultUrl
              : '/cabinet'

          if (redirectTarget !== router.asPath) {
            await router.replace(redirectTarget)
          }
        }
      } catch (error) {
        console.error('VK register auth error', error)
        setVkError(mapVkSignInError(error?.message))
      } finally {
        vkAuthInFlightRef.current = false
        setIsSubmitting(false)
      }
    },
    [
      effectiveCallbackUrl,
      isClient,
      isSubmitting,
      isVkSignInEnabled,
      location,
      router,
      updateSession,
    ],
  )

  useEffect(() => {
    if (!isPhoneStep || !phoneVerifyCallId || isPhoneConfirmed) {
      return undefined
    }

    const digitsOnly = normalizePhoneForSubmit(phoneInput)
    if (!digitsOnly || digitsOnly.length < 11) {
      return undefined
    }

    const intervalId = setInterval(() => {
      checkPhoneVerification(digitsOnly, phoneVerifyCallId).catch((error) => {
        console.error('Phone verify polling error', error)
      })
    }, 3000)

    return () => {
      clearInterval(intervalId)
    }
  }, [
    checkPhoneVerification,
    isPhoneConfirmed,
    isPhoneStep,
    phoneInput,
    phoneVerifyCallId,
  ])

  const handleRegister = useCallback(
    async (event) => {
      event.preventDefault()
      if (isSubmitting) return
      if (!siteAccess.allowSiteRegistration) {
        setAuthError('Регистрация в этом регионе временно отключена.')
        return
      }

      const digitsOnly = normalizePhoneForSubmit(phoneInput)
      if (!digitsOnly || digitsOnly.length < 11) {
        setAuthError('Введите корректный номер телефона.')
        return
      }

      if (registerStep === 'phone') {
        setAuthError(null)
        setVkError(null)
        setShowLoginCtaForExistingPhone(false)

        if (isPhoneConfirmed && confirmedPhone === digitsOnly) {
          setRegisterStep('password')
          return
        }

        if (!phoneVerifyCallId) {
          setIsSubmitting(true)
          try {
            const precheck = await precheckPhoneForRegister(digitsOnly)
            if (precheck?.allowed === false) {
              setAuthError(precheck.message || 'Проверка номера не пройдена.')
              setShowLoginCtaForExistingPhone(
                precheck.reason === 'already_registered',
              )
              return
            }
            await startPhoneVerification(digitsOnly)
          } catch (error) {
            setAuthError(error?.message || 'Не удалось запустить подтверждение номера.')
          } finally {
            setIsSubmitting(false)
          }
          return
        }

        setIsSubmitting(true)
        try {
          const statusValue = await checkPhoneVerification(digitsOnly, phoneVerifyCallId)
          if (statusValue !== 'ok') {
            setAuthError('Номер еще не подтвержден. Подтвердите звонок и попробуйте снова.')
          }
        } catch (error) {
          setAuthError(
            error?.message || 'Не удалось проверить подтверждение номера.',
          )
        } finally {
          setIsSubmitting(false)
        }
        return
      }

      if (!isPhoneConfirmed || confirmedPhone !== digitsOnly) {
        setAuthError('Сначала подтвердите номер телефона на шаге 1.')
        setRegisterStep('phone')
        return
      }

      if (!passwordInput || passwordInput.length < 8) {
        setAuthError('Пароль должен содержать минимум 8 символов.')
        return
      }
      if (passwordInput !== passwordRepeatInput) {
        setAuthError('Пароли не совпадают.')
        return
      }

      setAuthError(null)
      setIsSubmitting(true)

      try {
        const response = await fetch('/api/phone/verify/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: confirmedPhone,
            password: passwordInput,
            flow: 'register',
            location,
          }),
        })
        const json = await response.json()

        if (!response.ok || json?.success === false) {
          throw new Error(
            json?.error?.message ||
              json?.error ||
              'Не удалось завершить регистрацию.',
          )
        }

        let absoluteCallbackUrl = effectiveCallbackUrl
        if (isClient) {
          try {
            absoluteCallbackUrl = new URL(
              effectiveCallbackUrl,
              window.location.origin,
            ).toString()
          } catch (buildUrlError) {
            console.error('Не удалось сформировать callbackUrl', buildUrlError)
            absoluteCallbackUrl = `${window.location.origin}/cabinet`
          }
        }

        const signInResult = await signIn('password', {
          redirect: false,
          callbackUrl: absoluteCallbackUrl,
          data: JSON.stringify({
            phone: confirmedPhone,
            password: passwordInput,
          }),
          location,
        })

        if (signInResult?.error) {
          throw new Error(signInResult.error)
        }

        await updateSession()

        if (isClient) {
          const safeResultUrl = extractRelativePath(
            signInResult?.url,
            window.location.origin,
          )
          const redirectTarget =
            safeResultUrl && safeResultUrl !== '/cabinet/register'
              ? safeResultUrl
              : '/cabinet'

          if (redirectTarget !== router.asPath) {
            await router.replace(redirectTarget)
          }
        }
      } catch (error) {
        console.error('Register error', error)
        setAuthError(error?.message || 'Не удалось завершить регистрацию.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      effectiveCallbackUrl,
      isClient,
      isSubmitting,
      location,
      confirmedPhone,
      checkPhoneVerification,
      isPhoneConfirmed,
      passwordInput,
      passwordRepeatInput,
      phoneVerifyCallId,
      registerStep,
      phoneInput,
      precheckPhoneForRegister,
      router,
      siteAccess.allowSiteRegistration,
      startPhoneVerification,
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
      return undefined
    }
    vkWidgetConfigKeyRef.current = configKey

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
          scope: vkidScope,
        })
      } catch (error) {
        // возможно уже инициализирован
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

          setVkError(
            vkWidgetErrorText && vkWidgetErrorCode !== null
              ? `Ошибка виджета VK ID (${vkWidgetErrorCode}): ${vkWidgetErrorText}.`
              : vkWidgetErrorText
                ? `Ошибка виджета VK ID: ${vkWidgetErrorText}.`
                : vkWidgetErrorCode !== null
                  ? `Ошибка виджета VK ID (${vkWidgetErrorCode}).`
                  : 'Ошибка виджета VK ID.',
          )
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload) => {
          if (!isMounted) return

          const code = payload?.code
          const deviceId = payload?.device_id
          const codeVerifier =
            payload?.code_verifier || payload?.codeVerifier || payload?.verifier
          const state = payload?.state || null

          if (!code || !deviceId) {
            setVkError('VK ID не вернул код авторизации.')
            return
          }

          try {
            let accessToken = null
            if (!codeVerifier && VKID?.Auth?.exchangeCode) {
              const exchangeResult = await VKID.Auth.exchangeCode(code, deviceId)
              accessToken = exchangeResult?.access_token || null
            }

            await handleVkAuth({
              code,
              deviceId,
              accessToken,
              codeVerifier: codeVerifier || null,
              state: state || null,
            })
          } catch (error) {
            console.error('VK OneTap register auth error', error)
            setVkError(
              'VK ID временно недоступен. Попробуйте позже или зарегистрируйтесь по номеру телефона.',
            )
          }
        })

      setIsVkIdReady(true)
    }

    init()

    return () => {
      isMounted = false
      setIsVkIdReady(false)
      vkWidgetInstanceRef.current = null
      if (container) container.innerHTML = ''
    }
  }, [
    handleVkAuth,
    isClient,
    isVkSignInEnabled,
    location,
    vkidAppId,
    vkidCallbackUrl,
    vkidScope,
  ])

  return (
    <>
      <Head>
        <title>ActQuest — регистрация</title>
      </Head>
      <AuthSplitLayout
        title="Создайте аккаунт и начните участие в городских квестах"
        description="Регистрация состоит из двух шагов: сначала номер телефона, затем установка пароля. Вход через VK One Tap также доступен и работает как регистрация/авторизация по номеру."
        stepTexts={[
          'Выберите регион, в котором хотите играть.',
          'Введите номер телефона или продолжите через VK ID.',
          'Задайте пароль и переходите в личный кабинет.',
        ]}
      >
        <h2 className="text-2xl font-semibold text-center text-primary">
          Регистрация
        </h2>
        <p className="mt-2 text-sm text-center text-slate-500">
          {isPhoneStep
            ? 'Шаг 1: укажите номер телефона или выберите VK ID.'
            : 'Шаг 2: придумайте пароль для входа по номеру телефона.'}
        </p>

        <div className="mt-6 space-y-4">
          <AuthLocationSelect
            location={location}
            onChange={(event) => setLocation(event.target.value)}
            disabled={isSubmitting || isSiteAccessLoading}
            availableLocations={availableLocations}
          />

          {!siteAccess.allowSiteRegistration ? (
            <NoticeBanner tone="warning">
              Регистрация временно отключена, ведутся работы.
            </NoticeBanner>
          ) : null}

          {isSiteAccessLoading ? (
            <NoticeBanner className="text-xs" centered>
              Загружаем настройки доступа...
            </NoticeBanner>
          ) : null}

          <div className="flex flex-col items-center gap-4">
            {isPhoneStep && isVkSignInEnabled && vkidAppId ? (
              <div className="w-full">
                <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Регистрация / вход через VK ID
                </div>
                <div ref={vkIdWidgetContainerRef} className="w-full" />
                {!isVkIdReady ? (
                  <div className="flex items-center justify-center h-6 mt-2 text-xs text-slate-500">
                    Загрузка VK One Tap...
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="w-full text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {isPhoneStep
                ? 'или продолжите по номеру телефона'
                : 'создайте пароль для входа по номеру телефона'}
            </div>

            <form
              className="w-full p-4 space-y-3 border rounded-xl border-slate-200 dark:border-slate-700"
              onSubmit={handleRegister}
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
                disabled={
                  isSubmitting ||
                  !siteAccess.allowSiteRegistration ||
                  !isPhoneStep ||
                  Boolean(phoneVerifyCallId)
                }
                className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              />

              {isPhoneStep && phoneVerifyCallId ? (
                <div className="p-3 text-xs border rounded-xl border-slate-200 bg-slate-50 text-slate-700 space-y-2">
                  <div>
                    Статус подтверждения: <span className="font-semibold">{phoneVerifyStatus}</span>
                  </div>
                  {phoneVerifyAuthPhone ? (
                    <div>
                      Номер для входящего звонка:{' '}
                      <span className="font-semibold">{phoneVerifyAuthPhone}</span>
                    </div>
                  ) : null}
                  {phoneVerifyImageUrl ? (
                    <div className="flex justify-center">
                      <img
                        src={phoneVerifyImageUrl}
                        alt="QR для подтверждения звонка"
                        className="w-40 h-40 rounded-lg border border-slate-200"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isPhoneStep ? (
                <>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(event) => setPasswordInput(event.target.value)}
                    placeholder="Пароль (минимум 8 символов)"
                    autoComplete="new-password"
                    disabled={isSubmitting || !siteAccess.allowSiteRegistration}
                    className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  />

                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Повторите пароль
                  </label>
                  <input
                    type="password"
                    value={passwordRepeatInput}
                    onChange={(event) => setPasswordRepeatInput(event.target.value)}
                    placeholder="Повторите пароль"
                    autoComplete="new-password"
                    disabled={isSubmitting || !siteAccess.allowSiteRegistration}
                    className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  />
                </>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !siteAccess.allowSiteRegistration}
                className="w-full px-4 py-3 text-sm font-semibold text-white transition bg-emerald-600 rounded-xl hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? 'Регистрация...'
                  : isPhoneStep
                    ? phoneVerifyCallId
                      ? 'Проверить подтверждение'
                      : 'Подтвердить номер'
                    : 'Завершить регистрацию'}
              </button>

              {!isPhoneStep ? (
                <button
                  type="button"
                  onClick={() => {
                    setRegisterStep('phone')
                    setPasswordInput('')
                    setPasswordRepeatInput('')
                    setAuthError(null)
                    setShowLoginCtaForExistingPhone(false)
                    resetPhoneVerification()
                  }}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 text-sm font-semibold border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Изменить номер телефона
                </button>
              ) : null}
              {isPhoneStep && phoneVerifyCallId ? (
                <button
                  type="button"
                  onClick={resetPhoneVerification}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 text-sm font-semibold border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Изменить номер телефона
                </button>
              ) : null}
            </form>

            <div className="w-full text-sm text-center text-slate-500">
              Уже есть аккаунт?{' '}
              <Link
                href={`/cabinet/login?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                className="font-semibold text-primary hover:underline"
              >
                Войти
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

            {authError ? (
              <NoticeBanner tone="error">
                <div className="space-y-2">
                  <div>{authError}</div>
                  {showLoginCtaForExistingPhone ? (
                    <Link
                      href={`/cabinet/login?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                      className="inline-flex items-center justify-center px-3 py-2 text-xs font-semibold border rounded-lg border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Перейти ко входу
                    </Link>
                  ) : null}
                </div>
              </NoticeBanner>
            ) : null}
            {vkError ? (
              <NoticeBanner tone="error">{vkError}</NoticeBanner>
            ) : null}
          </div>
        </div>
      </AuthSplitLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)
  const { relativeCallback, isSafe } = resolveCabinetCallback(
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
      isVkAuthVisible,
      vkidAppId,
      vkidCallbackUrl,
      vkidScope,
    },
  }
}

export default CabinetRegisterPage
