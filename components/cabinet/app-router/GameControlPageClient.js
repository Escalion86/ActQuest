'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PropTypes from 'prop-types'

import requestApiJson from '@helpers/requestApiJson'
import CardActionIconButton, {
  TargetCardIcon,
} from '@components/cabinet/CardActionIconButton'
import GameTasksViewModal from '@components/modals/GameTasksViewModal'

const formatTime = (totalSeconds) => {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const AUTO_REFRESH_OPTIONS = [
  { value: 5000, label: '5 сек' },
  { value: 10000, label: '10 сек' },
  { value: 15000, label: '15 сек' },
  { value: 30000, label: '30 сек' },
]

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

const normalizeCodes = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)

const renderCodesBadges = (codes, tone = 'default') => {
  const normalized = normalizeCodes(codes)
  if (normalized.length === 0) {
    return <span className="text-xs text-slate-500">—</span>
  }

  const toneClass =
    tone === 'bonus'
      ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200'
      : tone === 'penalty'
        ? 'border-red-500/40 bg-red-500/12 text-red-200'
        : 'border-cyan-500/40 bg-cyan-500/12 text-cyan-200'

  return (
    <div className="flex flex-wrap gap-1.5">
      {normalized.map((code, index) => (
        <span
          key={`${code}-${index}`}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${toneClass}`}
        >
          {code}
        </span>
      ))}
    </div>
  )
}

export default function GameControlPageClient({ session }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [autoRefreshIntervalMs, setAutoRefreshIntervalMs] = useState(15000)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isTasksViewModalOpen, setIsTasksViewModalOpen] = useState(false)
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
      intervalRef.current = setInterval(fetchStatus, autoRefreshIntervalMs)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh, autoRefreshIntervalMs, gameId, fetchStatus])

  const gameForTasksModal = useMemo(
    () => ({
      id: String(data?.gameId || ''),
      name: String(data?.gameName || ''),
      type: String(data?.gameType || 'classic'),
      tasks: Array.isArray(data?.tasks) ? data.tasks : [],
    }),
    [data],
  )

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

  const { gameName, gameType, tasksCount, taskDuration, cluesDuration, teams } =
    data

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
          <select
            value={String(autoRefreshIntervalMs)}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (Number.isFinite(parsed) && parsed > 0) {
                setAutoRefreshIntervalMs(parsed)
              }
            }}
            disabled={!autoRefresh}
            className="aq-select-game-control h-8 min-w-[82px] rounded-lg border border-slate-600/70 bg-slate-800/70 pl-2.5 text-xs text-slate-200 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Интервал автообновления"
          >
            {AUTO_REFRESH_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
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
                <CardActionIconButton
                  onClick={() => setIsTasksViewModalOpen(true)}
                  label="Открыть просмотр заданий игры"
                  title="Просмотр заданий игры"
                  className="h-8 w-8"
                >
                  <TargetCardIcon />
                </CardActionIconButton>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Задание: </span>
                  <span className="font-medium text-slate-200">
                    {team.isTeamFinished
                      ? 'Завершено'
                      : `${team.activeTaskIndex + 1}. ${team.currentTaskTitle || 'Без названия'}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Найденные коды: </span>
                  <span className="font-medium text-green-400">
                    {team.findedCodesCount}
                  </span>
                  {team.wrongCodesCount > 0 && (
                    <span className="ml-1 text-red-400">
                      ({team.wrongCodesCount} неверн.)
                    </span>
                  )}
                  <div className="mt-1">
                    {renderCodesBadges(team.findedCodes)}
                  </div>
                </div>
                {team.bonusCodesCount > 0 && (
                  <div>
                    <span className="text-slate-500">Бонусные коды: </span>
                    <span className="font-medium text-emerald-400">
                      {team.bonusCodesCount}
                    </span>
                    <div className="mt-1">
                      {renderCodesBadges(team.bonusCodes, 'bonus')}
                    </div>
                  </div>
                )}
                {team.penaltyCodesCount > 0 && (
                  <div>
                    <span className="text-slate-500">Штрафные коды: </span>
                    <span className="font-medium text-red-400">
                      {team.penaltyCodesCount}
                    </span>
                    <div className="mt-1">
                      {renderCodesBadges(team.penaltyCodes, 'penalty')}
                    </div>
                  </div>
                )}
                {!team.isTeamFinished &&
                  !(
                    team.isTeamOnBreak &&
                    team.isBreakFinishedWaitingForNextTask
                  ) && (
                  <div>
                    <span className="text-slate-500">
                      {team.isTeamOnBreak ? 'Перерыв: ' : 'На задании: '}
                    </span>
                    <span
                      className={`font-mono font-medium ${
                        team.isTeamOnBreak ? 'text-yellow-300' : 'text-cyan-300'
                      }`}
                    >
                      {formatTime(
                        team.isTeamOnBreak
                          ? team.breakTimeLeftSeconds
                          : team.currentTaskSeconds,
                      )}
                    </span>
                  </div>
                )}
                {!team.isTeamFinished &&
                  !team.isTeamOnBreak &&
                  !team.isActiveTaskFailed && (
                    <>
                      {Number(cluesDuration) > 0 && (
                        <div>
                          <span className="text-slate-500">До подсказки: </span>
                          <span className="font-mono font-medium text-violet-300">
                            {(() => {
                              const elapsed = Math.max(
                                0,
                                Math.floor(team.currentTaskSeconds || 0),
                              )
                              const clueInterval = Math.max(
                                1,
                                Math.floor(cluesDuration),
                              )
                              const mod = elapsed % clueInterval
                              const remaining = mod === 0 ? clueInterval : clueInterval - mod
                              return formatTime(remaining)
                            })()}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">
                          До провала задания:{' '}
                        </span>
                        <span className="font-mono font-medium text-rose-300">
                          {formatTime(
                            Math.max(
                              0,
                              Math.floor(taskDuration || 0) -
                                Math.floor(team.currentTaskSeconds || 0),
                            ),
                          )}
                        </span>
                      </div>
                    </>
                  )}
                {team.isTeamOnBreak && team.completedTaskSeconds > 0 && (
                  <div>
                    <span className="text-slate-500">
                      Предыдущее задание завершено за:{' '}
                    </span>
                    <span className="font-mono font-medium text-emerald-300">
                      {formatTime(team.completedTaskSeconds)}
                    </span>
                  </div>
                )}
                {team.isBreakFinishedWaitingForNextTask && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200">
                    Перерыв окончен, но следующее задание еще не начато.
                  </div>
                )}
              </div>

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

      <GameTasksViewModal
        isTasksViewModalOpen={isTasksViewModalOpen}
        handleCloseTasksViewModal={() => setIsTasksViewModalOpen(false)}
        selectedGame={gameForTasksModal}
        canViewCodePhotos
        showAllTaskDetails
      />
    </div>
  )
}

GameControlPageClient.propTypes = {
  session: PropTypes.shape({
    user: PropTypes.object.isRequired,
  }).isRequired,
}
