'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import requestApiJson from '@helpers/requestApiJson'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'

const statusLabels = {
  active: 'Активна',
  started: 'В процессе',
  finished: 'Завершена',
  closed: 'Закрыта',
  canceled: 'Отменена',
}

const AgentGamesPageClient = () => {
  const [games, setGames] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadGames = async () => {
      setIsLoading(true)
      setError('')
      try {
        const { json } = await requestApiJson('/api/cabinet/agent/games', {
          fallbackMessage: 'Не удалось загрузить игры агента',
        })
        if (!cancelled) {
          setGames(Array.isArray(json?.data) ? json.data : [])
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || 'Не удалось загрузить игры агента')
          setGames([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadGames()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <CabinetLayout
      title="Агент"
      description="Игры и задания, назначенные вам как агенту."
      activePage="agent"
      headerTitle="Агент"
      showPageTitle
    >
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          Загружаем игры...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}
      {!isLoading && !error && games.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          Назначенных игр пока нет.
        </div>
      ) : null}
      <div className="grid gap-3">
        {games.map((game) => (
          <Link
            key={game.id}
            href={`/cabinet/agent/game-control?gameId=${encodeURIComponent(
              game.id,
            )}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-400 hover:bg-cyan-50/60 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {game.name || 'Без названия'}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {statusLabels[game.status] || game.status || '—'} · Команд:{' '}
                  {game.teamsCount || 0}
                </p>
                {game.dateStart ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateInLocationTimeZone(
                      game.dateStart,
                      game.location,
                      {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      },
                    )}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-100">
                Заданий: {Array.isArray(game.assignedTasks) ? game.assignedTasks.length : 0}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </CabinetLayout>
  )
}

export default AgentGamesPageClient
