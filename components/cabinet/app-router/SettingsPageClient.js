'use client'

import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'
import NeonCheckbox from '@components/NeonCheckbox'
import isUserAdmin from '@helpers/isUserAdmin'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import requestApiJson from '@helpers/requestApiJson'
import useMergedSession from '@helpers/useMergedSession'

const SETTINGS_CITY_OPTIONS = [
  { key: 'krsk', label: 'Красноярск' },
  { key: 'nrsk', label: 'Норильск' },
  { key: 'ekb', label: 'Екатеринбург' },
]

const ensureSiteSettings = (value) => {
  const fallback = normalizeSiteSettings()
  if (!value || typeof value !== 'object') {
    return fallback
  }

  return {
    ...fallback,
    ...value,
  }
}

const SettingsPage = ({ initialSiteSettings, session: initialSession }) => {
  const { activeSession } = useMergedSession(initialSession)
  const effectiveRole = activeSession?.user?.role ?? 'client'
  const isAdmin = isUserAdmin({ role: effectiveRole })
  const [siteSettings, setSiteSettings] = useState(() => ensureSiteSettings(initialSiteSettings))
  const [saveState, setSaveState] = useState({ isSaving: false, isSaved: false, error: null })

  useEffect(() => {
    setSiteSettings(ensureSiteSettings(initialSiteSettings))
    setSaveState({ isSaving: false, isSaved: false, error: null })
  }, [initialSiteSettings])

  const handleSettingsChange = useCallback((field, value) => {
    setSiteSettings((prevState) => ({ ...ensureSiteSettings(prevState), [field]: value }))
    setSaveState((prevState) => ({ ...prevState, isSaved: false, error: null }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!isAdmin) {
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

    const normalizeLocationMap = (value) => {
      const source =
        value && typeof value === 'object' && !Array.isArray(value) ? value : {}

      return SETTINGS_CITY_OPTIONS.reduce((acc, item) => {
        acc[item.key] = normalizeField(source[item.key])
        return acc
      }, {})
    }

    const supportPhonesByLocation = normalizeLocationMap(
      siteSettings?.supportPhonesByLocation,
    )
    const chatUrlsByLocation = normalizeLocationMap(
      siteSettings?.chatUrlsByLocation,
    )

    const payload = {
      supportPhone: supportPhonesByLocation.krsk ?? normalizeField(siteSettings?.supportPhone),
      chatUrl: chatUrlsByLocation.krsk ?? normalizeField(siteSettings?.chatUrl),
      supportPhonesByLocation,
      chatUrlsByLocation,
      allowSiteAuth: Boolean(siteSettings?.allowSiteAuth),
      allowSiteRegistration: Boolean(siteSettings?.allowSiteRegistration),
      allowSmsVerification: Boolean(siteSettings?.allowSmsVerification),
      enableVkOneTap: Boolean(siteSettings?.enableVkOneTap),
    }

    try {
      const { json } = await requestApiJson('/api/cabinet/settings', {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        fallbackMessage: 'Не удалось сохранить изменения',
      })

      const normalized = normalizeSiteSettings(json.data)

      setSiteSettings(ensureSiteSettings(normalized))
      setSaveState({ isSaving: false, isSaved: true, error: null })
    } catch (error) {
      console.error('Failed to save site settings', error)
      setSaveState({
        isSaving: false,
        isSaved: false,
        error: 'Не удалось сохранить настройки. Попробуйте ещё раз.',
      })
    }
  }, [isAdmin, siteSettings])

  if (!isAdmin) {
    return (
      <>
<CabinetLayout
          title="Управление сайтом"
          description="Обновление публичной информации доступно только администраторам."
          activePage="settings"
        >
          <FormSectionCard>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              У вас нет прав на изменение общих настроек. Свяжитесь с администратором проекта, чтобы получить доступ.
            </p>
          </FormSectionCard>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
<CabinetLayout
        title="Управление сайтом"
        description="Настройте контакты, тексты и доступ к авторизации на сайте."
        activePage="settings"
      >
        <FormSectionCard className="space-y-6">
          <div className="space-y-4">
            <h3 className="aq-modal-section-title text-base font-semibold">
              Контакты по городам
            </h3>
            {SETTINGS_CITY_OPTIONS.map((city) => (
              <div
                key={city.key}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {city.label}
                </p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <CabinetInputField
                    id={`settings-support-phone-${city.key}`}
                    label="Телефон поддержки"
                    type="tel"
                    value={siteSettings?.supportPhonesByLocation?.[city.key] ?? ''}
                    onChange={(event) =>
                      handleSettingsChange('supportPhonesByLocation', {
                        ...(siteSettings?.supportPhonesByLocation || {}),
                        [city.key]: event.target.value,
                      })
                    }
                    placeholder="Например, +7 (900) 000-00-00"
                  />
                  <CabinetInputField
                    id={`settings-chat-url-${city.key}`}
                    label="Ссылка на чат проекта"
                    type="url"
                    value={siteSettings?.chatUrlsByLocation?.[city.key] ?? ''}
                    onChange={(event) =>
                      handleSettingsChange('chatUrlsByLocation', {
                        ...(siteSettings?.chatUrlsByLocation || {}),
                        [city.key]: event.target.value,
                      })
                    }
                    placeholder="https://t.me/..."
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <h3 className="aq-modal-section-title text-base font-semibold">Доступ к сайту</h3>

            <NeonCheckbox
              id="settings-allow-site-auth"
              checked={Boolean(siteSettings.allowSiteAuth)}
              onChange={(event) => handleSettingsChange('allowSiteAuth', event.target.checked)}
              className="mt-4 w-full items-start justify-between gap-4"
              boxAfter
              label={(
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Включить авторизацию на сайте
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Отключение заблокирует вход по телефону и через VK.
                  </p>
                </div>
              )}
            />

            <NeonCheckbox
              id="settings-allow-site-registration"
              checked={Boolean(siteSettings.allowSiteRegistration)}
              onChange={(event) => handleSettingsChange('allowSiteRegistration', event.target.checked)}
              className="w-full items-start justify-between gap-4"
              boxAfter
              label={(
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Включить регистрацию на сайте
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Если отключено, новые аккаунты по телефону нельзя создать.
                  </p>
                </div>
              )}
            />

            <NeonCheckbox
              id="settings-allow-sms-verification"
              checked={Boolean(siteSettings.allowSmsVerification)}
              onChange={(event) =>
                handleSettingsChange('allowSmsVerification', event.target.checked)
              }
              className="w-full items-start justify-between gap-4"
              boxAfter
              label={(
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Включить подтверждение по SMS
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Если отключено, резервная кнопка SMS не показывается, а отправка кода блокируется сервером.
                  </p>
                </div>
              )}
            />

            <NeonCheckbox
              id="settings-enable-vk-one-tap"
              checked={Boolean(siteSettings.enableVkOneTap)}
              onChange={(event) => handleSettingsChange('enableVkOneTap', event.target.checked)}
              className="w-full items-start justify-between gap-4"
              boxAfter
              label={(
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Включить VK One Tap кнопку
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Управляет отображением и доступностью входа через VK One Tap.
                  </p>
                </div>
              )}
            />
          </div>

          {saveState.error ? (
            <NoticeBanner tone="error" variant="neon">
              {saveState.error}
            </NoticeBanner>
          ) : null}
          {saveState.isSaved ? (
            <NoticeBanner tone="success" variant="neon">
              Настройки успешно сохранены.
            </NoticeBanner>
          ) : null}

          <div className="flex flex-col gap-3 md:flex-row">
            <CabinetButton
              onClick={handleSave}
              disabled={saveState.isSaving}
              variant="primary"
            >
              {saveState.isSaving ? 'Сохраняем…' : 'Сохранить настройки'}
            </CabinetButton>
          </div>
        </FormSectionCard>
      </CabinetLayout>
    </>
  )
}

SettingsPage.propTypes = {
  session: PropTypes.object,
  initialSiteSettings: PropTypes.shape({
    id: PropTypes.string,
    supportPhone: PropTypes.string,
    chatUrl: PropTypes.string,
    supportPhonesByLocation: PropTypes.shape({
      krsk: PropTypes.string,
      nrsk: PropTypes.string,
      ekb: PropTypes.string,
    }),
    chatUrlsByLocation: PropTypes.shape({
      krsk: PropTypes.string,
      nrsk: PropTypes.string,
      ekb: PropTypes.string,
    }),
    allowSiteAuth: PropTypes.bool,
    allowSiteRegistration: PropTypes.bool,
    allowSmsVerification: PropTypes.bool,
    enableVkOneTap: PropTypes.bool,
  }),
}

SettingsPage.defaultProps = {
  session: null,
  initialSiteSettings: normalizeSiteSettings(),
}

export default SettingsPage

