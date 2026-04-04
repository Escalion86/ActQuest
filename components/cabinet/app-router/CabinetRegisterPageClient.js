'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import NoticeBanner from '@components/NoticeBanner'
import AuthSplitLayout from '@components/cabinet/auth/AuthSplitLayout'
import AuthLocationSelect from '@components/cabinet/auth/AuthLocationSelect'

import { defaultSiteAccess } from '@helpers/cabinetSiteAccess'
import { extractRelativePath } from '@helpers/cabinetAuth'
import { formatPhoneInput, normalizePhoneForSubmit } from '@helpers/phoneInputMask'
import { mapVkSignInError } from '@helpers/vkAuthErrors'
import {
  loadVkSdk,
  normalizeEnvUrl,
  parseVkAppId,
  resolveVkIdCallbackUrl,
} from '@helpers/vkIdClient'
import { LOCATIONS } from '@server/serverConstants'

const PUBLIC_API_BASE = '/api/public'
const PHONE_VERIFY_API_BASE = '/api/phone/verify'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

const mapPhoneVerifyStatusLabel = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'ok') return 'Номер подтвержден'
  if (normalized === 'expired') return 'Время подтверждения истекло'
  return 'Ожидаем звонок'
}


const CabinetRegisterPage = ({
  authCallbackUrl,
  authIntent,
  isVkAuthVisible,
  vkidAppId,
  vkidCallbackUrl,
  vkidScope,
}) => {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
  const [showRegisterCtaForMissingPhone, setShowRegisterCtaForMissingPhone] =
    useState(false)
  const vkIdWidgetContainerRef = useRef(null)
  const vkAuthInFlightRef = useRef(false)
  const vkWidgetInstanceRef = useRef(null)
  const vkWidgetConfigKeyRef = useRef('')
  const phoneCheckInFlightRef = useRef(false)
  const effectiveCallbackUrl = authCallbackUrl || '/cabinet'
  const currentPath = `${pathname || ''}${
    searchParams?.toString() ? `?${searchParams.toString()}` : ''
  }`
  const flowType = authIntent === 'recovery' ? 'recovery' : 'register'
  const isRecoveryFlow = flowType === 'recovery'
  const isFlowAllowed = isRecoveryFlow
    ? siteAccess.allowSiteAuth
    : siteAccess.allowSiteRegistration
  const isVkSignInEnabled =
    status === 'unauthenticated' &&
    isVkAuthVisible &&
    siteAccess.allowSiteAuth &&
    siteAccess.enableVkOneTap
  const isPhoneStep = registerStep === 'phone'
  const isVkRegisterOptionVisible =
    isPhoneStep && isVkSignInEnabled && Boolean(vkidAppId)
  const isPhoneConfirmed = Boolean(confirmedPhone && phoneVerifyStatus === 'ok')

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session?.user?.location) {
      setLocation(session.user.location)
    }
  }, [session?.user?.location])

  const resetPhoneVerification = useCallback(() => {
    setPhoneVerifyCallId(null)
    setPhoneVerifyAuthPhone(null)
    setPhoneVerifyImageUrl(null)
    setPhoneVerifyStatus('idle')
    setConfirmedPhone('')
  }, [])

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
          `${PUBLIC_API_BASE}/site-access?location=${encodeURIComponent(location)}`,
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

  const startPhoneVerification = useCallback(
    async (digitsOnly) => {
      const response = await fetch(`${PHONE_VERIFY_API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: flowType,
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
    [flowType, location],
  )

  const precheckPhoneForFlow = useCallback(
    async (digitsOnly) => {
      const response = await fetch(`${PHONE_VERIFY_API_BASE}/precheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: flowType,
          location,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Не удалось проверить номер телефона.')
      }

      return json?.data || { allowed: true, reason: null, message: null }
    },
    [flowType, location],
  )

  const checkPhoneVerification = useCallback(
    async (digitsOnly, callId) => {
      if (!digitsOnly || !callId) return 'pending'
      if (phoneCheckInFlightRef.current) return 'pending'

      phoneCheckInFlightRef.current = true
      try {
        const response = await fetch(`${PHONE_VERIFY_API_BASE}/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: digitsOnly,
            flow: flowType,
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
    [flowType],
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

          if (redirectTarget !== currentPath) {
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
      currentPath,
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
      if (!isFlowAllowed) {
        setAuthError(
          isRecoveryFlow
            ? 'Восстановление пароля в этом регионе временно недоступно.'
            : 'Регистрация в этом регионе временно отключена.',
        )
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
        setShowRegisterCtaForMissingPhone(false)

        if (isPhoneConfirmed && confirmedPhone === digitsOnly) {
          setRegisterStep('password')
          return
        }

        if (!phoneVerifyCallId) {
          setIsSubmitting(true)
          try {
            const precheck = await precheckPhoneForFlow(digitsOnly)
            if (precheck?.allowed === false) {
              setAuthError(precheck.message || 'Проверка номера не пройдена.')
              setShowLoginCtaForExistingPhone(
                precheck.reason === 'already_registered',
              )
              setShowRegisterCtaForMissingPhone(precheck.reason === 'not_found')
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
        const response = await fetch(`${PHONE_VERIFY_API_BASE}/finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: confirmedPhone,
            password: passwordInput,
            flow: flowType,
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

          if (redirectTarget !== currentPath) {
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
      flowType,
      isFlowAllowed,
      isClient,
      isRecoveryFlow,
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
      precheckPhoneForFlow,
      currentPath,
      router,
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
<AuthSplitLayout
        variant="neon"
        showLabel={false}
        hideIntroOnMobile
        title={
          isRecoveryFlow
            ? 'Восстановите пароль и вернитесь в личный кабинет'
            : 'Создайте аккаунт и начните участие в городских квестах'
        }
        description={
          isRecoveryFlow
            ? 'Восстановление состоит из двух шагов: подтвердите номер телефона и задайте новый пароль.'
            : 'Регистрация состоит из двух шагов: сначала номер телефона, затем установка пароля. Вход через VK One Tap также доступен и работает как регистрация/авторизация по номеру.'
        }
        stepTexts={[
          isRecoveryFlow
            ? 'Регион будет определен автоматически.'
            : 'Выберите регион, в котором хотите играть.',
          isRecoveryFlow
            ? 'Введите номер телефона, привязанный к вашему аккаунту.'
            : 'Введите номер телефона или продолжите через VK ID.',
          isRecoveryFlow
            ? 'Придумайте новый пароль и продолжите вход.'
            : 'Задайте пароль и переходите в личный кабинет.',
        ]}
      >
        <h2 className="text-2xl font-semibold text-center text-white">
          {isRecoveryFlow ? 'Восстановление пароля' : 'Регистрация'}
        </h2>
        <p className="mt-2 text-sm text-center text-slate-400">
          {isPhoneStep
            ? isRecoveryFlow
              ? 'Шаг 1: подтвердите номер телефона, который привязан к вашему аккаунту.'
              : isVkRegisterOptionVisible
              ? 'Шаг 1: укажите номер телефона или выберите VK ID.'
              : 'Шаг 1: Выберите игровой регион и укажите ваш номер телефона.'
            : isRecoveryFlow
              ? 'Шаг 2: придумайте новый пароль для входа.'
              : 'Шаг 2: придумайте пароль для входа по номеру телефона.'}
        </p>

        <div className="mt-6 space-y-4">
          {!isRecoveryFlow ? (
            <AuthLocationSelect
              location={location}
              onChange={(event) => setLocation(event.target.value)}
              disabled={isSubmitting || isSiteAccessLoading}
              variant="neon"
              availableLocations={availableLocations}
            />
          ) : null}

          {!isFlowAllowed ? (
            <NoticeBanner tone="warning" variant="neon">
              {isRecoveryFlow
                ? 'Восстановление пароля временно отключено, ведутся работы.'
                : 'Регистрация временно отключена, ведутся работы.'}
            </NoticeBanner>
          ) : null}

          {isSiteAccessLoading ? (
            <NoticeBanner className="text-xs" centered variant="neon">
              Загружаем настройки доступа...
            </NoticeBanner>
          ) : null}

          <div className="flex flex-col items-center gap-4">
            {isVkRegisterOptionVisible && !isRecoveryFlow ? (
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

            <div className="w-full text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#9fd9ff]">
              {isPhoneStep
                ? isVkRegisterOptionVisible
                  ? 'или продолжите по номеру телефона'
                  : 'продолжите по номеру телефона'
                : 'создайте пароль для входа по номеру телефона'}
            </div>

            <form
              className="w-full p-4 space-y-3 border rounded-xl border-[#00D1FF]/30 bg-[#090018]/70"
              onSubmit={handleRegister}
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
                disabled={
                  isSubmitting ||
                  !isFlowAllowed ||
                  !isPhoneStep ||
                  Boolean(phoneVerifyCallId)
                }
                className="w-full px-4 py-3 text-sm text-white border rounded-xl border-[#00D1FF]/35 bg-[#080017]/80 focus:border-[#00D1FF] focus:outline-none"
              />

              {isPhoneStep && phoneVerifyCallId ? (
                <div className="p-3 text-xs border rounded-xl border-[#00D1FF]/25 bg-[#050012]/70 text-[#bfeeff] space-y-2">
                  <div>
                    Позвоните по номеру телефона ниже, для подтверждения Вашего
                    номера телефона
                  </div>
                  {phoneVerifyAuthPhone ? (
                    <div className="flex flex-col items-center">
                      {(() => {
                        const rawPhone = String(phoneVerifyAuthPhone || '')
                          .replace(/[^\d+]/g, '')
                        const normalizedDisplayPhone = rawPhone.startsWith('+')
                          ? rawPhone
                          : `+${rawPhone.replace(/^\++/, '')}`
                        const telPhone = normalizedDisplayPhone.replace(/\s+/g, '')

                        return (
                          <>
                      <p className="mb-1 text-center">Номер для звонка:</p>
                      <a
                        href={`tel:${telPhone}`}
                        className="inline-flex cursor-pointer items-center rounded-lg border border-[#00D1FF]/45 bg-[#00D1FF]/10 px-3 py-1.5 text-lg font-semibold tracking-[0.02em] text-[#baf3ff] transition hover:bg-[#00D1FF]/20"
                      >
                        {normalizedDisplayPhone}
                      </a>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-[#9fd9ff] md:hidden">
                        Нажми на телефон для звонка
                      </p>
                      <p className="mt-1 text-center text-[11px] uppercase tracking-[0.1em] text-[#baf3ff]">
                        Звонок бесплатный
                      </p>
                          </>
                        )
                      })()}
                    </div>
                  ) : null}
                  {phoneVerifyImageUrl ? (
                    <div className="hidden flex-col items-center justify-center gap-2 md:flex">
                      <img
                        src={phoneVerifyImageUrl}
                        alt="QR для подтверждения звонка"
                        className="w-40 h-40 rounded-lg border border-[#00D1FF]/35"
                      />
                      <p className="max-w-[220px] text-center text-[11px] uppercase tracking-[0.1em] text-[#9fd9ff]">
                        Отсканируйте QR-код телефоном, для быстрого набора
                        номера
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isPhoneStep ? (
                <>
                  <label className="block text-sm font-semibold text-[#bfeeff]">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(event) => setPasswordInput(event.target.value)}
                    placeholder="Пароль (минимум 8 символов)"
                    autoComplete="new-password"
                    disabled={isSubmitting || !isFlowAllowed}
                    className="w-full px-4 py-3 text-sm text-white border rounded-xl border-[#00D1FF]/35 bg-[#080017]/80 focus:border-[#00D1FF] focus:outline-none"
                  />

                  <label className="block text-sm font-semibold text-[#bfeeff]">
                    Повторите пароль
                  </label>
                  <input
                    type="password"
                    value={passwordRepeatInput}
                    onChange={(event) => setPasswordRepeatInput(event.target.value)}
                    placeholder="Повторите пароль"
                    autoComplete="new-password"
                    disabled={isSubmitting || !isFlowAllowed}
                    className="w-full px-4 py-3 text-sm text-white border rounded-xl border-[#00D1FF]/35 bg-[#080017]/80 focus:border-[#00D1FF] focus:outline-none"
                  />
                </>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !isFlowAllowed}
                className="w-full cursor-pointer px-4 py-3 text-sm font-semibold transition border rounded-xl border-[#00D1FF]/50 bg-[#00D1FF]/12 text-[#baf3ff] hover:bg-[#00D1FF]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? isRecoveryFlow
                    ? 'Обновление пароля...'
                    : 'Регистрация...'
                  : isPhoneStep
                    ? phoneVerifyCallId
                      ? 'Проверить подтверждение'
                      : 'Подтвердить номер'
                    : isRecoveryFlow
                      ? 'Сохранить новый пароль'
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
                    setShowRegisterCtaForMissingPhone(false)
                    resetPhoneVerification()
                  }}
                  disabled={isSubmitting}
                  className="w-full cursor-pointer px-4 py-3 text-sm font-semibold border rounded-xl border-[#7A00FF]/45 text-[#d9c8ff] hover:bg-[#7A00FF]/12 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Изменить номер телефона
                </button>
              ) : null}
              {isPhoneStep && phoneVerifyCallId ? (
                <button
                  type="button"
                  onClick={resetPhoneVerification}
                  disabled={isSubmitting}
                  className="w-full cursor-pointer px-4 py-3 text-sm font-semibold border rounded-xl border-[#7A00FF]/45 text-[#d9c8ff] hover:bg-[#7A00FF]/12 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Изменить номер телефона
                </button>
              ) : null}
            </form>

            <div className="w-full text-sm text-center text-slate-400">
              {isRecoveryFlow ? 'Вспомнили пароль?' : 'Уже есть аккаунт?'}{' '}
              <Link
                href={`/cabinet/login?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                className="font-semibold text-[#8fdcff] hover:underline"
              >
                Войти
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

            {authError ? (
              <NoticeBanner tone="error" variant="neon">
                <div className="space-y-2">
                  <div>{authError}</div>
                  {showLoginCtaForExistingPhone ? (
                    <Link
                      href={`/cabinet/login?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                      className="inline-flex cursor-pointer items-center justify-center px-3 py-2 text-xs font-semibold border rounded-lg border-[#ff4d6d]/45 text-[#ffd4de] hover:bg-[#ff4d6d]/20"
                    >
                      Перейти ко входу
                    </Link>
                  ) : null}
                  {showRegisterCtaForMissingPhone ? (
                    <Link
                      href={`/cabinet/register?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
                      className="inline-flex cursor-pointer items-center justify-center px-3 py-2 text-xs font-semibold border rounded-lg border-[#ff4d6d]/45 text-[#ffd4de] hover:bg-[#ff4d6d]/20"
                    >
                      Перейти к регистрации
                    </Link>
                  ) : null}
                </div>
              </NoticeBanner>
            ) : null}
            {vkError ? (
              <NoticeBanner tone="error" variant="neon">{vkError}</NoticeBanner>
            ) : null}
          </div>
        </div>
      </AuthSplitLayout>
    </>
  )
}

