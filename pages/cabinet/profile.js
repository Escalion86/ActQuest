import { useState, useEffect, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import getSessionSafe from '@helpers/getSessionSafe'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const preferenceOptions = [
  'Городские квесты',
  'Настольные сценарии',
  'Корпоративные игры',
  'Командные задания',
]

const ProfilePage = ({ initialProfile }) => {
  const { data: session } = useSession()
  const normalizedInitialProfile = useMemo(
    () => normalizeUserProfile(initialProfile),
    [initialProfile],
  )
  const [formState, setFormState] = useState(() => normalizedInitialProfile)
  const [lastSavedState, setLastSavedState] = useState(() => normalizedInitialProfile)
  const [saveState, setSaveState] = useState({ isSaving: false, isSaved: false, error: null })

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
    setFormState((prevState) => ({ ...normalizeUserProfile(prevState), [field]: value }))
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const togglePreference = useCallback((preference) => {
    setFormState((prevState) => {
      const normalizedState = normalizeUserProfile(prevState)
      const hasPreference = normalizedState.preferences.includes(preference)

      return {
        ...normalizedState,
        preferences: hasPreference
          ? normalizedState.preferences.filter((item) => item !== preference)
          : [...normalizedState.preferences, preference],
      }
    })
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const safeFormState = useMemo(() => normalizeUserProfile(formState), [formState])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()

      if (!safeFormState.id) {
        setSaveState({
          isSaving: false,
          isSaved: false,
          error: 'Не удалось определить пользователя для обновления профиля.',
        })
        return
      }

      setSaveState({ isSaving: true, isSaved: false, error: null })

      const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')
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
        phone: normalizePhone(safeFormState.phone),
        about: normalizeText(safeFormState.about),
        preferences: Array.isArray(safeFormState.preferences)
          ? Array.from(
              new Set(
                safeFormState.preferences
                  .map((item) => normalizeText(item))
                  .filter((item) => item.length > 0)
              )
            )
          : [],
      }

      try {
        const response = await fetch('/api/cabinet/users/profile', {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || 'Unknown error')
        }

        const json = await response.json()

        if (!json?.success) {
          throw new Error('Не удалось сохранить изменения')
        }

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
    [safeFormState, session]
  )

  const submitButtonClasses = useMemo(() => {
    if (saveState.isSaving) {
      return 'bg-blue-400 text-white cursor-wait'
    }

    if (!hasChanges) {
      return 'bg-slate-200 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300 cursor-not-allowed'
    }

    return 'bg-primary hover:bg-blue-700 text-white'
  }, [hasChanges, saveState.isSaving])

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
        <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-name"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-100"
                >
                  Имя и фамилия
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={safeFormState.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-username"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-100"
                >
                  Никнейм в ActQuest
                </label>
                <input
                  id="profile-username"
                  type="text"
                  value={safeFormState.username ?? ''}
                  onChange={(event) => handleChange('username', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Например, quest_master"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-phone"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Телефон
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={safeFormState.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400"
                placeholder="+7 900 000-00-00"
              />
            </div>

            <div>
              <label
                htmlFor="profile-about"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                О себе
              </label>
              <textarea
                id="profile-about"
                value={safeFormState.about}
                onChange={(event) => handleChange('about', event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400"
                placeholder="Расскажите об опыте, любимых форматах и роли в команде."
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                Предпочитаемые форматы
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {preferenceOptions.map((preference) => {
                  const isActive = safeFormState.preferences.includes(preference)

                  return (
                    <button
                      key={preference}
                      type="button"
                      onClick={() => togglePreference(preference)}
                      className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
                        isActive
                          ? 'text-white bg-primary shadow-sm'
                          : 'text-slate-600 border border-slate-200 hover:border-primary hover:text-primary dark:border-slate-600 dark:bg-slate-800/35 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-200'
                      }`}
                    >
                      {preference}
                    </button>
                  )
                })}
              </div>
            </div>

            {saveState.error ? (
              <div className="px-4 py-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
                {saveState.error}
              </div>
            ) : null}
            {saveState.isSaved ? (
              <div className="px-4 py-3 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl">
                Профиль обновлён.
              </div>
            ) : null}

            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="submit"
                disabled={saveState.isSaving || !hasChanges}
                className={`inline-flex justify-center px-5 py-3 text-sm font-semibold rounded-xl transition ${submitButtonClasses}`}
              >
                {saveState.isSaving ? 'Сохраняем…' : 'Сохранить профиль'}
              </button>
              {saveState.isSaved ? (
                <span className="inline-flex items-center px-5 py-3 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl">
                  Изменения сохранены
                </span>
              ) : null}
            </div>
          </form>
        </section>
      </CabinetLayout>
    </>
  )
}

ProfilePage.propTypes = {
  initialProfile: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string,
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
    rawTelegramId === null || rawTelegramId === undefined ? null : Number(rawTelegramId)
  const telegramId = Number.isFinite(numericTelegramId) ? numericTelegramId : null
  const rawPhone = session?.user?.phone
  const numericPhone = rawPhone === null || rawPhone === undefined ? null : Number(rawPhone)
  const phone = Number.isFinite(numericPhone) ? numericPhone : null
  const rawVkId = session?.user?.vkId
  const numericVkId = rawVkId === null || rawVkId === undefined ? null : Number(rawVkId)
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
