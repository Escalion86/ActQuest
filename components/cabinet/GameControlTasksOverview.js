'use client'

import { useState } from 'react'
import PropTypes from 'prop-types'

const groups = [
  { key: 'pending', label: 'Ещё не дошли', color: 'text-slate-600 dark:text-slate-300' },
  { key: 'active', label: 'Выполняют сейчас', color: 'text-cyan-700 dark:text-cyan-300' },
  { key: 'completed', label: 'Выполнили', color: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'failed', label: 'Не выполнили', color: 'text-rose-700 dark:text-rose-300' },
  { key: 'excluded', label: 'Не предусмотрено маршрутом', color: 'text-slate-500 dark:text-slate-400' },
]

const formatRemaining = (seconds) => {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export default function GameControlTasksOverview({ tasks, onSelectTeam }) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase('ru')
  const visibleTasks = tasks.filter((task) =>
    `${task.taskIndex + 1} ${task.title}`.toLocaleLowerCase('ru').includes(query),
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Номера заданий — как в редакторе, независимо от порядка команд.
        Раскройте задание, чтобы увидеть команды; нажмите на команду для статистики.
        Время и состояния — на момент последнего обновления.
      </p>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        Найти задание
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Номер или название"
          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      {visibleTasks.length === 0 ? (
        <p className="py-6 text-center text-slate-600 dark:text-slate-400">
          {tasks.length ? 'Задания не найдены' : 'В игре пока нет заданий'}
        </p>
      ) : visibleTasks.map((task) => (
        <details key={task.taskIndex} className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
          <summary className="cursor-pointer rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-cyan-500">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Задание {task.taskIndex + 1} · {task.title}
            </span>
            {task.canceled ? (
              <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Отменено</span>
            ) : (
              <span className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {groups.filter(({ key }) => key !== 'excluded' || task.counts.excluded > 0).map(({ key, label, color }) => (
                  <span key={key} className={`text-sm ${color}`}>
                    {label}: <strong className="tabular-nums">{task.counts[key]}</strong>
                  </span>
                ))}
              </span>
            )}
          </summary>
          <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-700">
            {task.canceled ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Задание отменено и не учитывается в счётчиках прохождения.</p>
            ) : task.teams.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Нет зарегистрированных команд</p>
            ) : groups.map(({ key, label, color }) => {
              const members = task.teams.filter((team) => team.state === key)
              if (!members.length) return null
              return (
                <section key={key}>
                  <h3 className={`mb-2 text-sm font-semibold ${color}`}>{label} · {members.length}</h3>
                  <ul className="space-y-2">
                    {members.map((team) => (
                      <li key={team.teamId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
                        <button
                          type="button"
                          onClick={() => onSelectTeam(team.teamId)}
                          className="min-h-10 break-words text-left text-sm font-semibold text-cyan-700 underline decoration-cyan-500/40 underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:text-cyan-300"
                          aria-label={`Статистика команды ${team.teamName}`}
                        >
                          {team.teamName}
                        </button>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          {team.variantTitle ? <p>Вариант: {team.variantTitle}</p> : null}
                          {team.isChoosingVariant ? <p>Выбирают вариант задания</p> : null}
                          {key === 'active' && !team.isChoosingVariant ? (
                            <p>
                              {team.remainingSeconds !== null ? `Осталось ${formatRemaining(team.remainingSeconds)} · ` : ''}
                              Коды: {team.foundCodesCount}{team.requiredCodesCount !== null ? ` / ${team.requiredCodesCount}` : ''}
                            </p>
                          ) : null}
                          {team.failureReason ? <p>{team.failureReason}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </details>
      ))}
    </div>
  )
}

GameControlTasksOverview.propTypes = {
  tasks: PropTypes.arrayOf(PropTypes.shape({
    taskIndex: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    canceled: PropTypes.bool,
    counts: PropTypes.shape({
      pending: PropTypes.number.isRequired,
      active: PropTypes.number.isRequired,
      completed: PropTypes.number.isRequired,
      failed: PropTypes.number.isRequired,
      excluded: PropTypes.number.isRequired,
    }).isRequired,
    teams: PropTypes.arrayOf(PropTypes.shape({
      teamId: PropTypes.string.isRequired,
      teamName: PropTypes.string.isRequired,
      state: PropTypes.oneOf(groups.map(({ key }) => key)).isRequired,
      failureReason: PropTypes.string,
      remainingSeconds: PropTypes.number,
      foundCodesCount: PropTypes.number,
      requiredCodesCount: PropTypes.number,
      variantTitle: PropTypes.string,
      isChoosingVariant: PropTypes.bool,
    })).isRequired,
  })).isRequired,
  onSelectTeam: PropTypes.func.isRequired,
}
