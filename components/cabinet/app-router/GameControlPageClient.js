'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PropTypes from 'prop-types'

import requestApiJson from '@helpers/requestApiJson'

const formatTime = (totalSeconds) => {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const AUTO_REFRESH_INTERVAL = 15000

const teamStatusLabel = (team) => {
  if (team.isTeamFinished) return 'Финиш'
  if (team.isTeamOnBreak) return 'Перерыв'
  if (team.isActiveTaskFailed) return 'Время вышло'
  return 'В игре'
}

const teamStatusColor = (team) => {
  if (team.isTeamFinished) {
    return 'border-green-500/50 bg-green-900/20 dark:border-green-400/40 dark:bg-green-900/30'
  }
  if (team.isTeamOnBreak) {
    return 'border-yellow-500/50 bg-yellow-900/20 dark:border-yellow-400/40 dark:bg-yellow-900/30'
  }
  if (team.isActiveTaskFailed) {
    return 'border-red-500/50 bg-red-900/20 dark:border-red-400/40 dark:bg-red-900/30'
  }
  return 'border-cyan-500/30 bg-slate-800/40 dark:border-cyan-400/25 dark:bg-slate-800/50'
}

const statusDotColor = (team) => {
  if (team.isTeamFinished) return 'bg-green-400'
  if (team.isTeamOnBreak) return 'bg-yellow-400 animate-pulse'
  if (team.isActiveTaskFailed) return 'bg-red-400'
  return 'bg-cyan-400 animate-pulse'
}

export default function GameControlPageClient({ session }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const intervalRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    if (!gameId) return

    try {
      const { json } = await requestApiJson(
        `/api/cabinet/admin/game-status?gameId=${encodeURIComponent(gameId)}`,
      )

      if (json?.success && json?.data) {
        setData(json.data)
        setError(null)
        setLastUpdated(new Date())
      } else {
        setError(json?.error ?? 'Не удалось загрузить данные')
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (autoRefresh && gameId) {
      intervalRef.current = setInterval(fetchStatus, AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh, gameId, fetchStatus])

  if (!gameId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Не указан ID игры</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-6 text-center">
          <p className="mb-4 text-red-300">{error}</p>
          <button
            type="button"
            onClick={fetchStatus}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Повторить
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-sm text-slate-400 transition hover:text-slate-200"
        >
          ← Назад
        </button>
      </div>
    )
  }

  if (!data) return null

  const { gameName, gameType, tasksCount, taskDuration, teams } = data

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Шапка */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-2 text-sm text-slate-400 transition hover:text-slate-200"
          >
            ← Назад к играм
          </button>
          <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">
            {gameName}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {gameType === 'photo' ? 'Фотоквест' : 'Классический квест'}
            {' · '}
            {tasksCount}{' '}
            {tasksCount === 1
              ? 'задание'
              : tasksCount < 5
                ? 'задания'
                : 'заданий'}
            {' · '}
            {Math.floor(taskDuration / 60)} мин на задание
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
            />
            Авто
          </label>
          <button
            type="button"
            onClick={fetchStatus}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Обновить
          </button>
        </div>
      </div>

      {lastUpdated && (
        <p className="mb-4 text-xs text-slate-500">
          Обновлено:{' '}
          {lastUpdated.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>
      )}

      {/* Сводка */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3 text-center">
          <div className="text-2xl font-bold text-slate-100">
            {teams.length}
          </div>
          <div className="text-xs text-slate-400">Команд</div>
        </div>
        <div className="rounded-xl border border-green-500/30 bg-green-900/10 p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {teams.filter((t) => t.isTeamFinished).length}
          </div>
          <div className="text-xs text-slate-400">Финишировали</div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-900/10 p-3 text-center">
          <div className="text-2xl font-bold text-cyan-400">
            {
              teams.filter(
                (t) =>
                  !t.isTeamFinished &&
                  !t.isTeamOnBreak &&
                  !t.isActiveTaskFailed,
              ).length
            }
          </div>
          <div className="text-xs text-slate-400">В игре</div>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-900/10 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {teams.filter((t) => t.isTeamOnBreak).length}
          </div>
          <div className="text-xs text-slate-400">На перерыве</div>
        </div>
      </div>

      {/* Команды */}
      {teams.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-8 text-center">
          <p className="text-slate-400">Нет зарегистрированных команд</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team, index) => (
            <div
              key={team.teamId}
              className={`rounded-xl border p-4 transition ${teamStatusColor(team)}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">
                    #{index + 1}
                  </span>
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotColor(team)}`}
                  />
                  <h3 className="font-semibold text-slate-100">
                    {team.teamName}
                  </h3>
                </div>
                <span className="rounded-full border border-slate-600/50 bg-slate-700/50 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                  {teamStatusLabel(team)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-slate-500">Задание: </span>
                  <span className="font-medium text-slate-200">
                    {team.isTeamFinished
                      ? `${tasksCount}/${tasksCount}`
                      : `${team.activeTaskIndex + 1}/${tasksCount}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Коды: </span>
                  <span className="font-medium text-green-400">
                    {team.findedCodesCount}
                  </span>
                  {team.wrongCodesCount > 0 && (
                    <span className="ml-1 text-red-400">
                      ({team.wrongCodesCount} неверн.)
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Время: </span>
                  <span className="font-mono font-medium text-slate-200">
                    {formatTime(team.sumTimeSeconds)}
                  </span>
                </div>
                {!team.isTeamFinished &&
                  !team.isTeamOnBreak &&
                  !team.isActiveTaskFailed && (
                    <div>
                      <span className="text-slate-500">На задании: </span>
                      <span className="font-mono font-medium text-cyan-300">
                        {formatTime(team.currentTaskSeconds)}
                      </span>
                    </div>
                  )}
                {team.isTeamOnBreak && team.breakTimeLeftSeconds > 0 && (
                  <div>
                    <span className="text-slate-500">Перерыв: </span>
                    <span className="font-mono font-medium text-yellow-300">
                      {formatTime(team.breakTimeLeftSeconds)}
                    </span>
                  </div>
                )}
              </div>

              {/* Бонусы/штрафы */}
              {(team.bonusCodesCount > 0 || team.penaltyCodesCount > 0) && (
                <div className="mt-2 flex gap-3 text-xs">
                  {team.bonusCodesCount > 0 && (
                    <span className="text-emerald-400">
                      +{team.bonusCodesCount} бонус
                    </span>
                  )}
                  {team.penaltyCodesCount > 0 && (
                    <span className="text-red-400">
                      {team.penaltyCodesCount} штраф
                    </span>
                  )}
                </div>
              )}

              {/* Подсказки */}
              {team.cluesReceived > 0 && (
                <div className="mt-1 text-xs text-slate-500">
                  Подсказок получено: {team.cluesReceived}
                </div>
              )}

              {/* Фото (для photo-квестов) */}
              {gameType === 'photo' && team.currentPhotosCount > 0 && (
                <div className="mt-1 text-xs text-slate-500">
                  Фото отправлено: {team.currentPhotosCount}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

GameControlPageClient.propTypes = {
  session: PropTypes.shape({
    user: PropTypes.object.isRequired,
  }).isRequired,
}
