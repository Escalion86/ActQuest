'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import requestApiJson from '@helpers/requestApiJson'

const statusLabels = {
  active: 'На вашем задании',
  approaching: 'Скоро прибудет',
  waiting: 'Еще не дошли',
  passed: 'Прошли',
  finished: 'Финишировали',
}

const statusClasses = {
  active:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100',
  approaching:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
  waiting:
    'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200',
  passed:
    'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-100',
  finished:
    'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-100',
}

const formatSeconds = (value) => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

const getAssignedTaskLabel = (task) => {
  if (Number.isInteger(task?.taskIndex)) {
    return `${task.taskIndex + 1}. ${task.title || 'Без названия'}`
  }
  return task?.title || task?.storyNodeId || 'Без названия'
}

const AgentGameControlPageClient = () => {
  const searchParams = useSearchParams()
  const gameId = searchParams?.get('gameId') || ''
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId) {
      setIsLoading(false)
      setError('Не указан идентификатор игры')
      return undefined
    }

    let cancelled = false
    let timerId = null

    const loadStatus = async () => {
      try {
        const { json } = await requestApiJson(
          `/api/cabinet/agent/game-status?gameId=${encodeURIComponent(gameId)}`,
          { fallbackMessage: 'Не удалось загрузить статус игры' },
        )
        if (!cancelled) {
          setData(json?.data || null)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || 'Не удалось загрузить статус игры')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadStatus()
    timerId = window.setInterval(loadStatus, 10000)

    return () => {
      cancelled = true
      if (timerId) {
        window.clearInterval(timerId)
      }
    }
  }, [gameId])

  const teams = Array.isArray(data?.teams) ? data.teams : []
  const activeTeams = useMemo(
    () => teams.filter((team) => team.status === 'active'),
    [teams],
  )
  const approachingTeams = useMemo(
    () => teams.filter((team) => team.status === 'approaching'),
    [teams],
  )

  return (
    <CabinetLayout
      title={data?.gameName || 'Контроль агента'}
      description="Упрощенный статус команд по назначенным агентским заданиям."
      activePage="agent"
      headerTitle="Контроль агента"
      showPageTitle
    >
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          Загружаем статус...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Сейчас у агента
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {activeTeams.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Скоро прибудут
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {approachingTeams.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Осталось команд
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {data.remainingTeamsCount || 0}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Назначенные задания
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.isArray(data.assignedTasks) &&
              data.assignedTasks.length > 0 ? (
                data.assignedTasks.map((task) => (
                  <span
                    key={task.storyNodeId || task.taskIndex}
                    className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-100"
                  >
                    {getAssignedTaskLabel(task)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">
                  Задания не назначены.
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3">
            {teams.map((team) => (
              <article
                key={team.gameTeamId || team.teamId}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {team.teamName || 'Команда'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Текущее: {team.currentTaskTitle || 'не определено'}
                    </p>
                    {team.agentTaskTitle ? (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Агентское:{' '}
                        {Number.isInteger(team.agentTaskIndex)
                          ? `${team.agentTaskIndex + 1} · `
                          : ''}
                        {team.agentTaskTitle}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      statusClasses[team.status] || statusClasses.waiting
                    }`}
                  >
                    {statusLabels[team.status] || team.status}
                  </span>
                </div>
                {team.currentTaskSeconds > 0 ? (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    На текущем задании: {formatSeconds(team.currentTaskSeconds)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </CabinetLayout>
  )
}

export default AgentGameControlPageClient
