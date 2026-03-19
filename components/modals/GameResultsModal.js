import { memo, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import { getNounBonus } from '@helpers/getNoun'

const formatIsoDateTime = (value) => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

const formatSecondsWithSign = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return '00:00:00'
  }

  const sign = numeric > 0 ? '+' : numeric < 0 ? '-' : ''
  const absolute = Math.abs(Math.round(numeric))
  const hours = Math.floor(absolute / 3600)
  const minutes = Math.floor((absolute % 3600) / 60)
  const seconds = absolute % 60

  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const formatSecondsShort = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  const absolute = Math.round(Math.abs(numeric))
  const hours = Math.floor(absolute / 3600)
  const minutes = Math.floor((absolute % 3600) / 60)
  const seconds = absolute % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getAdjustmentBadgeClass = (type) =>
  type === 'bonus'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
    : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200'

const renderTaskTitle = ({ title, fallback = '—', isBonusTask = false }) => (
  <span className="inline-flex items-center gap-1.5">
    <span aria-hidden="true">🎯</span>
    {isBonusTask && (
      <span className="inline-flex items-center rounded-md border border-violet-300 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200">
        Бонусное
      </span>
    )}
    <span>{title || fallback}</span>
  </span>
)

const GameResultsModal = ({
  isResultsModalOpen,
  handleCloseResultsModal,
  resultsModalState,
}) => {
  const computed =
    resultsModalState?.computed && typeof resultsModalState.computed === 'object'
      ? resultsModalState.computed
      : null
  const computedTeams = Array.isArray(computed?.teams) ? computed.teams : []
  const rows = Array.isArray(resultsModalState?.rows) ? resultsModalState.rows : []
  const taskBoards = Array.isArray(computed?.taskBoards) ? computed.taskBoards : []
  const interactiveResultsUrl =
    typeof resultsModalState?.interactiveResultsUrl === 'string' &&
    resultsModalState.interactiveResultsUrl.trim().length > 0
      ? resultsModalState.interactiveResultsUrl.trim()
      : null
  const bonusTasksCount = taskBoards.filter((board) => Boolean(board?.isBonusTask)).length
  const totalTasksCount = Number(computed?.summary?.tasksCount) || 0
  const totalGameDurationLabel =
    typeof computed?.summary?.gameDurationDisplay === 'string' &&
    computed.summary.gameDurationDisplay.trim().length > 0
      ? computed.summary.gameDurationDisplay
      : '—'
  const regularTasksCount = Math.max(0, totalTasksCount - bonusTasksCount)
  const tasksSummaryLabel = bonusTasksCount > 0
    ? `${regularTasksCount} + ${getNounBonus(bonusTasksCount)}`
    : `${totalTasksCount}`
  const highlights =
    computed?.highlights && typeof computed.highlights === 'object'
      ? computed.highlights
      : null

  const rankingRows =
    computedTeams.length > 0
      ? computedTeams.map((team) => ({
          teamId: team.teamId,
          teamName: team.teamName,
          place: team.place,
          baseDisplay: team.baseDisplay,
          finalDisplay: team.finalDisplay,
        }))
      : rows.map((row) => ({
          teamId: row.teamId,
          teamName: row.teamName,
          place: row.place,
          baseDisplay: null,
          finalDisplay: null,
        }))

  const teamsWithAdjustments =
    computedTeams.length > 0
      ? computedTeams.filter((team) => Array.isArray(team?.addings) && team.addings.length > 0)
      : []
  const [expandedTaskBoards, setExpandedTaskBoards] = useState({})
  const [expandedAdjustmentTeams, setExpandedAdjustmentTeams] = useState({})

  useEffect(() => {
    setExpandedTaskBoards({})
    setExpandedAdjustmentTeams({})
  }, [isResultsModalOpen, resultsModalState?.gameId, taskBoards.length])

  const areAllTaskBoardsExpanded = useMemo(() => {
    if (taskBoards.length === 0) {
      return false
    }

    return taskBoards.every((board) => expandedTaskBoards[String(board.taskIndex)])
  }, [expandedTaskBoards, taskBoards])

  const handleToggleTaskBoard = (taskIndex) => {
    const key = String(taskIndex)
    setExpandedTaskBoards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleToggleAllTaskBoards = () => {
    if (areAllTaskBoardsExpanded) {
      setExpandedTaskBoards({})
      return
    }

    const nextExpandedState = taskBoards.reduce((acc, board) => {
      acc[String(board.taskIndex)] = true
      return acc
    }, {})
    setExpandedTaskBoards(nextExpandedState)
  }

  const handleToggleAdjustmentTeam = (teamKey) => {
    const key = String(teamKey)
    setExpandedAdjustmentTeams((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const areAllAdjustmentTeamsExpanded = useMemo(() => {
    if (teamsWithAdjustments.length === 0) {
      return false
    }

    return teamsWithAdjustments.every((team) =>
      expandedAdjustmentTeams[String(team.teamId || team.teamName)]
    )
  }, [expandedAdjustmentTeams, teamsWithAdjustments])

  const handleToggleAllAdjustmentTeams = () => {
    if (areAllAdjustmentTeamsExpanded) {
      setExpandedAdjustmentTeams({})
      return
    }

    const nextExpandedState = teamsWithAdjustments.reduce((acc, team) => {
      acc[String(team.teamId || team.teamName)] = true
      return acc
    }, {})
    setExpandedAdjustmentTeams(nextExpandedState)
  }

  return (
    <Modal
      isOpen={isResultsModalOpen}
      title={`Результаты — ${resultsModalState?.gameName || 'Игра'}`}
      onClose={handleCloseResultsModal}
      compactMobile
    >
      <div className="space-y-5">
        {resultsModalState?.isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-300">Загружаем результаты игры…</p>
        )}

        {!resultsModalState?.isLoading && resultsModalState?.error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {resultsModalState.error}
          </p>
        )}

        {!resultsModalState?.isLoading && !resultsModalState?.error && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h4 className="aq-modal-section-title text-base font-semibold">Сводка</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Команд</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {resultsModalState?.teamsCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Участников</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {resultsModalState?.participantsCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Заданий</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {tasksSummaryLabel}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Сформировано</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatIsoDateTime(computed?.generatedAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Общее время игры</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {totalGameDurationLabel}
                  </p>
                </div>
              </div>
              {interactiveResultsUrl && (
                <div className="mt-4">
                  <a
                    href={interactiveResultsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                  >
                    Открыть интерактивную таблицу результатов
                  </a>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h4 className="aq-modal-section-title text-base font-semibold">Турнирная таблица</h4>
              {rankingRows.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-200">Место</th>
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-200">Команда</th>
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-200">База</th>
                        <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-200">Итог</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingRows.map((row) => (
                        <tr key={row.teamId || row.teamName} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {Number.isFinite(Number(row.place)) ? row.place : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.teamName}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.baseDisplay || '—'}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.finalDisplay || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Для этой игры пока нет сформированных результатов.
                </p>
              )}
            </section>

            {highlights && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <h4 className="aq-modal-section-title text-base font-semibold">Ключевые показатели</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/35 dark:bg-emerald-500/10">
                    <p className="text-xs text-emerald-700 dark:text-emerald-200">Самое лёгкое задание</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {renderTaskTitle({ title: highlights?.easiestTask?.taskTitle })}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {highlights?.easiestTask?.averageDisplay || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/35 dark:bg-rose-500/10">
                    <p className="text-xs text-rose-700 dark:text-rose-200">Самое сложное задание</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {renderTaskTitle({ title: highlights?.hardestTask?.taskTitle })}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {highlights?.hardestTask?.averageDisplay || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-500/35 dark:bg-cyan-500/10">
                    <p className="text-xs text-cyan-700 dark:text-cyan-200">Самое быстрое выполнение</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {renderTaskTitle({ title: highlights?.fastestCompletion?.taskTitle })}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {highlights?.fastestCompletion?.teamName || '—'} · {highlights?.fastestCompletion?.display || '—'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {taskBoards.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="aq-modal-section-title text-base font-semibold">Время команд по заданиям</h4>
                  <button
                    type="button"
                    onClick={handleToggleAllTaskBoards}
                    className="rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                  >
                    {areAllTaskBoardsExpanded ? 'Свернуть все' : 'Развернуть все'}
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  {taskBoards.map((board) => (
                    <article
                      key={`${board.taskIndex}-${board.title}`}
                      className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      {(() => {
                        const isExpanded = Boolean(expandedTaskBoards[String(board.taskIndex)])

                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleTaskBoard(board.taskIndex)}
                              className="absolute right-2 top-2 rounded-md border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                              aria-label={isExpanded ? 'Свернуть задание' : 'Развернуть задание'}
                              title={isExpanded ? 'Свернуть' : 'Развернуть'}
                            >
                              {isExpanded ? '▴' : '▾'}
                            </button>
                            <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
                              <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {renderTaskTitle(
                                  {
                                    title: `${board.canceled ? '(Отменено) ' : ''}${board.title || `Задание #${board.taskIndex + 1}`}`,
                                    isBonusTask: Boolean(board.isBonusTask),
                                  }
                                )}
                              </h5>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-slate-500 dark:text-slate-300">
                                  Среднее: {board.averageDisplay || '—'}
                                </span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <>
                                {Array.isArray(board.entries) && board.entries.length > 0 ? (
                                  <ul className="mt-2 grid gap-1">
                                    {board.entries.map((entry) => (
                                      <li
                                        key={`${board.taskIndex}-${entry.teamId}-${entry.teamName}`}
                                        className="flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-2 py-1.5 text-xs text-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                                      >
                                        <span className="inline-flex rounded-md bg-cyan-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200">
                                          {entry.display || '—'}
                                        </span>
                                        {(Number(entry.penaltySeconds) > 0 ||
                                          Number(entry.bonusSeconds) > 0) && (
                                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                            {Number(entry.penaltySeconds) > 0 && (
                                              <span className="text-rose-700 dark:text-rose-300">
                                                {formatSecondsShort(entry.penaltySeconds)}
                                              </span>
                                            )}
                                            {Number(entry.bonusSeconds) > 0 && (
                                              <span className="text-emerald-700 dark:text-emerald-300">
                                                {formatSecondsShort(entry.bonusSeconds)}
                                              </span>
                                            )}
                                          </span>
                                        )}
                                        <span className="font-medium">{entry.teamName}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Нет данных по командам.</p>
                                )}
                              </>
                            ) : null}
                          </>
                        )
                      })()}
                    </article>
                  ))}
                </div>
                {bonusTasksCount > 0 && (
                  <p className="mt-4 rounded-lg border border-violet-300 bg-violet-100/70 px-3 py-2 text-xs font-semibold text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200">
                    Бонусное задание - в таком задании потраченное на него время не учитывается! Учитываются только бонусы и штрафы
                  </p>
                )}
              </section>
            )}

            {teamsWithAdjustments.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="aq-modal-section-title text-base font-semibold">Дополнительные корректировки</h4>
                  <button
                    type="button"
                    onClick={handleToggleAllAdjustmentTeams}
                    className="rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                  >
                    {areAllAdjustmentTeamsExpanded ? 'Свернуть все' : 'Развернуть все'}
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  {teamsWithAdjustments.map((team) => (
                    <article
                      key={team.teamId || team.teamName}
                      className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      {(() => {
                        const teamKey = String(team.teamId || team.teamName)
                        const isExpanded = Boolean(expandedAdjustmentTeams[teamKey])
                        const totalAdjustmentsSeconds = Number(team.addingsSeconds) || 0
                        const totalAdjustmentsDisplay = formatSecondsWithSign(totalAdjustmentsSeconds)
                        const totalAdjustmentsClassName =
                          totalAdjustmentsSeconds > 0
                            ? 'text-rose-700 dark:text-rose-300'
                            : totalAdjustmentsSeconds < 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-600 dark:text-slate-300'

                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleAdjustmentTeam(teamKey)}
                              className="absolute right-2 top-2 rounded-md border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                              aria-label={isExpanded ? 'Свернуть корректировки команды' : 'Развернуть корректировки команды'}
                              title={isExpanded ? 'Свернуть' : 'Развернуть'}
                            >
                              {isExpanded ? '▴' : '▾'}
                            </button>
                            <div className="flex items-center justify-between gap-3 pr-10">
                              <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{team.teamName}</h5>
                              <span className={`font-mono text-xs font-semibold ${totalAdjustmentsClassName}`}>
                                {totalAdjustmentsDisplay}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ul className="mt-2 space-y-1.5">
                                {team.addings.map((item, index) => (
                                  <li
                                    key={`${team.teamId || team.teamName}-${index}`}
                                    className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${getAdjustmentBadgeClass(item.type)}`}
                                  >
                                    <span className="font-mono font-semibold">{item.display || '—'}</span>
                                    <span>{item.name || 'Корректировка'}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        )
                      })()}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

GameResultsModal.propTypes = {
  isResultsModalOpen: PropTypes.bool.isRequired,
  handleCloseResultsModal: PropTypes.func.isRequired,
  resultsModalState: PropTypes.shape({
    isLoading: PropTypes.bool.isRequired,
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
    gameId: PropTypes.string,
    gameName: PropTypes.string,
    rows: PropTypes.arrayOf(
      PropTypes.shape({
        teamId: PropTypes.string,
        teamName: PropTypes.string,
        place: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
      })
    ),
    teamsCount: PropTypes.number,
    participantsCount: PropTypes.number,
    computed: PropTypes.object,
    interactiveResultsUrl: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
  }).isRequired,
}

export default memo(GameResultsModal)
