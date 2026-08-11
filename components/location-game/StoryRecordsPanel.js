'use client'

import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'

import requestApiJson from '@helpers/requestApiJson'

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return '—'
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainingSeconds = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

const RecordList = ({ title, entries, value }) => (
  <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
    <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
    {entries.length > 0 ? (
      <ol className="mt-3 space-y-2">
        {entries.map((entry) => (
          <li
            key={`${entry.teamId}-${entry.rank}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/70"
          >
            <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
              <span className="mr-2 font-semibold text-cyan-700 dark:text-cyan-300">
                {entry.rank}.
              </span>
              {entry.teamName}
            </span>
            <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
              {value(entry)}
            </span>
          </li>
        ))}
      </ol>
    ) : (
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Завершённых прохождений пока нет.
      </p>
    )}
  </section>
)

RecordList.propTypes = {
  title: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      teamId: PropTypes.string,
      teamName: PropTypes.string.isRequired,
      rank: PropTypes.number.isRequired,
    }),
  ).isRequired,
  value: PropTypes.func.isRequired,
}

const StoryRecordsPanel = ({ gameId, enabled }) => {
  const recordsQuery = useQuery({
    queryKey: ['story-records', gameId],
    enabled: Boolean(enabled && gameId),
    queryFn: async () => {
      const { json } = await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(gameId)}/records`,
        { fallbackMessage: 'Не удалось загрузить статистику рекордов' },
      )
      return json?.data || null
    },
    staleTime: 30000,
  })

  if (!enabled) return null

  const data = recordsQuery.data
  if (recordsQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
        Загружаем статистику рекордов…
      </div>
    )
  }
  if (recordsQuery.isError || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        Не удалось загрузить статистику рекордов.
      </div>
    )
  }

  const summary = data.summary || {}
  const records = data.records || {}
  return (
    <section className="space-y-4 rounded-3xl border border-cyan-200 bg-cyan-50/40 p-5 dark:border-cyan-500/30 dark:bg-cyan-500/5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Рекорды прохождения
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Статистика обновляется по мере завершения story-квеста командами.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Начали', summary.startedCount ?? 0],
          ['Завершили', summary.finishedCount ?? 0],
          ['Успешно', summary.completedCount ?? 0],
          ['Успешность', `${summary.completionRate ?? 0}%`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl bg-white p-3 dark:bg-slate-900/70"
          >
            <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">
              {label}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 lg:grid-cols-3">
        <RecordList
          title="Лучший результат"
          entries={records.bestScore || []}
          value={(entry) => `${entry.score} баллов`}
        />
        <RecordList
          title="Самое быстрое прохождение"
          entries={records.fastestCompletion || []}
          value={(entry) => formatDuration(entry.durationSeconds)}
        />
        <RecordList
          title="Без лишних подсказок"
          entries={records.leastClues || []}
          value={(entry) => `${entry.usedCluesCount} подсказок`}
        />
      </div>
    </section>
  )
}

StoryRecordsPanel.propTypes = {
  gameId: PropTypes.string.isRequired,
  enabled: PropTypes.bool.isRequired,
}

export default StoryRecordsPanel
