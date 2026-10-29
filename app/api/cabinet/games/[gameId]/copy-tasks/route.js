import { createHash } from 'node:crypto'
import { Types } from 'mongoose'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { canManageGame, buildHistoryActorFromSession, resolveSessionIdentity } from '@server/gameHistory/gameManageAccess'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import {
  TaskCopyError, buildCopiedTasks, copySnapshotFilter, copyGuardFields,
  extendCopyTemplate, syncCopiedTaskRoutes, taskCopyBlockReason, validateCopyDistribution,
} from '@server/copyGameTasks'

export const dynamic = 'force-dynamic'
const objectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) ? new Types.ObjectId(value) : null
const hash = (value) => createHash('sha256').update(value).digest('hex')
const response = (data) => {
  const result = NextResponse.json({ success: true, data }, { status: 200 })
  result.headers.set('Cache-Control', 'no-store')
  return result
}
const fail = (error) => {
  if (!(error instanceof TaskCopyError)) console.error('[copy-tasks] Ошибка копирования', error)
  return NextResponse.json({ success: false, error: error instanceof TaskCopyError ? error.message : 'Не удалось скопировать задания' }, { status: error.status || 500 })
}
const requireSession = async () => {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new TaskCopyError('Требуется авторизация', 401)
  if (String(session.user.role || '').trim().toLowerCase() === 'ban') throw new TaskCopyError('Недостаточно прав', 403)
  return session
}
const requireAccess = (session, game) => {
  if (!game) throw new TaskCopyError('Игра не найдена', 404)
  if (!canManageGame({ session, game })) throw new TaskCopyError('Нет права доступа к секретному содержимому или редактированию игры', 403)
}
const loadSource = async (Games, gameId, session) => {
  const source = await Games.collection.findOne({ _id: gameId })
  requireAccess(session, source)
  if (!['classic', 'photo'].includes(source.type)) throw new TaskCopyError('Копирование заданий доступно для classic и photo. Сценарный граф story не копируется.', 400)
  return source
}

export async function GET(request, context) {
  try {
    const session = await requireSession()
    const gameId = objectId((await context.params).gameId)
    if (!gameId) throw new TaskCopyError('Некорректный ID исходной игры', 400)
    const db = await dbConnectGlobal(), Games = db.model('Games')
    const source = await loadSource(Games, gameId, session)
    const candidates = await Games.collection.find({ location: source.location, type: source.type, status: 'active', _id: { $ne: gameId } }, { projection: { _id: 1, name: 1, dateStart: 1, type: 1, status: 1, creatorUserId: 1, creatorTelegramId: 1, moderators: 1 } }).toArray()
    return response({
      tasks: (source.tasks || []).map((task, index) => ({ id: String(task._id), title: task.title || `${index + 1} Задание`, blockedReason: taskCopyBlockReason(task) })),
      targets: candidates.filter((game) => canManageGame({ session, game })).map((game) => ({ id: String(game._id), name: game.name, dateStart: game.dateStart, type: game.type, status: game.status })),
    })
  } catch (error) { return fail(error) }
}

