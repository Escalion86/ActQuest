import Head from 'next/head'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import isUserAdmin from '@helpers/isUserAdmin'
import getSessionSafe from '@helpers/getSessionSafe'

const adminTools = [
  {
    id: 'manage-users',
    title: 'Управление пользователями',
    description:
      'Назначайте роли, контролируйте права доступа и просматривайте команды, в которых состоят участники.',
    action: 'Перейти к пользователям',
    href: '/cabinet/admin/users',
  },
  {
    id: 'manage-teams',
    title: 'Управление командами',
    description:
      'Просматривайте составы, управляйте капитанами и обновляйте данные команд без перехода в Telegram.',
    action: 'Открыть список команд',
    href: '/cabinet/admin/teams',
  },
  {
    id: 'statistics',
    title: 'Статистика и отчёты',
    description:
      'Анализируйте ключевые показатели проекта: рост аудитории, активность команд и динамику игр.',
    action: 'Посмотреть отчёты',
    href: '/cabinet/admin/reports',
  },
]

const AdminPage = () => {
  const { data: session } = useSession()
  const isAdmin = isUserAdmin({ role: session?.user?.role })

  if (!isAdmin) {
    return (
      <>
        <Head>
          <title>ActQuest — Администрирование</title>
        </Head>
        <CabinetLayout
          title="Администрирование"
          description="Доступ только для администраторов проекта."
          activePage="admin"
        >
          <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
            <p className="text-sm text-slate-600">
              У вас нет доступа к административным инструментам. Если вы считаете, что это ошибка,
              обратитесь к главному организатору или поддержке ActQuest.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Администрирование</title>
      </Head>
      <CabinetLayout
        title="Администрирование"
        description="Управляйте пользователями, командами и отслеживайте динамику проекта."
        activePage="admin"
      >
        <section className="grid gap-6 md:grid-cols-3">
          {adminTools.map((tool) => (
            <article
              key={tool.id}
              className="flex flex-col justify-between p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm"
            >
              <div>
                <h3 className="text-lg font-semibold text-primary">{tool.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{tool.description}</p>
              </div>
              <Link href={tool.href} legacyBehavior>
                <a className="inline-flex justify-center px-4 py-3 mt-6 text-sm font-semibold text-white bg-primary rounded-xl transition hover:bg-blue-700">
                  {tool.action}
                </a>
              </Link>
            </article>
          ))}
        </section>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/admin'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
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

export default AdminPage
