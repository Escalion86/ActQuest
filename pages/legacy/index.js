import Head from 'next/head'
import Link from 'next/link'
import { LOCATIONS } from '@server/serverConstants'

const features = [
  {
    title: 'Актуальные городские игры',
    description:
      'Смотрите расписание, формат и условия участия, чтобы быстро выбрать игру под ваш вечер.',
  },
  {
    title: 'Команда друзей',
    description:
      'Создавайте команду, приглашайте участников и договаривайтесь о совместной игре в одном кабинете.',
  },
  {
    title: 'Простой личный кабинет',
    description:
      'Вход, регистрация, участие в играх и история активности без лишних шагов.',
  },
]

const steps = [
  {
    title: 'Выберите регион',
    description:
      'Выберите свой город и получите список доступных игр рядом с вами.',
  },
  {
    title: 'Войдите или зарегистрируйтесь',
    description:
      'Авторизуйтесь через VK ID или по телефону и паролю. Если аккаунта нет, создайте его за пару минут.',
  },
  {
    title: 'Выберите игру и участвуйте',
    description:
      'Собирайте команду, записывайтесь на игру и проводите время активно вместе с друзьями.',
  },
]

const Home = () => {
  const availableLocations = Object.entries(LOCATIONS).filter(
    ([, value]) => !value.hidden
  )

  return (
    <>
      <Head>
        <title>ActQuest</title>
      </Head>
      <div className="min-h-screen bg-[#F5F6F8] text-[#1C1D1F]">
        <header className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between max-w-6xl px-4 py-5 mx-auto">
            <span className="text-2xl font-bold text-primary">ActQuest</span>
            <nav className="flex items-center gap-6 text-sm font-semibold text-gray-600">
              <Link href="/cabinet/login" className="transition hover:text-primary">
                Войти
              </Link>
              <Link
                href="/cabinet/login?mode=register"
                className="transition hover:text-primary"
              >
                Регистрация
              </Link>
            </nav>
          </div>
        </header>

        <main className="px-4">
          <section className="flex flex-col max-w-6xl gap-10 py-16 mx-auto lg:flex-row lg:items-center">
            <div className="lg:w-1/2">
              <h1 className="text-4xl font-bold text-primary md:text-5xl">
                Найдите городскую игру и проведите время активно
              </h1>
              <p className="mt-6 text-lg text-gray-600">
                ActQuest помогает быстро выбрать квест в вашем городе, собрать
                команду и выйти на игру. Всё нужное для участников и организаторов
                собрано в одном кабинете.
              </p>
              <div className="flex flex-col gap-4 mt-8 sm:flex-row">
                <Link
                  href="/cabinet/login"
                  className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white transition bg-blue-600 shadow-lg rounded-2xl hover:bg-blue-700"
                >
                  Авторизация
                </Link>
                <Link
                  href="/cabinet/login?mode=register"
                  className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-blue-700 transition border border-blue-200 rounded-2xl bg-blue-50 hover:bg-blue-100"
                >
                  Регистрация
                </Link>
              </div>
            </div>
            <div className="lg:w-1/2">
              <div className="p-8 bg-white shadow-xl rounded-3xl">
                <h2 className="text-xl font-semibold text-primary">
                  Что вы получаете
                </h2>
                <ul className="mt-6 space-y-5">
                  {features.map((feature) => (
                    <li key={feature.title} className="flex gap-4">
                      <span
                        className="w-2 h-2 mt-1 bg-blue-500 rounded-full"
                        aria-hidden="true"
                      />
                      <div>
                        <h3 className="text-lg font-semibold text-primary">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {feature.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="max-w-6xl p-8 mx-auto bg-white shadow-lg rounded-3xl">
            <h2 className="text-2xl font-bold text-primary">
              Как начать?
            </h2>
            <div className="grid gap-6 mt-8 md:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex flex-col gap-3 p-6 border border-gray-200 rounded-2xl"
                >
                  <span className="w-10 h-10 text-lg font-semibold leading-10 text-center text-white bg-blue-600 rounded-full">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-primary">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-6xl mx-auto mt-12">
            <div className="p-8 text-white shadow-xl rounded-3xl bg-gradient-to-r from-purple-600 to-blue-600">
              <h2 className="text-2xl font-semibold">
                Играйте в своём городе
              </h2>
              <p className="mt-3 text-sm text-blue-100">
                Выбирайте регион в кабинете и сразу получайте доступ к локальным
                играм, командам и событиям.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                {availableLocations.map(([key, value]) => (
                  <span
                    key={key}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-full shadow-sm bg-white/15"
                  >
                    {value.townRu[0].toUpperCase() + value.townRu.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-6xl pb-20 mx-auto mt-16">
            <div className="p-8 bg-white shadow-lg rounded-3xl">
              <h2 className="text-2xl font-bold text-primary">
                Для кого ActQuest
              </h2>
              <div className="grid gap-6 mt-6 md:grid-cols-3">
                <div className="p-6 border border-gray-200 rounded-2xl">
                  <h3 className="text-lg font-semibold text-primary">
                    Игроки и команды
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Ищите новые сценарии, записывайтесь на игры и играйте вместе
                    с друзьями.
                  </p>
                </div>
                <div className="p-6 border border-gray-200 rounded-2xl">
                  <h3 className="text-lg font-semibold text-primary">
                    Капитаны команд
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Управляйте составом команды, приглашайте участников и
                    координируйте участие в играх.
                  </p>
                </div>
                <div className="p-6 border border-gray-200 rounded-2xl">
                  <h3 className="text-lg font-semibold text-primary">Организаторы</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Публикуйте игры, работайте с участниками и держите всё
                    расписание под контролем.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-6 mt-10 text-blue-800 rounded-2xl bg-blue-50 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Готовы попробовать?</h3>
                  <p className="mt-1 text-sm">
                    Выберите город, войдите в кабинет и найдите ближайшую игру
                    для вашей команды.
                  </p>
                </div>
                <Link
                  href="/cabinet/login"
                  className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white transition bg-blue-600 shadow-lg rounded-2xl hover:bg-blue-700"
                >
                  Войти
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-white border-t border-gray-200">
          <div className="flex flex-col max-w-6xl gap-4 px-4 py-6 mx-auto text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
            <span>
              © {new Date().getFullYear()} ActQuest. Все права защищены.
            </span>
            <div className="flex flex-wrap gap-4">
              <a href="mailto:info@actquest.ru" className="hover:text-primary">
                info@actquest.ru
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

export default Home
