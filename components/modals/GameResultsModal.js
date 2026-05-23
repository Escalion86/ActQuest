import { memo, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import { getNounBonus } from '@helpers/getNoun'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'

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

const formatDurationSeconds = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }
  const absolute = Math.max(0, Math.round(Math.abs(numeric)))
  const hours = Math.floor(absolute / 3600)
  const minutes = Math.floor((absolute % 3600) / 60)
  const seconds = absolute % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getAdjustmentBadgeClass = (type) =>
  type === 'bonus'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
    : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200'

const UNFINISHED_TASK_STATUSES = new Set([
  'not_started',
  'in_progress',
  'stopped',
])

const getTaskEntrySeconds = (entry) => {
  const value = entry?.seconds
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

const isUnfinishedTaskEntry = (entry) => {
  const status = typeof entry?.status === 'string' ? entry.status.trim() : ''
  if (UNFINISHED_TASK_STATUSES.has(status)) {
    return true
  }

  const display = typeof entry?.display === 'string' ? entry.display : ''
  if (display.includes('[не начато]') || display.includes('[не завершено]')) {
    return true
  }

  return getTaskEntrySeconds(entry) === null
}

const compareTaskEntries = (first, second) => {
  const firstUnfinished = isUnfinishedTaskEntry(first)
  const secondUnfinished = isUnfinishedTaskEntry(second)

  if (firstUnfinished !== secondUnfinished) {
    return firstUnfinished ? 1 : -1
  }

  if (!firstUnfinished) {
    const firstSeconds = getTaskEntrySeconds(first)
    const secondSeconds = getTaskEntrySeconds(second)
    if (firstSeconds !== null && secondSeconds !== null && firstSeconds !== secondSeconds) {
      return firstSeconds - secondSeconds
    }
  }

  return String(first?.teamName || '').localeCompare(
    String(second?.teamName || ''),
    'ru',
  )
}

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
  const computedOutOfCompetitionTeams = Array.isArray(
    computed?.outOfCompetitionTeams,
  )
    ? computed.outOfCompetitionTeams
    : []
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

  const userParticipationTeamIds = useMemo(
    () =>
      new Set(
        (Array.isArray(resultsModalState?.userParticipationTeamIds)
          ? resultsModalState.userParticipationTeamIds
          : []
        )
          .map((item) => String(item || '').trim())
          .filter(Boolean),
      ),
    [resultsModalState?.userParticipationTeamIds],
  )
  const viewerCanManageResults = Boolean(resultsModalState?.viewerCanManageResults)
  const [showOutOfCompetitionTeams, setShowOutOfCompetitionTeams] = useState(true)
  const shouldShowOutOfCompetitionTeams = viewerCanManageResults
    ? showOutOfCompetitionTeams
    : true
  const scoringMode = computed?.summary?.scoringMode === 'points' ? 'points' : 'time'

  const mapComputedTeamToRankingRow = (team, outOfCompetition = false) => {
    const finalDisplay =
      typeof team?.finalDisplay === 'string' && team.finalDisplay.trim().length > 0
        ? team.finalDisplay
        : Number.isFinite(Number(team?.finalPoints))
          ? `${Number(team.finalPoints)} б.`
          : Number.isFinite(Number(team?.finalSeconds))
            ? formatDurationSeconds(team.finalSeconds)
          : null

    const baseDisplay =
      typeof team?.baseDisplay === 'string' && team.baseDisplay.trim().length > 0
        ? team.baseDisplay
        : Number.isFinite(Number(team?.basePoints))
          ? `${Number(team.basePoints)} б.`
          : Number.isFinite(Number(team?.baseSeconds))
            ? formatDurationSeconds(team.baseSeconds)
          : null

    return {
      teamId: team?.teamId,
      teamName: team?.teamName,
      place: outOfCompetition ? null : team?.place,
      baseDisplay,
      finalDisplay,
      outOfCompetition,
      finalSeconds: Number(team?.finalSeconds),
      finalPoints: Number(team?.finalPoints),
    }
  }

  const selfOutOfCompetitionRows = computedOutOfCompetitionTeams
    .filter((team) =>
      userParticipationTeamIds.has(String(team?.teamId || '').trim()),
    )
    .map((team) => mapComputedTeamToRankingRow(team, true))

  const visibleOutOfCompetitionRows = shouldShowOutOfCompetitionTeams
    ? viewerCanManageResults
      ? computedOutOfCompetitionTeams.map((team) =>
          mapComputedTeamToRankingRow(team, true),
        )
      : selfOutOfCompetitionRows
    : []

  const hasComputedRankingData =
    computedTeams.length > 0 || visibleOutOfCompetitionRows.length > 0

  const rankingRows =
    hasComputedRankingData
      ? [
          ...computedTeams.map((team) => mapComputedTeamToRankingRow(team, false)),
          ...visibleOutOfCompetitionRows,
        ].sort((first, second) => {
          if (scoringMode === 'points') {
            const firstPoints = Number(first?.finalPoints)
            const secondPoints = Number(second?.finalPoints)
            const firstOrder = Number.isFinite(firstPoints) ? firstPoints : Number.NEGATIVE_INFINITY
            const secondOrder = Number.isFinite(secondPoints) ? secondPoints : Number.NEGATIVE_INFINITY
            if (firstOrder !== secondOrder) {
              return secondOrder - firstOrder
            }
          } else {
            const firstSeconds = Number(first?.finalSeconds)
            const secondSeconds = Number(second?.finalSeconds)
            const firstOrder = Number.isFinite(firstSeconds) ? firstSeconds : Number.MAX_SAFE_INTEGER
            const secondOrder = Number.isFinite(secondSeconds) ? secondSeconds : Number.MAX_SAFE_INTEGER
            if (firstOrder !== secondOrder) {
              return firstOrder - secondOrder
            }
          }
          return String(first?.teamName || '').localeCompare(
            String(second?.teamName || ''),
            'ru',
          )
        })
      : rows.map((row) => ({
          teamId: row.teamId,
          teamName: row.teamName,
          place: row.place,
          baseDisplay: null,
          finalDisplay: null,
          outOfCompetition: false,
        }))

  const visibleOutOfCompetitionTaskEntriesByIndex = useMemo(() => {
    const byIndex = new Map()
    const visibleTeams = shouldShowOutOfCompetitionTeams
      ? viewerCanManageResults
      ? computedOutOfCompetitionTeams
      : computedOutOfCompetitionTeams.filter((team) =>
          userParticipationTeamIds.has(String(team?.teamId || '').trim()),
        )
      : []

    visibleTeams.forEach((team) => {
      const taskResults = Array.isArray(team?.taskResults) ? team.taskResults : []
      taskResults.forEach((taskResult, index) => {
        if (!taskResult) {
          return
        }
        const normalizedTaskIndex = Number.isFinite(Number(taskResult?.taskIndex))
          ? Number(taskResult.taskIndex)
          : index
        if (!Number.isFinite(normalizedTaskIndex)) {
          return
        }
        const current = byIndex.get(normalizedTaskIndex) || []
        current.push({
          teamId: team?.teamId,
          teamName: team?.teamName || 'Без названия',
          status: taskResult?.status || '',
          seconds: taskResult?.seconds ?? null,
          display: taskResult?.display || '—',
          penaltySeconds: Number(taskResult?.penaltySeconds) || 0,
          bonusSeconds: Number(taskResult?.bonusSeconds) || 0,
          adjustments: Array.isArray(taskResult?.adjustments)
            ? taskResult.adjustments
            : [],
          outOfCompetition: true,
        })
        byIndex.set(normalizedTaskIndex, current)
      })
    })

    return byIndex
  }, [
    computedOutOfCompetitionTeams,
    shouldShowOutOfCompetitionTeams,
    userParticipationTeamIds,
    viewerCanManageResults,
  ])

  const hasCurrentUserTeamInTable = useMemo(
    () =>
      rankingRows.some((row) =>
        userParticipationTeamIds.has(String(row.teamId || '').trim()),
      ),
    [rankingRows, userParticipationTeamIds],
  )

  const visibleOutOfCompetitionAdjustmentTeams = shouldShowOutOfCompetitionTeams
    ? viewerCanManageResults
      ? computedOutOfCompetitionTeams
      : computedOutOfCompetitionTeams.filter((team) =>
          userParticipationTeamIds.has(String(team?.teamId || '').trim()),
        )
    : []
  const teamsWithAdjustments =
    computedTeams.length > 0 || visibleOutOfCompetitionAdjustmentTeams.length > 0
      ? [
          ...computedTeams.map((team) => ({
            ...team,
            outOfCompetition: false,
          })),
          ...visibleOutOfCompetitionAdjustmentTeams.map((team) => ({
            ...team,
            outOfCompetition: true,
          })),
        ].filter((team) => Array.isArray(team?.addings) && team.addings.length > 0)
      : []
  const [expandedTaskBoards, setExpandedTaskBoards] = useState({})
  const [expandedAdjustmentTeams, setExpandedAdjustmentTeams] = useState({})

  useEffect(() => {
    setExpandedTaskBoards({})
    setExpandedAdjustmentTeams({})
    setShowOutOfCompetitionTeams(true)
  }, [isResultsModalOpen, resultsModalState?.gameId, taskBoards.length])

  const outOfCompetitionTeamsCount = computedOutOfCompetitionTeams.length
  const teamsCountFromComputed = computedTeams.length + outOfCompetitionTeamsCount
  const teamsCountSource = Number(resultsModalState?.teamsCount) || teamsCountFromComputed
  const visibleTeamsCount = shouldShowOutOfCompetitionTeams
    ? teamsCountSource
    : Math.max(0, teamsCountSource - outOfCompetitionTeamsCount)

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
            <ModalSection className="p-4">
              <ModalSectionTitle>Сводка</ModalSectionTitle>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Команд</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {visibleTeamsCount}
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
            </ModalSection>

            <ModalSection className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ModalSectionTitle>Турнирная таблица</ModalSectionTitle>
                {viewerCanManageResults && outOfCompetitionTeamsCount > 0 ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:checked:bg-cyan-500"
                      checked={showOutOfCompetitionTeams}
                      onChange={(event) =>
                        setShowOutOfCompetitionTeams(Boolean(event.target.checked))
                      }
                    />
                    Показывать команды Вне зачёта
                  </label>
                ) : null}
              </div>
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
                            {row.outOfCompetition
                              ? '—'
                              : Number.isFinite(Number(row.place))
                                ? row.place
                                : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {userParticipationTeamIds.has(
                              String(row.teamId || '').trim(),
                            ) ? (
                              <span
                                className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 text-[10px] font-bold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200"
                                title="Команда, в которой вы участвовали"
                                aria-label="Ваша команда"
                              >
                                ●
                              </span>
                            ) : null}
                            {row.teamName}
                            {row.outOfCompetition ? (
                              <span className="ml-2 inline-flex rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                Вне зачёта
                              </span>
                            ) : null}
                          </td>
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
              {hasCurrentUserTeamInTable ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                  <span
                    className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 text-[10px] font-bold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200"
                    aria-hidden="true"
                  >
                    ●
                  </span>
                  Команда, в которой вы участвовали.
                </p>
              ) : null}
            </ModalSection>

            {highlights && (
              <ModalSection className="p-4">
                <ModalSectionTitle>Ключевые показатели</ModalSectionTitle>
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
              </ModalSection>
            )}

            {taskBoards.length > 0 && (
              <ModalSection className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ModalSectionTitle>Время команд по заданиям</ModalSectionTitle>
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
                        const regularEntries = Array.isArray(board.entries)
                          ? board.entries.map((entry) => ({
                              ...entry,
                              outOfCompetition: Boolean(entry?.outOfCompetition),
                            }))
                          : []
                        const outOfCompetitionEntries =
                          visibleOutOfCompetitionTaskEntriesByIndex.get(
                            Number(board.taskIndex),
                          ) || []
                        const mergedEntries = [...regularEntries, ...outOfCompetitionEntries]
                        const sortedEntries = [...mergedEntries].sort(compareTaskEntries)

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
                                    title: `${board.taskIndex + 1}. ${board.canceled ? '(Отменено) ' : ''}${board.title || `Задание #${board.taskIndex + 1}`}`,
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
                                {sortedEntries.length > 0 ? (
                                  <ul className="mt-2 grid gap-1">
                                    {sortedEntries.map((entry) => (
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
                                        {entry.outOfCompetition ? (
                                          <span className="inline-flex rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                            ВЗ
                                          </span>
                                        ) : null}
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
              </ModalSection>
            )}

            {teamsWithAdjustments.length > 0 && (
              <ModalSection className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ModalSectionTitle>Дополнительные корректировки</ModalSectionTitle>
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
                              <h5 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                <span className="truncate">{team.teamName}</span>
                                {team.outOfCompetition ? (
                                  <span className="inline-flex shrink-0 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                    ВЗ
                                  </span>
                                ) : null}
                              </h5>
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
                                    {item.scope === 'task_elapsed' ? (
                                      <span className="rounded-full border border-current/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
                                        учтено во времени задания
                                      </span>
                                    ) : null}
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
              </ModalSection>
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
    userParticipationTeamIds: PropTypes.arrayOf(PropTypes.string),
    viewerCanManageResults: PropTypes.bool,
  }).isRequired,
}

export default memo(GameResultsModal)
