import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import { canManageGame, resolveSessionIdentity } from '@server/gameHistory/gameManageAccess'
import { isGameStageId } from '@server/gameStages'
import { collectSnapshotTeamIdsForUser } from '@helpers/gameParticipation'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import dbConnectGlobal from '@utils/dbConnectGlobal'

export const metadata = { title: 'Общий результат этапа', robots: { index: false } }

const pointsFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

export default async function StageResultPage({ params }) {
  const { location, id } = await params
  if (!isGameStageId(id)) notFound()
  const [db, session] = await Promise.all([dbConnectGlobal(), getServerSession(authOptions)])
  if (!db) notFound()

  const stage = await db.model('GameStages').findOne({ _id: id, location }).lean()
  if (!stage?.result) notFound()
  const games = await db.model('Games').find({ stageId: id, status: { $ne: 'canceled' } })
    .select('dateStart status hidden isPrivate hideResult showResultAudience creatorUserId creatorTelegramId moderators')
    .lean()
  if (!games.length || games.some((game) => game.status !== 'closed')) notFound()

  const canManage = Boolean(session?.user) && games.every((game) => canManageGame({ session, game }))
  const participant = collectSnapshotTeamIdsForUser({ game: stage, userId: resolveSessionIdentity(session).userId }).length > 0
  const needsMembership = games.some((game) => game.hidden || game.isPrivate || game.showResultAudience === 'participants')
  if (!canManage && (games.some((game) => game.hideResult) || (needsMembership && !participant))) notFound()

  const gamesById = new Map(games.map((game) => [String(game._id), game]))

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Общий результат этапа</p>
      <h1 className="mb-6 text-3xl font-bold sm:text-4xl">{stage.name}</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3">Место</th>
              <th scope="col" className="px-4 py-3">{stage.participationMode === 'player' ? 'Участник' : 'Команда'}</th>
              <th scope="col" className="px-4 py-3">Время</th>
              {stage.isRated && <th scope="col" className="px-4 py-3">Очки рейтинга</th>}
              <th scope="col" className="px-4 py-3">Проведение</th>
            </tr>
          </thead>
          <tbody>
            {stage.result.rows.map((row) => {
              const game = gamesById.get(row.sourceGameId)
              return (
                <tr key={row.teamId} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 tabular-nums">{row.place ?? 'Вне зачёта'}</td>
                  <th scope="row" className="px-4 py-3 font-medium">{row.teamName}</th>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{secondsToTimeStr(row.finalSeconds)}</td>
                  {stage.isRated && <td className="px-4 py-3 tabular-nums">{row.score != null ? pointsFormat.format(row.score) : '—'}</td>}
                  <td className="whitespace-nowrap px-4 py-3">
                    {game && (
                      <Link className="underline underline-offset-2" href={`/${location}/game/result/${row.sourceGameId}`}>
                        {formatDateInLocationTimeZone(game.dateStart, location) ?? 'Протокол проведения'}
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}
