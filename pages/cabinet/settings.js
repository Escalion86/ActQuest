import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import isUserAdmin from '@helpers/isUserAdmin'
import getSessionSafe from '@helpers/getSessionSafe'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import dbConnect from '@utils/dbConnect'

const SettingsPage = ({ initialSiteSettings }) => {
  const { data: session } = useSession()
  const isAdmin = isUserAdmin({ role: session?.user?.role })
  const [siteSettings, setSiteSettings] = useState(() => initialSiteSettings)
  const [saveState, setSaveState] = useState({ isSaving: false, isSaved: false, error: null })

  useEffect(() => {
    setSiteSettings(initialSiteSettings)
    setSaveState({ isSaving: false, isSaved: false, error: null })
  }, [initialSiteSettings])

  const handleSettingsChange = useCallback((field, value) => {
    setSiteSettings((prevState) => ({ ...prevState, [field]: value }))
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!isAdmin) {
      return
    }

    const location = session?.user?.location ?? null

    if (!location) {
      setSaveState({ isSaving: false, isSaved: false, error: 'Не удалось определить город для сохранения настроек.' })
      return
    }

    setSaveState({ isSaving: true, isSaved: false, error: null })

    const normalizeField = (value) => {
      if (typeof value !== 'string') {
        return null
      }

      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }

    const payload = {
      supportPhone: normalizeField(siteSettings.supportPhone),
      announcement:
        typeof siteSettings.announcement === 'string'
          ? siteSettings.announcement.trim()
          : '',
      chatUrl: normalizeField(siteSettings.chatUrl),
    }

    const baseUrl = `/api/${location}/custom?collection=sitesettings`
    const requestUrl = siteSettings.id ? `${baseUrl}&id=${siteSettings.id}` : baseUrl
    const method = siteSettings.id ? 'PUT' : 'POST'

    try {
      const response = await fetch(requestUrl, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: payload }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Unknown error')
      }

      const json = await response.json()

      if (!json?.success) {
        throw new Error('Не удалось сохранить изменения')
      }

      const normalized = normalizeSiteSettings(json.data)

      setSiteSettings(normalized)
      setSaveState({ isSaving: false, isSaved: true, error: null })
    } catch (error) {
      console.error('Failed to save site settings', error)
      setSaveState({
        isSaving: false,
        isSaved: false,
        error: 'Не удалось сохранить настройки. Попробуйте ещё раз.',
      })
    }
  }, [isAdmin, session, siteSettings])

  if (!isAdmin) {
    return (
      <>
        <Head>
          <title>ActQuest — Настройки сайта</title>
        </Head>
        <CabinetLayout
          title="Настройки сайта"
          description="Обновление публичной информации доступно только администраторам."
          activePage="settings"
        >
          <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-sm text-slate-600">
              У вас нет прав на изменение общих настроек. Свяжитесь с администратором проекта, чтобы получить доступ.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Настройки сайта</title>
      </Head>
      <CabinetLayout
        title="Настройки сайта"
        description="Настройте основные контакты, уведомления и режимы доступа."
        activePage="settings"
      >
        <section className="p-6 space-y-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="settings-support-phone" className="text-sm font-semibold text-primary">
                Телефон поддержки
              </label>
              <input
                id="settings-support-phone"
                type="tel"
                value={siteSettings.supportPhone}
                onChange={(event) => handleSettingsChange('supportPhone', event.target.value)}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                placeholder="Например, +7 (900) 000-00-00"
              />
            </div>
            <div>
              <label htmlFor="settings-chat-url" className="text-sm font-semibold text-primary">
                Ссылка на чат проекта
              </label>
              <input
                id="settings-chat-url"
                type="url"
                value={siteSettings.chatUrl}
                onChange={(event) => handleSettingsChange('chatUrl', event.target.value)}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                placeholder="https://t.me/actquest"
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-announcement" className="text-sm font-semibold text-primary">
              Сообщение для участников
            </label>
            <textarea
              id="settings-announcement"
              value={siteSettings.announcement}
              onChange={(event) => handleSettingsChange('announcement', event.target.value)}
              rows={5}
              className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
            />
          </div>

          {saveState.error ? (
            <div className="px-4 py-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
              {saveState.error}
            </div>
          ) : null}
          {saveState.isSaved ? (
            <div className="px-4 py-3 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl">
              Настройки успешно сохранены.
            </div>
          ) : null}

          <div className="flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState.isSaving}
              className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                saveState.isSaving
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-blue-700'
              }`}
            >
              {saveState.isSaving ? 'Сохраняем…' : 'Сохранить настройки'}
            </button>
            <button
              type="button"
              className="inline-flex justify-center px-5 py-3 text-sm font-semibold text-primary border border-primary rounded-xl hover:bg-blue-50"
            >
              Предпросмотр объявления
            </button>
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

SettingsPage.propTypes = {
  initialSiteSettings: PropTypes.shape({
    id: PropTypes.string,
    supportPhone: PropTypes.string,
    announcement: PropTypes.string,
    chatUrl: PropTypes.string,
  }),
}

SettingsPage.defaultProps = {
  initialSiteSettings: normalizeSiteSettings(),
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/settings'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  let initialSiteSettings = normalizeSiteSettings()

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const SiteSettingsModel = db.model('SiteSettings')
        const settingsDoc = await SiteSettingsModel.findOne({}).lean()
        initialSiteSettings = normalizeSiteSettings(settingsDoc)
      }
    } catch (error) {
      console.error('Failed to load site settings', error)
    }
  }

  return {
    props: {
      session,
      initialSiteSettings,
    },
  }
}

export default SettingsPage
