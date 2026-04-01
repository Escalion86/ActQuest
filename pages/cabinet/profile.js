import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import ImagesInput from '@components/cabinet/ImagesInput'
import NoticeBanner from '@components/NoticeBanner'
import Modal from '@components/Modal'
import getSessionSafe from '@helpers/getSessionSafe'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import { formatPhoneInput, normalizePhoneForSubmit } from '@helpers/phoneInputMask'
import requestApiJson from '@helpers/requestApiJson'
import dbConnectGlobal from '@utils/dbConnectGlobal'

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
  const [phoneModalError, setPhoneModalError] = useState(null)
  const [isPhoneModalSubmitting, setIsPhoneModalSubmitting] = useState(false)
  const phoneCheckInFlightRef = useRef(false)

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

  const resetPhoneVerification = useCallback((nextPhoneValue = '') => {
    setPhoneVerifyCallId(null)
    setPhoneVerifyAuthPhone(null)
    setPhoneVerifyImageUrl(null)
    setPhoneVerifyStatus('pending')
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
    const { response, json } = await requestApiJson('/api/phone/verify/precheck', {
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
    })

    if (!response.ok || json?.success === false) {
      throw new Error(json?.error?.message || json?.error || 'Не удалось проверить номер телефона.')
    }

    return json?.data || { allowed: true, reason: null, message: null }
  }, [])

  const startPhoneVerification = useCallback(async (digitsOnly) => {
    const { response, json } = await requestApiJson('/api/phone/verify/start', {
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
    })

    if (!response.ok || json?.success === false) {
      throw new Error(json?.error?.message || json?.error || 'Не удалось запустить подтверждение номера.')
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
      const { response, json } = await requestApiJson('/api/phone/verify/check', {
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
      })

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
        setPhoneVerifyCallId(null)
        setPhoneVerifyAuthPhone(null)
        setPhoneVerifyImageUrl(null)
        setPhoneModalError('Время подтверждения истекло. Запросите звонок повторно.')
      }

      return nextStatus
    } finally {
      phoneCheckInFlightRef.current = false
    }
  }, [])

  const finalizePhoneChange = useCallback(
    async (digitsOnly, callId) => {
      const { response, json } = await requestApiJson('/api/cabinet/users/change-phone', {
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
      })

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error?.message || json?.error || 'Не удалось обновить номер телефона.')
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

      const currentPhoneDigits = normalizePhoneForSubmit(safeFormState.phone || '')
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
            setPhoneModalError(precheck.message || 'Проверка номера не пройдена.')
            return
          }

          await startPhoneVerification(digitsOnly)
          return
        }

        const verifyStatus =
          phoneVerifyStatus === 'ok'
            ? 'ok'
            : await checkPhoneVerification(digitsOnly, phoneVerifyCallId)

        if (verifyStatus !== 'ok') {
          setPhoneModalError('Номер еще не подтвержден. Выполните звонок и попробуйте снова.')
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
      closePhoneModal,
      finalizePhoneChange,
      isPhoneModalSubmitting,
      phoneDraft,
      phoneVerifyCallId,
      phoneVerifyStatus,
      precheckPhoneForChange,
      startPhoneVerification,
    ],
  )

  useEffect(() => {
    if (!isPhoneModalOpen || !phoneVerifyCallId || phoneVerifyStatus === 'ok') {
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

      try {
        const { json } = await requestApiJson('/api/cabinet/users/profile', {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          fallbackMessage: 'Не удалось сохранить изменения',
        })

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
    [safeFormState, session],
  )

  return (
    <>
      <Head>
        <title>ActQuest — Мой профиль</title>
      </Head>
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

            <CabinetInputField
              id="profile-phone"
              label="Телефон"
              type="tel"
              value={formatPhoneInput(safeFormState.phone)}
              disabled
              placeholder="+7 900 000-00-00"
              inputClassName="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 opacity-90 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            <div className="-mt-3 flex">
              <CabinetButton
                type="button"
                variant="secondary"
                tone="brand"
                onClick={openPhoneModal}
              >
                Изменить номер
              </CabinetButton>
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
      <Modal
        isOpen={isPhoneModalOpen}
        onClose={closePhoneModal}
        title="Изменение номера телефона"
        compactMobile
        footer={(
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
                  ? phoneVerifyStatus === 'ok'
                    ? 'Сохранить номер'
                    : 'Проверить подтверждение'
                  : 'Подтвердить номер'}
            </CabinetButton>
          </>
        )}
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
            onChange={(event) => setPhoneDraft(formatPhoneInput(event.target.value))}
            placeholder="+7"
            disabled={isPhoneModalSubmitting || Boolean(phoneVerifyCallId)}
          />

          {phoneVerifyCallId ? (
            <div className="rounded-xl border border-[#00D1FF]/25 bg-[#050012]/70 p-3 text-xs text-[#bfeeff] dark:text-[#bfeeff]">
              <div>Позвоните по номеру ниже для подтверждения нового телефона:</div>
              {phoneVerifyAuthPhone ? (
                <div className="mt-2 flex flex-col items-start gap-1">
                  {(() => {
                    const rawPhone = String(phoneVerifyAuthPhone || '').replace(/[^\d+]/g, '')
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
              {phoneVerifyImageUrl ? (
                <div className="mt-3 hidden flex-col items-center justify-center gap-2 md:flex">
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
  }),
}

ProfilePage.defaultProps = {
  initialProfile: normalizeUserProfile(),
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/profile'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  const userId = session?.user?.globalUserId || session?.user?._id
  const rawTelegramId = session?.user?.telegramId
  const numericTelegramId =
    rawTelegramId === null || rawTelegramId === undefined
      ? null
      : Number(rawTelegramId)
  const telegramId = Number.isFinite(numericTelegramId)
    ? numericTelegramId
    : null
  const rawPhone = session?.user?.phone
  const numericPhone =
    rawPhone === null || rawPhone === undefined ? null : Number(rawPhone)
  const phone = Number.isFinite(numericPhone) ? numericPhone : null
  const rawVkId = session?.user?.vkId
  const numericVkId =
    rawVkId === null || rawVkId === undefined ? null : Number(rawVkId)
  const vkId = Number.isFinite(numericVkId) ? numericVkId : null

  let initialProfile = normalizeUserProfile()

  if (userId || phone !== null || telegramId !== null || vkId !== null) {
    try {
      const db = await dbConnectGlobal()

      if (db) {
        const UsersModel = db.model('Users')
        const profileDoc = userId
          ? await UsersModel.findById(userId).lean()
          : phone !== null
            ? await UsersModel.findOne({ phone }).lean()
            : telegramId !== null
              ? await UsersModel.findOne({ telegramId }).lean()
              : vkId !== null
                ? await UsersModel.findOne({ vkId }).lean()
                : null

        if (profileDoc) {
          initialProfile = normalizeUserProfile(profileDoc)
        }
      }
    } catch (error) {
      console.error('Failed to load profile data', error)
    }
  }

  return {
    props: {
      session,
      initialProfile,
    },
  }
}

export default ProfilePage
