'use client'

import Link from 'next/link'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import canManageTransactions from '@helpers/canManageTransactions'
import isUserAdmin from '@helpers/isUserAdmin'
import useMergedSession from '@helpers/useMergedSession'

const adminTools = [
  {
    id: 'game-reviews',
    title: 'Отзывы об играх',
    description:
      'Просматривайте оценки участников, замечания и согласия на публикацию отзывов.',
    action: 'Открыть отзывы',
    href: '/cabinet/admin/reviews',
  },
  {
    id: 'game-orders',
    title: 'Заявки на игры',
    description:
      'Обрабатывайте корпоративные и частные заявки, согласуйте дату и создавайте закрытые игры.',
    action: 'Открыть заявки',
    href: '/cabinet/admin/game-orders',
  },
  {
    id: 'site-events',
    title: 'События сайта',
    description:
      'Просматривайте последние ключевые действия: регистрации пользователей, операции с командами и записи на игры.',
    action: 'Открыть события',
    href: '/cabinet/admin/events',
  },
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
  {
    id: 'photo-review',
    title: 'Проверка фотоквеста',
    description:
      'Проверяйте отправленные фото по заданиям, принимайте основные задания и подзадачи.',
    action: 'Открыть проверку',
    href: '/cabinet/admin/photo-review',
  },
  {
    id: 'transactions',
    title: 'Транзакции',
    description:
      'Ведите учёт доходов и расходов, выдавайте купоны и контролируйте бонусный баланс пользователей.',
    action: 'Открыть транзакции',
    href: '/cabinet/admin/transactions',
  },
]

const AdminPage = ({ session: initialSession }) => {
  const { activeSession } = useMergedSession(initialSession)
  const effectiveRole = activeSession?.user?.role ?? 'client'
  const isAdmin = isUserAdmin({ role: effectiveRole })
  const tools = canManageTransactions({ role: effectiveRole })
    ? adminTools
    : adminTools.filter((tool) => tool.id !== 'transactions')

  if (!isAdmin) {
    return (
      <>
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
<CabinetLayout
        title="Администрирование"
        description="Управляйте пользователями, командами и отслеживайте динамику проекта."
        activePage="admin"
      >
        <section className="grid gap-6 md:grid-cols-3">
          {tools.map((tool) => (
            <article
              key={tool.id}
              className="flex flex-col justify-between p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm"
            >
              <div>
                <h3 className="text-lg font-semibold text-primary">{tool.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{tool.description}</p>
              </div>
              <Link
                href={tool.href}
                className="inline-flex justify-center px-4 py-3 mt-6 text-sm font-semibold text-white bg-primary rounded-xl transition hover:bg-blue-700"
              >
                {tool.action}
              </Link>
            </article>
          ))}
        </section>
      </CabinetLayout>
    </>
  )
}

export default AdminPage