export async function POST(request, context) {
  try {
    const session = await requireSession()
    const gameId = objectId((await context.params).gameId)
    const body = await request.json().catch(() => null)
    const targetId = objectId(body?.targetGameId)
    if (!gameId || !targetId || String(gameId) === String(targetId)) throw new TaskCopyError('Выберите другую целевую игру', 400)
    const { taskIds, requestId } = body
    if (!Array.isArray(taskIds) || !taskIds.length || taskIds.length > 1000 || taskIds.some((id) => !objectId(id)) || new Set(taskIds).size !== taskIds.length) throw new TaskCopyError('Выберите непустой список уникальных ID сохранённых заданий', 400)
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new TaskCopyError('Некорректный ключ повторного запроса', 400)
    const db = await dbConnectGlobal(), Games = db.model('Games')
    const identity = resolveSessionIdentity(session)
    const fingerprint = hash(JSON.stringify([identity.userId, identity.userTelegramId, String(gameId), String(targetId), [...taskIds].sort()]))
    const entryId = hash(`${targetId}:${requestId}`).slice(0, 24)
    let beforeGame, updatedGame, receipt
    for (let attempt = 0; attempt < 5; attempt += 1) {
      // Повторяем чтение прав и источника после проигранного CAS.
      const source = await loadSource(Games, gameId, session)
      const target = await Games.collection.findOne({ _id: targetId })
      requireAccess(session, target)
      if (!source.location || source.location !== target.location) throw new TaskCopyError('Игры должны находиться в одном городе', 400)
      if (source.type !== target.type) throw new TaskCopyError('Типы игр должны совпадать', 400)
      receipt = (target.taskCopyOperations || []).find((entry) => entry.id === requestId)
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new TaskCopyError('Этот ключ запроса уже использован для другого набора заданий')
        updatedGame = target
        break
      }
      if (target.status !== 'active') throw new TaskCopyError('Копировать можно только в предстоящую игру со статусом «Активна»')
      const wanted = new Set(taskIds.map((id) => id.toLowerCase()))
      const selected = (source.tasks || []).filter((task) => wanted.has(String(task._id)))
      if (selected.length !== taskIds.length) throw new TaskCopyError('Выбранные задания не найдены в сохранённой исходной игре. Обновите список.', 400)
      const copies = buildCopiedTasks(Games, selected)
      const teams = await db.model('GamesTeams').collection.find({ gameId: String(targetId) }).toArray()
      validateCopyDistribution(target, teams)
      const oldCount = target.tasks?.length || 0
      receipt = { id: requestId, fingerprint, sourceGameId: String(gameId), taskIds: selected.map((task) => String(task._id)), newTaskIds: copies.map((task) => String(task._id)), count: copies.length, oldCount, createdAt: new Date(), completed: false }
      const update = { $push: { tasks: { $each: copies }, taskCopyOperations: receipt }, $set: { updatedAt: new Date() } }
      if (target.taskDistributionMode === 'random') update.$set.taskDistributionTemplate = extendCopyTemplate(target.taskDistributionTemplate || [], oldCount, oldCount + copies.length)
      updatedGame = await Games.collection.findOneAndUpdate(copySnapshotFilter(target, copyGuardFields), update, { returnDocument: 'after' })
      if (updatedGame) { beforeGame = target; break }
    }
    if (!updatedGame) throw new TaskCopyError('Целевая игра одновременно изменяется. Повторите копирование.')
    if (!receipt.completed) {
      try {
        const beforeTeams = await fetchGameHistoryState({ db, gameId: String(targetId), game: beforeGame || updatedGame })
        await syncCopiedTaskRoutes({ db, gameId: targetId, minimumCount: receipt.oldCount })
        updatedGame = await Games.collection.findOne({ _id: targetId })
        const afterState = await fetchGameHistoryState({ db, gameId: String(targetId), game: updatedGame })
        // При восстановлении после обрыва собственные добавления исключаются из before.
        if (!beforeGame) {
          const ownIds = new Set(receipt.newTaskIds)
          beforeTeams.game = { ...updatedGame, tasks: updatedGame.tasks.filter((task) => !ownIds.has(String(task._id))) }
        }
        await recordGameHistoryEntry({ db, entryId, gameId: String(targetId), location: updatedGame.location, actionType: 'game_updated', entityScope: 'game', actor: buildHistoryActorFromSession(session), beforeState: beforeTeams, afterState, snapshot: buildGameHistorySnapshot(afterState), context: { summary: `Скопировано заданий: ${receipt.count}`, sourceGameId: String(gameId) } })
        await Games.collection.findOneAndUpdate({ _id: targetId }, { $set: { [`taskCopyOperations.$[operation].completed`]: true } }, { arrayFilters: [{ 'operation.id': requestId }], returnDocument: 'after' })
      } catch (error) {
        console.error('[copy-tasks] Требуется завершение операции', error)
        throw new TaskCopyError('Задания уже добавлены. Не удалось завершить историю или маршруты; повторите этот же запрос, дубликатов не будет.', 503)
      }
    }
    return response({ targetGameId: String(targetId), count: receipt.count })
  } catch (error) { return fail(error) }
}
