'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsRotate,
  faMoon,
  faSun,
} from '@fortawesome/free-solid-svg-icons'
import { useRouter, useSearchParams } from 'next/navigation'

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
    'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600/50 dark:bg-slate-700/50 dark:text-slate-300',
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

const formatTime = (totalSeconds) => {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const getAssignedTaskLabel = (task) => {
  if (Number.isInteger(task?.taskIndex)) {
    return `${task.taskIndex + 1}. ${task.title || 'Без названия'}`
  }
  return task?.title || task?.storyNodeId || 'Без названия'
}

const getTask2gisUrl = (task) => {
  const latitude = Number(task?.coordinates?.latitude)
  const longitude = Number(task?.coordinates?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }

  return `dgis://2gis.ru/geo/${encodeURIComponent(`${longitude},${latitude}`)}`
}

const TwoGisIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M10 17C13.2 13.4 15.2 10.65 15.2 8.2C15.2 5.12 12.87 2.8 10 2.8C7.13 2.8 4.8 5.12 4.8 8.2C4.8 10.65 6.8 13.4 10 17Z"
      fill="currentColor"
    />
    <circle cx="10" cy="8.1" r="2.05" fill="white" />
  </svg>
)

const AgentGameControlPageClient = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameId = searchParams?.get('gameId') || ''
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [themeMode, setThemeMode] = useState('dark')

  const isLightTheme = themeMode === 'light'

  const loadStatus = useCallback(async () => {
    if (!gameId) {
      setIsLoading(false)
      setError('Не указан идентификатор игры')
      return
    }

    try {
      const { json } = await requestApiJson(
        `/api/cabinet/agent/game-status?gameId=${encodeURIComponent(gameId)}`,
        { fallbackMessage: 'Не удалось загрузить статус игры' },
      )
      setData(json?.data || null)
      setError('')
      setLastUpdated(new Date())
    } catch (loadError) {
      setError(loadError?.message || 'Не удалось загрузить статус игры')
    } finally {
      setIsLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    setIsLoading(true)
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!autoRefresh || !gameId) return undefined
    const timerId = window.setInterval(() => {
      loadStatus()
    }, 10000)
    return () => {
      window.clearInterval(timerId)
    }
  }, [autoRefresh, gameId, loadStatus])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedTheme =
      window.localStorage.getItem('cabinet-theme') ||
      window.localStorage.getItem('aq-theme')
    const htmlTheme = document.documentElement.getAttribute('data-theme')
    const resolvedTheme =
      storedTheme === 'dark' || storedTheme === 'light'
        ? storedTheme
        : htmlTheme === 'dark' || htmlTheme === 'light'
          ? htmlTheme
          : document.documentElement.classList.contains('dark')
            ? 'dark'
            : 'light'
    setThemeMode(resolvedTheme)
  }, [])

  const toggleThemeMode = useCallback(() => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark'
    setThemeMode(nextTheme)
    const rootElement = document.documentElement
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cabinet-theme', nextTheme)
        window.localStorage.setItem('aq-theme', nextTheme)
      } catch {
        // localStorage может быть недоступен.
      }
    }
    rootElement.setAttribute('data-theme', nextTheme)
    rootElement.classList.toggle('dark', nextTheme === 'dark')
  }, [themeMode])

  const teams = Array.isArray(data?.teams) ? data.teams : []
  const activeTeams = useMemo(
    () => teams.filter((team) => team.status === 'active'),
    [teams],
  )
  const approachingTeams = useMemo(
    () => teams.filter((team) => team.status === 'approaching'),
    [teams],
  )
  const gameElapsedSeconds = useMemo(() => {
    const startMs = data?.dateStartFact
      ? new Date(data.dateStartFact).getTime()
      : NaN
    if (!Number.isFinite(startMs)) return null
    return Math.max(Math.floor((nowTs - startMs) / 1000), 0)
  }, [data?.dateStartFact, nowTs])
  const lightThemeOverrides = isLightTheme ? 'text-slate-900' : 'text-slate-100'

  return (
    <div
      className={`mx-auto max-w-4xl px-4 py-6 transition-colors ${lightThemeOverrides}`}
    >
      <div className="flex flex-col items-start justify-between gap-3 mb-6">
        <div className="w-full">
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => router.push('/cabinet/agent')}
              className="text-sm transition text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← К списку игр
            </button>
            <div className="flex items-center justify-end flex-1 gap-3">
              <button
                type="button"
                onClick={toggleThemeMode}
                className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full border-cyan-400 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
                aria-label={
                  themeMode === 'dark'
                    ? 'Включить светлую тему'
                    : 'Включить тёмную тему'
                }
                title={themeMode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              >
                <FontAwesomeIcon
                  icon={themeMode === 'dark' ? faSun : faMoon}
                  className="w-4 h-4"
                />
              </button>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
            {data?.gameName || 'Контроль агента'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Упрощенный статус команд по назначенным агентским заданиям.
          </p>
        </div>
        <div className="flex items-center justify-end w-full gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 dark:text-slate-400">
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
            onClick={() => loadStatus()}
            className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full border-cyan-400 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
            aria-label="Обновить"
            title="Обновить"
          >
            <FontAwesomeIcon icon={faArrowsRotate} className="w-4 h-4" />
          </button>
        </div>
      </div>
      {(lastUpdated || gameElapsedSeconds !== null) && (
        <div className="flex flex-wrap items-center mb-4 text-xs gap-x-5 gap-y-1 text-slate-600 dark:text-slate-500">
          <span>
            Время игры:{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {gameElapsedSeconds !== null
                ? formatTime(gameElapsedSeconds)
                : '—'}
            </span>
          </span>
          {lastUpdated && (
            <span>
              Обновлено:{' '}
              {lastUpdated.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
        </div>
      )}
      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-300">
            Загружаем статус...
          </div>
        ) : null}
        {error ? (
          <div className="p-4 text-sm border rounded-xl border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}
        {data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700/50 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Сейчас у агента
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {activeTeams.length}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-900/10">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Скоро прибудут
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-yellow-400">
                  {approachingTeams.length}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-500/30 dark:bg-cyan-900/10">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Осталось команд
                </p>
                <p className="mt-2 text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {data.remainingTeamsCount || 0}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700/50 dark:bg-slate-800/60">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Назначенные задания
              </h3>
              <div className="flex flex-col items-start gap-2 mt-3">
                {Array.isArray(data.assignedTasks) &&
                data.assignedTasks.length > 0 ? (
                  data.assignedTasks.map((task) => (
                    <span
                      key={task.storyNodeId || task.taskIndex}
                      className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold border rounded-full border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-100"
                    >
                      <span>{getAssignedTaskLabel(task)}</span>
                      {getTask2gisUrl(task) ? (
                        <a
                          href={getTask2gisUrl(task)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#19a949] text-white transition hover:scale-105 hover:bg-[#14873a]"
                          title="Открыть в 2ГИС"
                          aria-label="Открыть задание в 2ГИС"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <TwoGisIcon />
                        </a>
                      ) : null}
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
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700/50 dark:bg-slate-800/50"
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
                  {team.isTeamOnBreak ? (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                      Команда находится на перерыве.
                    </p>
                  ) : null}
                  {team.isTeamOnBreak && team.breakTimeLeftSeconds > 0 ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      До конца перерыва: {formatTime(team.breakTimeLeftSeconds)}
                    </p>
                  ) : null}
                  {!team.isTeamOnBreak && team.currentTaskSeconds > 0 ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      На текущем задании:{' '}
                      {formatSeconds(team.currentTaskSeconds)}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default AgentGameControlPageClient
