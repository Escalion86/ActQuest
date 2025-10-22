import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import getSessionSafe from '@helpers/getSessionSafe'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import dbConnect from '@utils/dbConnect'

const preferenceOptions = [
  'Городские квесты',
  'Настольные сценарии',
  'Корпоративные игры',
  'Командные задания',
]

const ProfilePage = ({ initialProfile }) => {
  const { data: session } = useSession()
  const [formState, setFormState] = useState(() => initialProfile)
  const [saveState, setSaveState] = useState({ isSaving: false, isSaved: false, error: null })

  useEffect(() => {
    setFormState(initialProfile)
    setSaveState({ isSaving: false, isSaved: false, error: null })
  }, [initialProfile])

  const handleChange = useCallback((field, value) => {
    setFormState((prevState) => ({ ...prevState, [field]: value }))
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const togglePreference = useCallback((preference) => {
    setFormState((prevState) => {
      const hasPreference = prevState.preferences.includes(preference)

      return {
        ...prevState,
        preferences: hasPreference
          ? prevState.preferences.filter((item) => item !== preference)
          : [...prevState.preferences, preference],
      }
    })
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()

      const location = session?.user?.location ?? null
      const profileId = formState.id ?? null

      if (!location || !profileId) {
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
        name: normalizeText(formState.name),
        username: normalizeNullable(formState.username),
        phone: normalizePhone(formState.phone),
        about: normalizeText(formState.about),
        preferences: Array.isArray(formState.preferences)
          ? Array.from(
              new Set(
                formState.preferences
                  .map((item) => normalizeText(item))
                  .filter((item) => item.length > 0)
              )
            )
          : [],
      }

      try {
        const response = await fetch(
          `/api/${location}/custom?collection=users&id=${profileId}`,
          {
            method: 'PUT',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: payload }),
          }
        )

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
    [formState, session]
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
        <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className="text-sm font-semibold text-primary">
                  Имя и фамилия
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={formState.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-username" className="text-sm font-semibold text-primary">
                  Никнейм в ActQuest
                </label>
                <input
                  id="profile-username"
                  type="text"
                  value={formState.username ?? ''}
                  onChange={(event) => handleChange('username', event.target.value)}
                  className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                  placeholder="Например, quest_master"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-phone" className="text-sm font-semibold text-primary">
                Телефон
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={formState.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                placeholder="+7 900 000-00-00"
              />
            </div>

            <div>
              <label htmlFor="profile-about" className="text-sm font-semibold text-primary">
                О себе
              </label>
              <textarea
                id="profile-about"
                value={formState.about}
                onChange={(event) => handleChange('about', event.target.value)}
                rows={5}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                placeholder="Расскажите об опыте, любимых форматах и роли в команде."
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-primary">Предпочитаемые форматы</p>
              <div className="flex flex-wrap gap-3 mt-3">
                {preferenceOptions.map((preference) => {
                  const isActive = formState.preferences.includes(preference)

                  return (
                    <button
                      key={preference}
                      type="button"
                      onClick={() => togglePreference(preference)}
                      className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
                        isActive
                          ? 'text-white bg-primary shadow-sm'
                          : 'text-slate-600 border border-slate-200 hover:border-primary hover:text-primary'
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
                disabled={saveState.isSaving}
                className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                  saveState.isSaving
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-primary hover:bg-blue-700'
                }`}
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

  const location = session?.user?.location ?? null
  const rawTelegramId = session?.user?.telegramId
  const numericTelegramId =
    rawTelegramId === null || rawTelegramId === undefined ? null : Number(rawTelegramId)
  const telegramId = Number.isFinite(numericTelegramId) ? numericTelegramId : null

  let initialProfile = normalizeUserProfile()

  if (location && telegramId !== null) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const UsersModel = db.model('Users')
        const profileDoc = await UsersModel.findOne({ telegramId }).lean()

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
