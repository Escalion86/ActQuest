'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from 'next-auth/react'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import ImagesInput from '@components/cabinet/ImagesInput'
import NeonCheckbox from '@components/NeonCheckbox'
import FeedbackToast from '@components/FeedbackToast'
import NoticeBanner from '@components/NoticeBanner'
import Modal from '@components/Modal'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import {
  formatPhoneInput,
  normalizePhoneForSubmit,
} from '@helpers/phoneInputMask'
import requestApiJson from '@helpers/requestApiJson'
import { defaultSiteAccess } from '@helpers/cabinetSiteAccess'
import usePwaNotifications from '@helpers/usePwaNotifications'
import { LOCATIONS } from '@server/serverConstants'

const CABINET_USERS_API_BASE = '/api/cabinet/users'
const PHONE_VERIFY_API_BASE = '/api/phone/verify'
const locationOptions = Object.entries(LOCATIONS)
  .filter(([, value]) => !value?.hidden)
  .map(([key, value]) => ({
    value: key,
    label:
      typeof value?.townRu === 'string' && value.townRu.length > 0
        ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
        : key,
  }))

const ProfilePage = ({ initialProfile }) => {
  const { data: session, update: updateSession } = useSession()
  const normalizedInitialProfile = useMemo(
    () => normalizeUserProfile(initialProfile),
    [initialProfile],
  )
  const [formState, setFormState] = useState(() => normalizedInitialProfile)
  const [lastSavedState, setLastSavedState] = useState(
    () => normalizedInitialProfile,
  )
  const [saveState, setSaveState] = useState({
    isSaving: false,
    isSaved: false,
    error: null,
  })
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneVerifyCallId, setPhoneVerifyCallId] = useState(null)
  const [phoneVerifyAuthPhone, setPhoneVerifyAuthPhone] = useState(null)
  const [phoneVerifyImageUrl, setPhoneVerifyImageUrl] = useState(null)
  const [phoneVerifyStatus, setPhoneVerifyStatus] = useState('pending')
  const [phoneSmsCode, setPhoneSmsCode] = useState('')
  const [phoneModalError, setPhoneModalError] = useState(null)
  const [isPhoneModalSubmitting, setIsPhoneModalSubmitting] = useState(false)
  const [pushFeedback, setPushFeedback] = useState(null)
  const [toastEvent, setToastEvent] = useState(null)
  const [siteAccess, setSiteAccess] = useState(defaultSiteAccess)
  const [isLocationSaving, setIsLocationSaving] = useState(false)
  const [locationSaveError, setLocationSaveError] = useState(null)
  const phoneCheckInFlightRef = useRef(false)
  const effectiveRole = session?.user?.role ?? 'client'
  const pushLocation =
    typeof session?.user?.location === 'string' ? session.user.location : null
  const {
    isSupported: isPushSupported,
    isIOSDevice: isPushIOSDevice,
    isStandalone: isPushStandalone,
    isConfigured: isPushConfigured,
    isSubscribed: isPushSubscribed,
    isProcessing: isPushProcessing,
    error: pushError,
    canControl: canControlPush,
    configStatus: pushConfigStatus,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePwaNotifications({
    location: pushLocation,
    session,
  })
  const resolvedPushError =
    pushConfigStatus !== 'loading' &&
    typeof pushError === 'string' &&
    pushError.trim() ===
      'Проверяем настройки уведомлений. Попробуйте ещё раз чуть позже.'
      ? null
      : pushError

  useEffect(() => {
    let cancelled = false

    const loadSiteAccess = async () => {
      try {
        const query = pushLocation
          ? `?location=${encodeURIComponent(pushLocation)}`
          : ''
        const response = await fetch(`/api/public/site-access${query}`)
        const json = await response.json()
        if (!cancelled && response.ok && json?.success && json?.data) {
          setSiteAccess({
            ...defaultSiteAccess,
            ...json.data,
          })
        }
      } catch (error) {
        console.error('Failed to load SMS access controls in profile', error)
      }
    }

    loadSiteAccess()
    return () => {
      cancelled = true
    }
  }, [pushLocation])

  useEffect(() => {
    setFormState(normalizedInitialProfile)
    setLastSavedState(normalizedInitialProfile)
    setSaveState({ isSaving: false, isSaved: false, error: null })
  }, [normalizedInitialProfile])

  const hasChanges = useMemo(() => {
    try {
      return JSON.stringify(formState) !== JSON.stringify(lastSavedState)
    } catch (error) {
      console.error('Failed to compare profile states', error)
      return true
    }
  }, [formState, lastSavedState])

  const handleChange = useCallback((field, value) => {
    setFormState((prevState) => ({
      ...normalizeUserProfile(prevState),
      [field]: value,
    }))
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const safeFormState = useMemo(
    () => normalizeUserProfile(formState),
    [formState],
  )
  const selectedLocation =
    (typeof session?.user?.location === 'string' && session.user.location) ||
    safeFormState.currentLocation ||
    ''
  const isAdminOrDeveloper = useMemo(() => {
    const role =
      typeof effectiveRole === 'string'
        ? effectiveRole.trim().toLowerCase()
        : ''
    return role === 'admin' || role === 'dev'
  }, [effectiveRole])
  const resolvedProfileId = useMemo(() => {
    const idFromState =
      typeof safeFormState.id === 'string' ? safeFormState.id.trim() : ''
    if (idFromState) {
      return idFromState
    }

    const idFromSession =
      (typeof session?.user?.globalUserId === 'string'
        ? session.user.globalUserId.trim()
        : '') ||
      (typeof session?.user?._id === 'string' ? session.user._id.trim() : '')

    return idFromSession || null
  }, [safeFormState.id, session?.user?._id, session?.user?.globalUserId])

  const handleLocationChange = useCallback(
    async (event) => {
      const nextLocation =
        typeof event?.target?.value === 'string'
          ? event.target.value.trim()
          : ''
      if (
        !nextLocation ||
        nextLocation === selectedLocation ||
        isLocationSaving
      ) {
        return
      }

      setLocationSaveError(null)
      setIsLocationSaving(true)
      try {
        await requestApiJson(`${CABINET_USERS_API_BASE}/location`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ location: nextLocation }),
          fallbackMessage: 'Не удалось обновить город',
        })

        setFormState((prev) => ({
          ...normalizeUserProfile(prev),
          currentLocation: nextLocation,
        }))
        setLastSavedState((prev) => ({
          ...normalizeUserProfile(prev),
          currentLocation: nextLocation,
        }))

        if (typeof updateSession === 'function') {
          await updateSession({ location: nextLocation })
        }
      } catch (error) {
        setLocationSaveError(error?.message || 'Не удалось обновить город')
      } finally {
        setIsLocationSaving(false)
      }
    },
    [isLocationSaving, selectedLocation, updateSession],
  )

  const resetPhoneVerification = useCallback((nextPhoneValue = '') => {
    setPhoneVerifyCallId(null)
    setPhoneVerifyAuthPhone(null)
    setPhoneVerifyImageUrl(null)
    setPhoneVerifyStatus('pending')
    setPhoneSmsCode('')
    setPhoneModalError(null)
    setPhoneDraft(formatPhoneInput(nextPhoneValue))
  }, [])

  const openPhoneModal = useCallback(() => {
    resetPhoneVerification('')
    setIsPhoneModalOpen(true)
  }, [resetPhoneVerification])

  const closePhoneModal = useCallback(() => {
    setIsPhoneModalOpen(false)
    setIsPhoneModalSubmitting(false)
    resetPhoneVerification()
  }, [resetPhoneVerification])

  const precheckPhoneForChange = useCallback(async (digitsOnly) => {
    const { response, json } = await requestApiJson(
      `${PHONE_VERIFY_API_BASE}/precheck`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: 'change_phone',
        }),
        fallbackMessage: 'Не удалось проверить номер телефона',
      },
    )

    if (!response.ok || json?.success === false) {
      throw new Error(
        json?.error?.message ||
          json?.error ||
          'Не удалось проверить номер телефона.',
      )
    }

    return json?.data || { allowed: true, reason: null, message: null }
  }, [])

  const startPhoneVerification = useCallback(async (digitsOnly) => {
    const { response, json } = await requestApiJson(
      `${PHONE_VERIFY_API_BASE}/start`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: 'change_phone',
        }),
        fallbackMessage: 'Не удалось запустить подтверждение номера',
      },
    )

    if (!response.ok || json?.success === false) {
      throw new Error(
        json?.error?.message ||
          json?.error ||
          'Не удалось запустить подтверждение номера.',
      )
    }

    setPhoneVerifyCallId(Number(json?.data?.id))
    setPhoneVerifyAuthPhone(json?.data?.auth_phone || null)
    setPhoneVerifyImageUrl(json?.data?.url_image || null)
    setPhoneVerifyStatus('pending')
    setPhoneModalError(null)
  }, [])

  const checkPhoneVerification = useCallback(async (digitsOnly, callId) => {
    if (!digitsOnly || !callId) {
      return 'pending'
    }
    if (phoneCheckInFlightRef.current) {
      return 'pending'
    }

    phoneCheckInFlightRef.current = true
    try {
      const { response, json } = await requestApiJson(
        `${PHONE_VERIFY_API_BASE}/check`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: digitsOnly,
            flow: 'change_phone',
            callId,
          }),
          fallbackMessage: 'Не удалось проверить подтверждение номера',
        },
      )

      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error?.message ||
            json?.error ||
            'Не удалось проверить подтверждение номера.',
        )
      }

      const nextStatus = String(json?.data?.status || 'pending').toLowerCase()
      setPhoneVerifyStatus(nextStatus)
      if (nextStatus === 'expired') {
        setPhoneVerifyAuthPhone(null)
        setPhoneVerifyImageUrl(null)
        setPhoneModalError(
          'Время подтверждения звонком истекло. Запросите SMS-код или начните заново.',
        )
      }

      return nextStatus
    } finally {
      phoneCheckInFlightRef.current = false
    }
  }, [])

  const startSmsVerification = useCallback(async () => {
    const digitsOnly = normalizePhoneForSubmit(phoneDraft)
    const { response, json } = await requestApiJson(
      `${PHONE_VERIFY_API_BASE}/sms/start`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: 'change_phone',
          location: pushLocation,
        }),
        fallbackMessage: 'Не удалось отправить SMS-код',
      },
    )

    if (!response.ok || json?.success === false) {
      throw new Error(json?.error?.message || 'Не удалось отправить SMS-код.')
    }

    setPhoneVerifyStatus('sms_pending')
    setPhoneSmsCode('')
    setPhoneModalError(null)
  }, [phoneDraft, pushLocation])

  const checkSmsVerification = useCallback(async () => {
    const digitsOnly = normalizePhoneForSubmit(phoneDraft)
    const { response, json } = await requestApiJson(
      `${PHONE_VERIFY_API_BASE}/sms/check`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: digitsOnly,
          flow: 'change_phone',
          code: phoneSmsCode,
        }),
        fallbackMessage: 'Не удалось проверить SMS-код',
      },
    )

    if (!response.ok || json?.success === false) {
      throw new Error(json?.error?.message || 'Не удалось проверить SMS-код.')
    }

    setPhoneVerifyStatus('ok')
    setPhoneModalError(null)
    return 'ok'
  }, [phoneDraft, phoneSmsCode])

  const finalizePhoneChange = useCallback(
    async (digitsOnly, callId) => {
      const { response, json } = await requestApiJson(
        `${CABINET_USERS_API_BASE}/change-phone`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: digitsOnly,
            callId,
          }),
          fallbackMessage: 'Не удалось обновить номер телефона',
        },
      )

      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error?.message ||
            json?.error ||
            'Не удалось обновить номер телефона.',
        )
      }

      const normalized = normalizeUserProfile(json?.data)
      setFormState(normalized)
      setLastSavedState(normalized)
      setSaveState({ isSaving: false, isSaved: true, error: null })

      if (typeof updateSession === 'function') {
        await updateSession()
      }
    },
    [updateSession],
  )

  const handlePhoneModalSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (isPhoneModalSubmitting) {
        return
      }

      const digitsOnly = normalizePhoneForSubmit(phoneDraft)
      if (!digitsOnly || digitsOnly.length < 11) {
        setPhoneModalError('Введите корректный номер телефона.')
        return
      }

      const currentPhoneDigits = normalizePhoneForSubmit(
        safeFormState.phone || '',
      )
      if (currentPhoneDigits && currentPhoneDigits === digitsOnly) {
        setPhoneModalError('Этот номер уже подтвержден в вашем профиле.')
        return
      }

      setIsPhoneModalSubmitting(true)
      setPhoneModalError(null)

      try {
        if (!phoneVerifyCallId) {
          const precheck = await precheckPhoneForChange(digitsOnly)
          if (precheck?.allowed === false) {
            setPhoneModalError(
              precheck.message || 'Проверка номера не пройдена.',
            )
            return
          }

          await startPhoneVerification(digitsOnly)
          return
        }

        if (phoneVerifyStatus === 'sms_pending') {
          if (!/^\d{4}$/.test(phoneSmsCode)) {
            setPhoneModalError('Введите четырёхзначный код из SMS.')
            return
          }
          await checkSmsVerification()
          return
        }

        const verifyStatus =
          phoneVerifyStatus === 'ok'
            ? 'ok'
            : await checkPhoneVerification(digitsOnly, phoneVerifyCallId)

        if (verifyStatus !== 'ok') {
          setPhoneModalError(
            'Номер еще не подтвержден. Выполните звонок и попробуйте снова.',
          )
          return
        }

        await finalizePhoneChange(digitsOnly, phoneVerifyCallId)
        closePhoneModal()
      } catch (error) {
        setPhoneModalError(
          error?.message || 'Не удалось завершить изменение номера телефона.',
        )
      } finally {
        setIsPhoneModalSubmitting(false)
      }
    },
    [
      checkPhoneVerification,
      checkSmsVerification,
      closePhoneModal,
      finalizePhoneChange,
      isPhoneModalSubmitting,
      phoneDraft,
      phoneSmsCode,
      phoneVerifyCallId,
      phoneVerifyStatus,
      precheckPhoneForChange,
      startPhoneVerification,
    ],
  )

  useEffect(() => {
    if (
      !isPhoneModalOpen ||
      !phoneVerifyCallId ||
      ['ok', 'expired', 'sms_pending'].includes(phoneVerifyStatus)
    ) {
      return undefined
    }

    const digitsOnly = normalizePhoneForSubmit(phoneDraft)
    if (!digitsOnly || digitsOnly.length < 11) {
      return undefined
    }

    const intervalId = setInterval(() => {
      checkPhoneVerification(digitsOnly, phoneVerifyCallId).catch((error) => {
        console.error('Phone verify polling error in profile', error)
      })
    }, 3000)

    return () => {
      clearInterval(intervalId)
    }
  }, [
    checkPhoneVerification,
    isPhoneModalOpen,
    phoneDraft,
    phoneVerifyCallId,
    phoneVerifyStatus,
  ])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()

      setSaveState({ isSaving: true, isSaved: false, error: null })

      const normalizeText = (value) =>
        typeof value === 'string' ? value.trim() : ''
      const normalizeNullable = (value) => {
        const normalized = normalizeText(value)
        return normalized.length > 0 ? normalized : null
      }
      const normalizePhone = (value) => {
        if (typeof value !== 'string') {
          return null
        }

        const digits = value.replace(/\D/g, '')
        return digits.length > 0 ? Number(digits) : null
      }

      const payload = {
        name: normalizeText(safeFormState.name),
        username: normalizeNullable(safeFormState.username),
        photoUrl: normalizeNullable(safeFormState.photoUrl),
        phone: normalizePhone(safeFormState.phone),
        about: normalizeText(safeFormState.about),
        preferences: Array.isArray(safeFormState.preferences)
          ? Array.from(
              new Set(
                safeFormState.preferences
                  .map((item) => normalizeText(item))
                  .filter((item) => item.length > 0),
              ),
            )
          : [],
      }

      if (isAdminOrDeveloper) {
        payload.adminEventPushLocations = Array.from(
          new Set(
            (Array.isArray(safeFormState.adminEventPushLocations)
              ? safeFormState.adminEventPushLocations
              : []
            )
              .map((item) => normalizeText(item).toLowerCase())
              .filter((item) =>
                locationOptions.some((option) => option.value === item),
              ),
          ),
        )
      }

      try {
        const { json } = await requestApiJson(
          `${CABINET_USERS_API_BASE}/profile`,
          {
            method: 'PUT',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            fallbackMessage: 'Не удалось сохранить изменения',
          },
        )

        const normalized = normalizeUserProfile(json.data)

        setFormState(normalized)
        setLastSavedState(normalized)
        setSaveState({ isSaving: false, isSaved: true, error: null })
      } catch (error) {
        console.error('Failed to update profile', error)
        setSaveState({
          isSaving: false,
          isSaved: false,
          error: 'Не удалось сохранить профиль. Попробуйте ещё раз.',
        })
      }
    },
    [isAdminOrDeveloper, safeFormState],
  )

  const toggleAdminPushLocation = useCallback((locationKey, enabled) => {
    setFormState((prevState) => {
      const current = normalizeUserProfile(prevState)
      const currentList = Array.isArray(current.adminEventPushLocations)
        ? current.adminEventPushLocations
        : []
      const nextList = enabled
        ? Array.from(new Set([...currentList, locationKey]))
        : currentList.filter((item) => item !== locationKey)

      return {
        ...current,
        adminEventPushLocations: nextList,
      }
    })
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const handlePushNotificationsToggle = useCallback(
    async (event) => {
      const shouldEnable = Boolean(event?.target?.checked)
      setPushFeedback(null)

      if (shouldEnable) {
        let permission = null
        if (
          typeof window !== 'undefined' &&
          window.Notification &&
          window.Notification.permission === 'default'
        ) {
          permission = await window.Notification.requestPermission()
          if (permission !== 'granted') {
            setPushFeedback({
              type: 'error',
              message:
                permission === 'denied'
                  ? 'Уведомления запрещены в браузере для этого сайта.'
                  : 'Браузер не показал или не подтвердил запрос разрешения на уведомления.',
            })
            return
          }
        }

        const result = await subscribePush({
          skipPermissionRequest: true,
          permission,
        })
        if (result?.success) {
          setPushFeedback(null)
          setToastEvent({
            id: `${Date.now()}-push-enabled`,
            type: 'success',
            message: 'Push-уведомления включены.',
          })
          return
        }

        if (typeof result?.message === 'string' && result.message.trim()) {
          setPushFeedback({
            type: 'error',
            message: result.message.trim(),
          })
        }
        return
      }

      const result = await unsubscribePush()
      if (result?.success) {
        setPushFeedback(null)
        setToastEvent({
          id: `${Date.now()}-push-disabled`,
          type: 'success',
          message: 'Push-уведомления отключены.',
        })
      }
    },
    [subscribePush, unsubscribePush],
  )

  return (
    <>
      <CabinetLayout
        title="Мой профиль"
        description="Обновите контакты, чтобы участники и коллеги могли быстро связаться с вами."
        activePage="profile"
      >
        <FormSectionCard>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <CabinetInputField
                id="profile-name"
                label="Имя и фамилия"
                value={safeFormState.name}
                onChange={(event) => handleChange('name', event.target.value)}
              />

              <CabinetInputField
                id="profile-username"
                label="Никнейм в ActQuest"
                value={safeFormState.username ?? ''}
                onChange={(event) =>
                  handleChange('username', event.target.value)
                }
                placeholder="Например, quest_master"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                Фото профиля
              </label>
              <ImagesInput
                images={safeFormState.photoUrl ? [safeFormState.photoUrl] : []}
                onChange={(nextImages) =>
                  handleChange('photoUrl', nextImages?.[0] ?? '')
                }
                directory="users"
                imageName={resolvedProfileId || 'user'}
                maxImages={1}
                previewShape="circle"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="profile-phone"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Телефон
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <input
                  id="profile-phone"
                  type="tel"
                  value={formatPhoneInput(safeFormState.phone)}
                  disabled
                  placeholder="+7 900 000-00-00"
                  className="w-full max-w-[10rem] cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 opacity-90 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-400"
                />
                <CabinetButton
                  type="button"
                  variant="secondary"
                  tone="brand"
                  onClick={openPhoneModal}
                >
                  Изменить номер
                </CabinetButton>
              </div>
            </div>
            <CabinetSelectField
              id="profile-location"
              label="Город участия"
              value={selectedLocation}
              onChange={handleLocationChange}
              disabled={isLocationSaving}
            >
              <option value="" disabled>
                Выберите город
              </option>
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CabinetSelectField>
            {locationSaveError ? (
              <NoticeBanner tone="error" variant="neon">
                {locationSaveError}
              </NoticeBanner>
            ) : null}

            <div className="flex flex-col gap-y-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                Уведомления
              </label>
              <NeonCheckbox
                id="profile-push-notifications"
                checked={isPushSubscribed}
                onChange={handlePushNotificationsToggle}
                disabled={
                  isPushProcessing || !canControlPush || !isPushConfigured
                }
                label="Push-уведомления (включая уведомления, вы автоматически соглашаетесь на получение рассылки)"
                description={
                  isPushProcessing ? 'Обновляем настройки уведомлений...' : ''
                }
                className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-[#00D1FF]/25 dark:bg-[#050012]/55"
              />
              {!isPushSupported ? (
                <NoticeBanner tone="warning" variant="neon">
                  {isPushIOSDevice && !isPushStandalone ? (
                    <>
                      <span className="font-semibold">
                        Для получения push-уведомлений на iPhone:
                      </span>
                      <ol className="mt-1 ml-4 list-decimal text-xs space-y-0.5">
                        <li>
                          Нажмите кнопку «Поделиться» (квадрат со стрелкой)
                          внизу Safari
                        </li>
                        <li>Выберите «На экран Домой»</li>
                        <li>Откройте приложение с домашнего экрана</li>
                        <li>Включите уведомления в профиле</li>
                      </ol>
                    </>
                  ) : (
                    'Ваш браузер не поддерживает push-уведомления.'
                  )}
                </NoticeBanner>
              ) : null}
              {isPushSupported &&
              pushConfigStatus !== 'loading' &&
              !isPushConfigured ? (
                <NoticeBanner tone="warning" variant="neon">
                  Push-уведомления временно недоступны: не настроен публичный
                  ключ.
                </NoticeBanner>
              ) : null}
              {pushFeedback?.type === 'error' ? (
                <NoticeBanner tone="error" variant="neon">
                  {pushFeedback.message}
                </NoticeBanner>
              ) : null}
              {resolvedPushError ? (
                <NoticeBanner tone="error" variant="neon">
                  {resolvedPushError}
                </NoticeBanner>
              ) : null}

              {isAdminOrDeveloper ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-3 dark:border-[#00D1FF]/25 dark:bg-[#050012]/55">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                    Уведомления администратора о событиях сайта
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Выберите города, по которым получать push о событиях из
                    раздела «Администрирование → События сайта».
                  </p>
                  <div className="space-y-2">
                    {locationOptions.map((option) => (
                      <NeonCheckbox
                        key={option.value}
                        id={`profile-admin-events-location-${option.value}`}
                        checked={(
                          safeFormState.adminEventPushLocations ?? []
                        ).includes(option.value)}
                        onChange={(event) =>
                          toggleAdminPushLocation(
                            option.value,
                            Boolean(event?.target?.checked),
                          )
                        }
                        label={option.label}
                        disabled={saveState.isSaving}
                        className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-[#00D1FF]/20 dark:bg-[#050012]/45"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <CabinetTextareaField
              id="profile-about"
              label="О себе"
              value={safeFormState.about}
              onChange={(event) => handleChange('about', event.target.value)}
              rows={5}
              placeholder="Расскажите об опыте, любимых форматах и роли в команде."
            />

            {saveState.error ? (
              <NoticeBanner tone="error" variant="neon">
                {saveState.error}
              </NoticeBanner>
            ) : null}
            {saveState.isSaved ? (
              <NoticeBanner tone="success" variant="neon">
                Профиль обновлён.
              </NoticeBanner>
            ) : null}

            <div className="flex flex-col gap-3 md:flex-row">
              <CabinetButton
                type="submit"
                disabled={saveState.isSaving || !hasChanges}
                variant="primary"
                className={saveState.isSaving ? 'cursor-wait' : ''}
              >
                {saveState.isSaving ? 'Сохраняем…' : 'Сохранить профиль'}
              </CabinetButton>
              {saveState.isSaved ? (
                <span className="inline-flex items-center rounded-xl border border-[#1fdc95]/35 bg-[#1fdc95]/12 px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-[#bdf7d8]">
                  Изменения сохранены
                </span>
              ) : null}
            </div>
          </form>
        </FormSectionCard>
      </CabinetLayout>
      <FeedbackToast event={toastEvent} />
      <Modal
        isOpen={isPhoneModalOpen}
        onClose={closePhoneModal}
        title="Изменение номера телефона"
        compactMobile
        footer={
          <>
            <CabinetButton
              type="button"
              variant="secondary"
              tone="brand"
              onClick={closePhoneModal}
              disabled={isPhoneModalSubmitting}
            >
              Отмена
            </CabinetButton>
            <CabinetButton
              type="submit"
              form="profile-change-phone-form"
              variant="primary"
              disabled={isPhoneModalSubmitting}
              className={isPhoneModalSubmitting ? 'cursor-wait' : ''}
            >
              {isPhoneModalSubmitting
                ? 'Проверяем…'
                : phoneVerifyCallId
                  ? phoneVerifyStatus === 'sms_pending'
                    ? 'Подтвердить SMS-код'
                    : phoneVerifyStatus === 'ok'
                    ? 'Сохранить номер'
                    : 'Проверить подтверждение'
                  : 'Подтвердить номер'}
            </CabinetButton>
          </>
        }
      >
        <form
          id="profile-change-phone-form"
          className="space-y-4"
          onSubmit={handlePhoneModalSubmit}
        >
          <CabinetInputField
            id="profile-change-phone-input"
            label="Новый номер телефона"
            type="tel"
            value={phoneDraft}
            onChange={(event) =>
              setPhoneDraft(formatPhoneInput(event.target.value))
            }
            placeholder="+7"
            disabled={isPhoneModalSubmitting || Boolean(phoneVerifyCallId)}
          />

          {phoneVerifyCallId ? (
            <div className="rounded-xl border border-[#00D1FF]/25 bg-[#050012]/70 p-3 text-xs text-[#bfeeff] dark:text-[#bfeeff]">
              {phoneVerifyStatus === 'sms_pending' ? (
                <div className="space-y-2">
                  <div>Введите четырёхзначный код из SMS:</div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={phoneSmsCode}
                    onChange={(event) =>
                      setPhoneSmsCode(
                        event.target.value.replace(/\D/g, '').slice(0, 4),
                      )
                    }
                    placeholder="0000"
                    className="w-full rounded-xl border border-[#00D1FF]/35 bg-[#080017]/80 px-4 py-3 text-center text-lg tracking-[0.35em] text-white focus:border-[#00D1FF] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  Позвоните по номеру ниже для подтверждения нового телефона:
                </div>
              )}
              {phoneVerifyStatus !== 'sms_pending' && phoneVerifyAuthPhone ? (
                <div className="flex flex-col items-start gap-1 mt-2">
                  {(() => {
                    const rawPhone = String(phoneVerifyAuthPhone || '').replace(
                      /[^\d+]/g,
                      '',
                    )
                    const normalizedDisplayPhone = rawPhone.startsWith('+')
                      ? rawPhone
                      : `+${rawPhone.replace(/^\++/, '')}`
                    const telPhone = normalizedDisplayPhone.replace(/\s+/g, '')

                    return (
                      <a
                        href={`tel:${telPhone}`}
                        className="inline-flex cursor-pointer items-center rounded-lg border border-[#00D1FF]/45 bg-[#00D1FF]/10 px-3 py-1.5 text-sm font-semibold text-[#baf3ff] transition hover:bg-[#00D1FF]/20"
                      >
                        {normalizedDisplayPhone}
                      </a>
                    )
                  })()}
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[#9fd9ff]">
                    Звонок бесплатный
                  </p>
                </div>
              ) : null}
              {phoneVerifyStatus !== 'sms_pending' && phoneVerifyImageUrl ? (
                <div className="flex-col items-center justify-center hidden gap-2 mt-3 md:flex">
                  <img
                    src={phoneVerifyImageUrl}
                    alt="QR для подтверждения звонка"
                    className="h-36 w-36 rounded-lg border border-[#00D1FF]/35"
                  />
                </div>
              ) : null}
              {phoneVerifyStatus === 'ok' ? (
                <NoticeBanner tone="success" variant="neon" className="mt-3">
                  Номер подтвержден. Нажмите «Сохранить номер».
                </NoticeBanner>
              ) : null}
              {phoneVerifyStatus !== 'sms_pending' &&
              phoneVerifyStatus !== 'ok' &&
              siteAccess.allowSmsVerification ? (
                <CabinetButton
                  type="button"
                  variant="secondary"
                  tone="brand"
                  className="mt-3"
                  disabled={isPhoneModalSubmitting}
                  onClick={async () => {
                    setIsPhoneModalSubmitting(true)
                    try {
                      await startSmsVerification()
                    } catch (error) {
                      setPhoneModalError(
                        error?.message || 'Не удалось отправить SMS-код.',
                      )
                    } finally {
                      setIsPhoneModalSubmitting(false)
                    }
                  }}
                >
                  Не получилось позвонить — получить код по SMS
                </CabinetButton>
              ) : null}
            </div>
          ) : null}

          {phoneModalError ? (
            <NoticeBanner tone="error" variant="neon">
              {phoneModalError}
            </NoticeBanner>
          ) : null}
        </form>
      </Modal>
    </>
  )
}

ProfilePage.propTypes = {
  initialProfile: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string,
    photoUrl: PropTypes.string,
    phone: PropTypes.string,
    about: PropTypes.string,
    preferences: PropTypes.arrayOf(PropTypes.string),
    adminEventPushLocations: PropTypes.arrayOf(PropTypes.string),
  }),
}

ProfilePage.defaultProps = {
  initialProfile: normalizeUserProfile(),
}

export default ProfilePage
