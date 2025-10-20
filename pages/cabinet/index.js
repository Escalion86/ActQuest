import Head from 'next/head'
import { useMemo } from 'react'
import { getSession } from 'next-auth/react'
import CabinetLayout from '@components/cabinet/CabinetLayout'

const quickActions = [
  {
    id: 'create-game',
    title: 'Создать новую игру',
    description:
      'Заполните сценарий, настройте расписание и пригласите команды в несколько шагов.',
    href: '/cabinet/games',
  },
  {
    id: 'invite-team',
    title: 'Пригласить команду',
    description:
      'Отправьте ссылку на участие, назначьте капитана и управляйте составом.',
    href: '/cabinet/teams',
  },
  {
    id: 'update-profile',
    title: 'Обновить анкету',
    description:
      'Укажите актуальные контакты и роль в проекте, чтобы коллеги могли вас найти.',
    href: '/cabinet/profile',
  },
]

const activityFeed = [
  {
    id: 'activity-1',
    title: 'Команда «Северный свет» добавлена',
    time: '5 минут назад',
    category: 'Команды',
  },
  {
    id: 'activity-2',
    title: 'Игра «Осенний марафон» опубликована',
    time: '2 часа назад',
    category: 'Игры',
  },
  {
    id: 'activity-3',
    title: 'Обновлены контактные данные организатора',
    time: 'вчера',
    category: 'Профиль',
  },
]

const statsConfig = [
  {
    id: 'games',
    title: 'Активные игры',
    value: 4,
    delta: '+2 за неделю',
  },
  {
    id: 'teams',
    title: 'Команд участвует',
    value: 18,
    delta: '+5 новых',
  },
  {
    id: 'players',
    title: 'Игроков задействовано',
    value: 112,
    delta: 'стабильно',
  },
]

const CabinetDashboard = () => {
  const stats = useMemo(
    () =>
      statsConfig.map((item) => ({
        ...item,
        value: new Intl.NumberFormat('ru-RU').format(item.value),
      })),
    []
  )

  return (
    <>
      <Head>
        <title>ActQuest — Кабинет</title>
      </Head>
      <CabinetLayout
        title="Обзор"
        description="Следите за активными играми, командами и ключевыми событиями вашего города."
        activePage="dashboard"
      >
        <section className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <article
              key={stat.id}
              className="p-5 transition-shadow bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-500">{stat.title}</p>
              <p className="mt-3 text-3xl font-semibold text-primary">{stat.value}</p>
              <p className="mt-2 text-xs font-medium text-emerald-600">{stat.delta}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h3 className="text-lg font-semibold text-primary">Быстрые действия</h3>
            <p className="mt-1 text-sm text-slate-500">
              Сосредоточьтесь на задачах — переходите к нужным разделам без лишних шагов.
            </p>
            <div className="mt-4 space-y-4">
              {quickActions.map((action) => (
                <a
                  key={action.id}
                  href={action.href}
                  className="block p-4 transition bg-slate-50 rounded-xl hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-primary">{action.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{action.description}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h3 className="text-lg font-semibold text-primary">Лента активности</h3>
            <p className="mt-1 text-sm text-slate-500">
              Последние изменения, которые произошли в вашем кабинете.
            </p>
            <ul className="mt-4 space-y-4">
              {activityFeed.map((item) => (
                <li key={item.id} className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm font-semibold text-primary">{item.title}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>{item.category}</span>
                    <span>{item.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="p-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl text-white shadow-md">
          <h3 className="text-xl font-semibold">Запланируйте следующую игру</h3>
          <p className="mt-2 text-sm text-blue-100">
            Создавайте сценарии заранее, чтобы вовремя запустить квест и подготовить команды к старту.
          </p>
          <div className="flex flex-col gap-3 mt-6 md:flex-row">
            <a
              href="/cabinet/games"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-blue-700 bg-white rounded-xl shadow-sm"
            >
              Перейти к списку игр
            </a>
            <a
              href="/cabinet/admin"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white border border-white/40 rounded-xl hover:bg-white/10"
            >
              Управление доступами
            </a>
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSession(context)

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  return {
    props: {},
  }
}

export default CabinetDashboard
