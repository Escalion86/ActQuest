import Head from 'next/head'
import Link from 'next/link'
import { LOCATIONS } from '@server/serverConstants'

const features = [
  {
    title: 'Управление играми',
    description:
      'Создавайте квесты, редактируйте сценарии, запускайте и завершайте игры в несколько кликов.',
  },
  {
    title: 'Командная работа',
    description:
      'Формируйте команды, приглашайте участников по ссылке и распределяйте роли прямо из веб-интерфейса.',
  },
  {
    title: 'Гибкое администрирование',
    description:
      'Все инструменты Telegram-бота доступны в удобной панели: сообщения, подсказки, штрафы и статистика.',
  },
]

const steps = [
  {
    title: 'Авторизуйтесь через Telegram',
    description:
      'Используйте официальный виджет Telegram, чтобы безопасно войти в систему и синхронизировать данные с ботом.',
  },
  {
    title: 'Выберите регион',
    description:
      'ActQuest поддерживает несколько городов. Работайте с теми играми и командами, которые вам нужны.',
  },
  {
    title: 'Работайте в личном кабинете',
    description:
      'Вы получаете все функции бота с преимуществами веб-интерфейса: быстрый поиск, история действий и большие экраны.',
  },
]

const Home = () => {
  const availableLocations = Object.entries(LOCATIONS).filter(([, value]) => !value.hidden)

  return (
    <>
      <Head>
        <title>ActQuest — платформа для активных квестов</title>
      </Head>
      <div className="min-h-screen bg-[#F5F6F8] text-[#1C1D1F]">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
            <span className="text-2xl font-bold text-primary">ActQuest</span>
            <nav className="flex items-center gap-6 text-sm font-semibold text-gray-600">
              <Link href="/cabinet" className="transition hover:text-primary">
                Личный кабинет
              </Link>
              <a
                href="https://t.me/ActQuest_dev_bot"
                className="transition hover:text-primary"
                target="_blank"
                rel="noreferrer"
              >
                Бот в Telegram
              </a>
            </nav>
          </div>
        </header>

        <main className="px-4">
          <section className="mx-auto flex max-w-6xl flex-col gap-10 py-16 lg:flex-row lg:items-center">
            <div className="lg:w-1/2">
              <h1 className="text-4xl font-bold text-primary md:text-5xl">
                Активные квесты в Telegram и на веб-платформе
              </h1>
              <p className="mt-6 text-lg text-gray-600">
                ActQuest объединяет участников и организаторов квестов. Управляйте командами, играми и заданиями
                через удобный веб-интерфейс, полностью синхронизированный с Telegram-ботом.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/cabinet"
                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-blue-700"
                >
                  Перейти в личный кабинет
                </Link>
                <a
                  href="https://t.me/ActQuest_dev_bot"
                  className="inline-flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-6 py-3 text-base font-semibold text-blue-700 transition hover:bg-blue-100"
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть Telegram-бота
                </a>
              </div>
            </div>
            <div className="lg:w-1/2">
              <div className="rounded-3xl bg-white p-8 shadow-xl">
                <h2 className="text-xl font-semibold text-primary">Что вы получаете</h2>
                <ul className="mt-6 space-y-5">
                  {features.map((feature) => (
                    <li key={feature.title} className="flex gap-4">
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                      <div>
                        <h3 className="text-lg font-semibold text-primary">{feature.title}</h3>
                        <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl rounded-3xl bg-white p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-primary">Как начать работу</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step.title} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-6">
                  <span className="h-10 w-10 rounded-full bg-blue-600 text-center text-lg font-semibold leading-10 text-white">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-primary">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-12 max-w-6xl">
            <div className="rounded-3xl bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white shadow-xl">
              <h2 className="text-2xl font-semibold">ActQuest развивается в разных городах</h2>
              <p className="mt-3 text-sm text-blue-100">
                Мы поддерживаем несколько площадок. Выбирайте нужный регион в личном кабинете — и получите доступ к
                играм и командам вашего города.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {availableLocations.map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                  >
                    {value.townRu[0].toUpperCase() + value.townRu.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto mt-16 max-w-6xl pb-20">
            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <h2 className="text-2xl font-bold text-primary">Для кого ActQuest</h2>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-primary">Организаторы игр</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Настройка квестов, автоматизация выдачи заданий, контроль подсказок и штрафов.
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-primary">Капитаны команд</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Управление составом, приглашения для участников и мгновенное взаимодействие с организаторами.
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-primary">Игроки</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Быстрый доступ к заданиям, подсказкам и истории прохождения — на компьютере и в мобильном браузере.
                  </p>
                </div>
              </div>
              <div className="mt-10 flex flex-col gap-4 rounded-2xl bg-blue-50 p-6 text-blue-800 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Готовы попробовать?</h3>
                  <p className="mt-1 text-sm">
                    Войдите в личный кабинет и управляйте играми, командами и участниками без ограничений.
                  </p>
                </div>
                <Link
                  href="/cabinet"
                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-blue-700"
                >
                  Перейти в личный кабинет
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
            <span>© {new Date().getFullYear()} ActQuest. Все права защищены.</span>
            <div className="flex flex-wrap gap-4">
              <a href="mailto:info@actquest.ru" className="hover:text-primary">
                info@actquest.ru
              </a>
              <a href="https://t.me/ActQuest_dev_bot" className="hover:text-primary" target="_blank" rel="noreferrer">
                Поддержка в Telegram
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

export default Home
