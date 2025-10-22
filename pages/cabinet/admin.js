import Head from 'next/head'
import { useSession } from 'next-auth/react'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import isUserAdmin from '@helpers/isUserAdmin'
import getSessionSafe from '@helpers/getSessionSafe'

const adminTools = [
  {
    id: 'manage-users',
    title: 'Управление пользователями',
    description: 'Назначайте роли, сбрасывайте доступ и контролируйте права организаторов.',
    action: 'Открыть список пользователей',
  },
  {
    id: 'moderate-games',
    title: 'Проверка сценариев',
    description: 'Просматривайте новые игры перед публикацией и утверждайте изменения.',
    action: 'Перейти к модерации',
  },
  {
    id: 'statistics',
    title: 'Статистика и отчёты',
    description: 'Следите за показателями участников, командами и активностью в разрезе периодов.',
    action: 'Посмотреть отчёты',
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
          <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
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
        description="Контролируйте доступ, модерируйте сценарии и отслеживайте показатели."
        activePage="admin"
      >
        <section className="grid gap-6 md:grid-cols-3">
          {adminTools.map((tool) => (
            <article
              key={tool.id}
              className="flex flex-col justify-between p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
              <div>
                <h3 className="text-lg font-semibold text-primary">{tool.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{tool.description}</p>
              </div>
              <button
                type="button"
                className="inline-flex justify-center px-4 py-3 mt-6 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
              >
                {tool.action}
              </button>
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
