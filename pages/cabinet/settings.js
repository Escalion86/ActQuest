import { useState } from 'react'
import Head from 'next/head'
import { useSession } from 'next-auth/react'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import isUserAdmin from '@helpers/isUserAdmin'
import getSessionSafe from '@helpers/getSessionSafe'

const SettingsPage = () => {
  const { data: session } = useSession()
  const isAdmin = isUserAdmin({ role: session?.user?.role })
  const [siteSettings, setSiteSettings] = useState({
    supportEmail: 'support@actquest.ru',
    publicPhone: '+7 (000) 000-00-00',
    registrationEnabled: true,
    maintenanceMode: false,
    announcement:
      'ActQuest готовит обновление сценариев. Следите за новостями и не забудьте проверить расписание игр.',
  })

  const handleSettingsChange = (field, value) => {
    setSiteSettings((prevState) => ({ ...prevState, [field]: value }))
  }

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
              <label htmlFor="settings-support-email" className="text-sm font-semibold text-primary">
                Почта поддержки
              </label>
              <input
                id="settings-support-email"
                type="email"
                value={siteSettings.supportEmail}
                onChange={(event) => handleSettingsChange('supportEmail', event.target.value)}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="settings-public-phone" className="text-sm font-semibold text-primary">
                Телефон для участников
              </label>
              <input
                id="settings-public-phone"
                type="tel"
                value={siteSettings.publicPhone}
                onChange={(event) => handleSettingsChange('publicPhone', event.target.value)}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl">
              <input
                type="checkbox"
                checked={siteSettings.registrationEnabled}
                onChange={(event) => handleSettingsChange('registrationEnabled', event.target.checked)}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-slate-700">
                Разрешить регистрацию новых команд
              </span>
            </label>
            <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl">
              <input
                type="checkbox"
                checked={siteSettings.maintenanceMode}
                onChange={(event) => handleSettingsChange('maintenanceMode', event.target.checked)}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-slate-700">
                Включить режим обслуживания
              </span>
            </label>
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

          <div className="flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              className="inline-flex justify-center px-5 py-3 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
            >
              Сохранить настройки
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

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/settings'
    return {
      redirect: {
        destination: `/cabinet?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  return {
    props: {
      session,
    },
  }
}

export default SettingsPage
