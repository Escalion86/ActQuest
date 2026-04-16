'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'

import requestApiJson from '@helpers/requestApiJson'
import Modal from '@components/Modal'
import FullscreenImageViewer from '@components/FullscreenImageViewer'
import FeedbackToast from '@components/FeedbackToast'
import CardActionIconButton, {
  EditCardIcon,
  TargetCardIcon,
  TeamStatsCardIcon,
} from '@components/cabinet/CardActionIconButton'
import GameTasksViewModal from '@components/modals/GameTasksViewModal'
import GameControlTeamStatsModal from '@components/modals/GameControlTeamStatsModal'

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

const normalizeCodeEntries = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => {
      if (typeof value === 'string' || typeof value === 'number') {
        const code = String(value || '').trim()
        return code ? { code, description: '', image: '' } : null
      }
      if (!value || typeof value !== 'object') {
        return null
      }
      const code =
        (typeof value.code === 'string' && value.code.trim()) ||
        (typeof value.code === 'number' && Number.isFinite(value.code)
          ? String(value.code).trim()
          : '') ||
        (typeof value.value === 'string' && value.value.trim()) ||
        (typeof value.text === 'string' && value.text.trim()) ||
        ''
      if (!code) {
        return null
      }
      const description =
        typeof value.description === 'string' ? value.description.trim() : ''
      const image = typeof value.image === 'string' ? value.image.trim() : ''
      return { code, description, image }
    })
    .filter(Boolean)

const normalizeCodeKey = (value) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().toLowerCase()
    : ''

const renderCodesBadges = (codes, tone = 'default', options = {}) => {
  const normalizedEntries = normalizeCodeEntries(codes)
  if (normalizedEntries.length === 0) {
    return <span className="text-xs text-slate-500">—</span>
  }
  const getPhotoByCode =
    typeof options.getPhotoByCode === 'function' ? options.getPhotoByCode : null
  const onCodeClick =
    typeof options.onCodeClick === 'function' ? options.onCodeClick : null

  const toneClass =
    tone === 'bonus'
      ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200'
      : tone === 'penalty'
        ? 'border-red-500/40 bg-red-500/12 text-red-200'
        : tone === 'muted'
          ? 'border-slate-500/40 bg-slate-500/12 text-slate-300'
        : 'border-cyan-500/40 bg-cyan-500/12 text-cyan-200'

  return (
    <div className="flex flex-wrap gap-1.5">
      {normalizedEntries.map((entry, index) => (
        (() => {
          const photoUrl = getPhotoByCode
            ? getPhotoByCode(normalizeCodeKey(entry.code))
            : ''
          const badgeTitle = photoUrl
            ? entry.description
              ? `${entry.description} (нажмите, чтобы открыть фото)`
              : 'Нажмите, чтобы открыть фото кода'
            : entry.description || undefined
          const content = (
            <>
              {entry.code}
              {(tone === 'bonus' || tone === 'penalty' || tone === 'muted') &&
              entry.description
                ? ` — ${entry.description}`
                : ''}
            </>
          )
          const className = `inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${toneClass} ${
            photoUrl ? 'cursor-pointer transition hover:brightness-110' : ''
          }`

          if (photoUrl && onCodeClick) {
            return (
              <button
                key={`${entry.code}-${index}`}
                type="button"
                onClick={() => onCodeClick({ code: entry.code, photoUrl })}
                className={className}
                title={badgeTitle}
              >
                {content}
              </button>
            )
          }
          return (
            <span
              key={`${entry.code}-${index}`}
              className={className}
              title={badgeTitle}
            >
              {content}
            </span>
          )
        })()
      ))}
    </div>
  )
}

const buildCodePhotoLookup = (task) => {
  const lookup = new Map()
  if (!task || typeof task !== 'object') {
    return lookup
  }

  const mainCodes = normalizeCodeEntries(task.codes)
  const mainCodePhotos = Array.isArray(task.codePhotos) ? task.codePhotos : []
  mainCodes.forEach((entry, index) => {
    const key = normalizeCodeKey(entry.code)
    const photo = typeof mainCodePhotos[index] === 'string' ? mainCodePhotos[index].trim() : ''
    if (key && photo) {
      lookup.set(key, photo)
    }
  })

  normalizeCodeEntries(task.bonusCodes).forEach((entry) => {
    const key = normalizeCodeKey(entry.code)
    if (key && entry.image) {
      lookup.set(key, entry.image)
    }
  })
  normalizeCodeEntries(task.penaltyCodes).forEach((entry) => {
    const key = normalizeCodeKey(entry.code)
    if (key && entry.image) {
      lookup.set(key, entry.image)
    }
  })

  return lookup
}

const getRemainingMainCodes = (team, tasks) => {
  const activeTaskIndex = Number.isInteger(team?.activeTaskIndex)
    ? team.activeTaskIndex
    : -1
  if (activeTaskIndex < 0 || !Array.isArray(tasks)) {
    return []
  }

  const activeTask = tasks[activeTaskIndex]
  const allMainCodes = normalizeCodeEntries(activeTask?.codes).map(
    (entry) => entry.code,
  )
  if (allMainCodes.length === 0) {
    return []
  }

  const foundMainCodes = new Set(
    normalizeCodeEntries(team?.findedCodes).map((entry) =>
      entry.code.trim().toLowerCase(),
    ),
  )

  return allMainCodes.filter(
    (code) => !foundMainCodes.has(String(code).trim().toLowerCase()),
  )
}

const getRemainingCodeEntries = ({
  team,
  tasks,
  taskFieldName,
  foundEntries,
}) => {
  const activeTaskIndex = Number.isInteger(team?.activeTaskIndex)
    ? team.activeTaskIndex
    : -1
  if (activeTaskIndex < 0 || !Array.isArray(tasks)) {
    return []
  }

  const activeTask = tasks[activeTaskIndex]
  const allEntries = normalizeCodeEntries(activeTask?.[taskFieldName])
  if (allEntries.length === 0) {
    return []
  }

  const foundSet = new Set(
    normalizeCodeEntries(foundEntries).map((entry) =>
      entry.code.trim().toLowerCase(),
    ),
  )

  return allEntries.filter(
    (entry) => !foundSet.has(String(entry.code).trim().toLowerCase()),
  )
}

const buildManualCodeCandidates = (team, tasks) => {
  const remainingMainCodes = getRemainingMainCodes(team, tasks)
  const remainingBonusEntries = getRemainingCodeEntries({
    team,
    tasks,
    taskFieldName: 'bonusCodes',
    foundEntries: team?.bonusCodeItems?.length
      ? team.bonusCodeItems
      : team?.bonusCodes,
  })
  const remainingPenaltyEntries = getRemainingCodeEntries({
    team,
    tasks,
    taskFieldName: 'penaltyCodes',
    foundEntries: team?.penaltyCodeItems?.length
      ? team.penaltyCodeItems
      : team?.penaltyCodes,
  })

  return [
    ...remainingMainCodes.map((code) => ({
      code: String(code || '').trim(),
      category: 'main',
      label: `[ОСН] ${String(code || '').trim()}`,
    })),
    ...remainingBonusEntries.map((entry) => ({
      code: String(entry?.code || '').trim(),
      category: 'bonus',
      label:
        entry?.description && String(entry.description).trim()
          ? `[БОН] ${String(entry.code || '').trim()} — ${String(entry.description).trim()}`
          : `[БОН] ${String(entry?.code || '').trim()}`,
    })),
    ...remainingPenaltyEntries.map((entry) => ({
      code: String(entry?.code || '').trim(),
      category: 'penalty',
      label:
        entry?.description && String(entry.description).trim()
          ? `[ШТР] ${String(entry.code || '').trim()} — ${String(entry.description).trim()}`
          : `[ШТР] ${String(entry?.code || '').trim()}`,
    })),
  ].filter((item) => Boolean(item.code))
}

export default function GameControlPageClient({ session }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDetailedView, setIsDetailedView] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [autoRefreshIntervalMs, setAutoRefreshIntervalMs] = useState(15000)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isTasksViewModalOpen, setIsTasksViewModalOpen] = useState(false)
  const [selectedTeamForStatsId, setSelectedTeamForStatsId] = useState('')
  const [selectedTeamForManualActionsId, setSelectedTeamForManualActionsId] =
    useState('')
  const [toastEvent, setToastEvent] = useState(null)
  const [wrongCodesModalData, setWrongCodesModalData] = useState(null)
  const [selectedManualCode, setSelectedManualCode] = useState('')
  const [manualActionError, setManualActionError] = useState('')
  const [manualActionLoading, setManualActionLoading] = useState(false)
  const [selectedCodePhoto, setSelectedCodePhoto] = useState(null)
  const [isFullscreenCodePhotoOpen, setIsFullscreenCodePhotoOpen] = useState(false)
  const intervalRef = useRef(null)
  const showToast = useCallback((type, message) => {
    setToastEvent({
      id: Date.now(),
      type,
      message,
    })
  }, [])

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
  const selectedTeamForStats = useMemo(
    () => {
      const teamsList = Array.isArray(data?.teams) ? data.teams : []
      return (
        teamsList.find(
          (item) => String(item?.teamId) === selectedTeamForStatsId,
        ) || null
      )
    },
    [data?.teams, selectedTeamForStatsId],
  )
  const selectedTeamForManualActions = useMemo(
    () => {
      const teamsList = Array.isArray(data?.teams) ? data.teams : []
      return (
        teamsList.find(
          (item) => String(item?.teamId) === selectedTeamForManualActionsId,
        ) || null
      )
    },
    [data?.teams, selectedTeamForManualActionsId],
  )
  const manualCodeCandidates = useMemo(
    () =>
      selectedTeamForManualActions
        ? buildManualCodeCandidates(selectedTeamForManualActions, data?.tasks)
        : [],
    [data?.tasks, selectedTeamForManualActions],
  )

  useEffect(() => {
    if (!selectedTeamForManualActionsId) {
      setSelectedManualCode('')
      setManualActionError('')
      return
    }
    const firstCode = manualCodeCandidates[0]?.code || ''
    setSelectedManualCode((prev) => (prev ? prev : firstCode))
  }, [manualCodeCandidates, selectedTeamForManualActionsId])

  const closeManualActionsModal = useCallback(() => {
    if (manualActionLoading) return
    setSelectedTeamForManualActionsId('')
    setSelectedManualCode('')
    setManualActionError('')
  }, [manualActionLoading])

  const runManualAction = useCallback(
    async (action, code = '') => {
      if (!gameId || !selectedTeamForManualActions?.teamId) {
        return
      }
      setManualActionLoading(true)
      setManualActionError('')
      try {
        const { json } = await requestApiJson('/api/cabinet/admin/game-status/action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            gameId,
            teamId: String(selectedTeamForManualActions.teamId),
            action,
            ...(code ? { code } : {}),
          }),
        })
        await fetchStatus()
        return json
      } catch (requestError) {
        setManualActionError(
          requestError?.payload?.error ||
            requestError?.message ||
            'Не удалось выполнить действие',
        )
        throw requestError
      } finally {
        setManualActionLoading(false)
      }
    },
    [fetchStatus, gameId, selectedTeamForManualActions?.teamId],
  )

  const handleApplyManualCode = useCallback(async () => {
    const nextCode = String(selectedManualCode || '').trim()
    if (!nextCode) {
      setManualActionError('Выберите код для зачёта.')
      return
    }
    if (!window.confirm(`Зачесть код «${nextCode}» этой команде?`)) {
      return
    }
    try {
      await runManualAction('apply_code', nextCode)
      showToast('success', 'Код зачислен')
    } catch {
      return
    }
  }, [runManualAction, selectedManualCode, showToast])

  const handleForceCompleteTask = useCallback(async () => {
    if (
      !window.confirm(
        'Принудительно завершить текущее задание для этой команды?',
      )
    ) {
      return
    }
    try {
      await runManualAction('force_complete')
      showToast('success', 'Задание выполнено')
      closeManualActionsModal()
    } catch {
      return
    }
  }, [closeManualActionsModal, runManualAction, showToast])

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
              checked={isDetailedView}
              onChange={(event) => setIsDetailedView(event.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
            />
            Подробно
          </label>
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 transition hover:bg-cyan-500/20"
            aria-label="Обновить"
            title="Обновить"
          >
            <FontAwesomeIcon icon={faArrowsRotate} className="h-4 w-4" />
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
          {teams.map((team, index) => {
            const activeTask =
              Array.isArray(data?.tasks) &&
              Number.isInteger(team?.activeTaskIndex) &&
              team.activeTaskIndex >= 0
                ? data.tasks[team.activeTaskIndex]
                : null
            const codePhotoLookup = buildCodePhotoLookup(activeTask)
            const getPhotoByCode = (codeKey) =>
              (codePhotoLookup instanceof Map ? codePhotoLookup.get(codeKey) : '') ||
              ''
            const handleCodeBadgeClick = ({ code, photoUrl }) =>
              setSelectedCodePhoto({
                code: String(code || ''),
                photoUrl: String(photoUrl || ''),
              })
            const foundBonusEntries = team.bonusCodeItems?.length
              ? team.bonusCodeItems
              : team.bonusCodes
            const foundPenaltyEntries = team.penaltyCodeItems?.length
              ? team.penaltyCodeItems
              : team.penaltyCodes
            const foundMainEntries = normalizeCodeEntries(team.findedCodes)
            const remainingBonusEntries = getRemainingCodeEntries({
              team,
              tasks: data?.tasks,
              taskFieldName: 'bonusCodes',
              foundEntries: foundBonusEntries,
            })
            const remainingPenaltyEntries = getRemainingCodeEntries({
              team,
              tasks: data?.tasks,
              taskFieldName: 'penaltyCodes',
              foundEntries: foundPenaltyEntries,
            })
            const shouldShowBonusCodes =
              normalizeCodeEntries(foundBonusEntries).length > 0 ||
              remainingBonusEntries.length > 0
            const shouldShowPenaltyCodes =
              normalizeCodeEntries(foundPenaltyEntries).length > 0 ||
              remainingPenaltyEntries.length > 0

            return (
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
                <div className="flex items-center gap-2">
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
                  <CardActionIconButton
                    onClick={() => setSelectedTeamForStatsId(String(team.teamId || ''))}
                    label="Открыть статистику команды"
                    title="Статистика команды"
                    className="h-8 w-8"
                  >
                    <TeamStatsCardIcon />
                  </CardActionIconButton>
                  {!team.isTeamOnBreak ? (
                    <CardActionIconButton
                      onClick={() =>
                        setSelectedTeamForManualActionsId(String(team.teamId || ''))
                      }
                      label="Ручные действия с кодами"
                      title="Ручные действия"
                      className="h-8 w-8"
                    >
                      <EditCardIcon />
                    </CardActionIconButton>
                  ) : null}
                </div>
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
                  <span className="text-slate-500">Основные коды: </span>
                  <span className="font-medium text-green-400">
                    {team.findedCodesCount}
                  </span>
                  {team.wrongCodesCount > 0 && (
                    <button
                      type="button"
                      className="ml-1 text-red-400 underline decoration-dotted underline-offset-2 transition hover:text-red-300"
                      onClick={() =>
                        setWrongCodesModalData({
                          teamName: String(team.teamName || ''),
                          taskLabel: team.isTeamFinished
                            ? 'Завершено'
                            : `${team.activeTaskIndex + 1}. ${team.currentTaskTitle || 'Без названия'}`,
                          wrongCodes: normalizeCodeEntries(team.wrongCodes).map(
                            (entry) => entry.code,
                          ),
                        })
                      }
                    >
                      ({team.wrongCodesCount} неверн.)
                    </button>
                  )}
                  {isDetailedView && foundMainEntries.length > 0 ? (
                    <div className="mt-1">
                      {renderCodesBadges(foundMainEntries, 'default', {
                        getPhotoByCode,
                        onCodeClick: handleCodeBadgeClick,
                      })}
                    </div>
                  ) : null}
                  {isDetailedView && (() => {
                    const remainingMainCodes = getRemainingMainCodes(
                      team,
                      data?.tasks,
                    )
                    if (remainingMainCodes.length === 0) {
                      return null
                    }
                    return (
                      <div className="mt-1">
                        {renderCodesBadges(remainingMainCodes, 'muted', {
                          getPhotoByCode,
                          onCodeClick: handleCodeBadgeClick,
                        })}
                      </div>
                    )
                  })()}
                </div>
                {shouldShowBonusCodes && (
                  <div>
                    <span className="text-slate-500">Бонусные коды: </span>
                    <span className="font-medium text-emerald-400">
                      {team.bonusCodesCount}
                    </span>
                    {isDetailedView && normalizeCodeEntries(foundBonusEntries).length > 0 ? (
                      <div className="mt-1">
                        {renderCodesBadges(foundBonusEntries, 'bonus', {
                          getPhotoByCode,
                          onCodeClick: handleCodeBadgeClick,
                        })}
                      </div>
                    ) : null}
                    {isDetailedView && remainingBonusEntries.length > 0 && (
                      <div className="mt-1">
                        {renderCodesBadges(remainingBonusEntries, 'muted', {
                          getPhotoByCode,
                          onCodeClick: handleCodeBadgeClick,
                        })}
                      </div>
                    )}
                  </div>
                )}
                {shouldShowPenaltyCodes && (
                  <div>
                    <span className="text-slate-500">Штрафные коды: </span>
                    <span className="font-medium text-red-400">
                      {team.penaltyCodesCount}
                    </span>
                    {isDetailedView && normalizeCodeEntries(foundPenaltyEntries).length > 0 ? (
                      <div className="mt-1">
                        {renderCodesBadges(foundPenaltyEntries, 'penalty', {
                          getPhotoByCode,
                          onCodeClick: handleCodeBadgeClick,
                        })}
                      </div>
                    ) : null}
                    {isDetailedView && remainingPenaltyEntries.length > 0 && (
                      <div className="mt-1">
                        {renderCodesBadges(remainingPenaltyEntries, 'muted', {
                          getPhotoByCode,
                          onCodeClick: handleCodeBadgeClick,
                        })}
                      </div>
                    )}
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
                    (() => {
                      const elapsed = Math.max(
                        0,
                        Math.floor(team.currentTaskSeconds || 0),
                      )
                      const failRemaining = Math.max(
                        0,
                        Math.floor(taskDuration || 0) - elapsed,
                      )
                      const clueInterval = Math.max(
                        1,
                        Math.floor(cluesDuration || 0),
                      )
                      const mod = elapsed % clueInterval
                      const clueRemaining =
                        clueInterval > 0
                          ? mod === 0
                            ? clueInterval
                            : clueInterval - mod
                          : Number.POSITIVE_INFINITY
                      const canShowClueTimer =
                        Number(cluesDuration) > 0 && clueRemaining < failRemaining

                      if (canShowClueTimer) {
                        return (
                          <div>
                            <span className="text-slate-500">
                              До подсказки:{' '}
                            </span>
                            <span className="font-mono font-medium text-violet-300">
                              {formatTime(clueRemaining)}
                            </span>
                          </div>
                        )
                      }

                      return (
                        <div>
                          <span className="text-slate-500">
                            До провала задания:{' '}
                          </span>
                          <span className="font-mono font-medium text-rose-300">
                            {formatTime(failRemaining)}
                          </span>
                        </div>
                      )
                    })()
                  )}
                {team.isTeamOnBreak && team.isActiveTaskFailed ? (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-200">
                    Команда провалила предыдущее задание.
                  </div>
                ) : null}
                {team.isTeamOnBreak &&
                  !team.isActiveTaskFailed &&
                  team.completedTaskSeconds > 0 && (
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
            )
          })}
        </div>
      )}

      <GameTasksViewModal
        isTasksViewModalOpen={isTasksViewModalOpen}
        handleCloseTasksViewModal={() => setIsTasksViewModalOpen(false)}
        selectedGame={gameForTasksModal}
        canViewCodePhotos
        showAllTaskDetails
      />
      <GameControlTeamStatsModal
        isOpen={Boolean(selectedTeamForStatsId)}
        onClose={() => setSelectedTeamForStatsId('')}
        teamName={selectedTeamForStats?.teamName || ''}
        stats={selectedTeamForStats?.teamProgressStats || null}
      />
      <Modal
        isOpen={Boolean(selectedCodePhoto?.photoUrl)}
        onClose={() => {
          setSelectedCodePhoto(null)
          setIsFullscreenCodePhotoOpen(false)
        }}
        title={
          selectedCodePhoto?.code
            ? `Фото кода: ${selectedCodePhoto.code}`
            : 'Фото кода'
        }
        compactMobile
      >
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
          {selectedCodePhoto?.photoUrl ? (
            <img
              src={selectedCodePhoto.photoUrl}
              alt={selectedCodePhoto?.code || 'Фото кода'}
              className="max-h-[70vh] w-full cursor-zoom-in rounded-lg object-contain"
              draggable={false}
              onClick={() => setIsFullscreenCodePhotoOpen(true)}
            />
          ) : null}
        </div>
      </Modal>
      <FullscreenImageViewer
        isOpen={isFullscreenCodePhotoOpen && Boolean(selectedCodePhoto?.photoUrl)}
        src={selectedCodePhoto?.photoUrl || ''}
        alt={selectedCodePhoto?.code ? `Фото кода: ${selectedCodePhoto.code}` : 'Фото кода'}
        onClose={() => setIsFullscreenCodePhotoOpen(false)}
      />
      <FeedbackToast event={toastEvent} />
      <Modal
        isOpen={Boolean(wrongCodesModalData)}
        onClose={() => setWrongCodesModalData(null)}
        title={
          wrongCodesModalData?.teamName
            ? `Неверные коды — ${wrongCodesModalData.teamName}`
            : 'Неверные коды'
        }
        compactMobile
      >
        <div className="space-y-3">
          {wrongCodesModalData?.taskLabel ? (
            <p className="text-sm text-slate-400">
              Задание: {wrongCodesModalData.taskLabel}
            </p>
          ) : null}
          {Array.isArray(wrongCodesModalData?.wrongCodes) &&
          wrongCodesModalData.wrongCodes.length > 0 ? (
            <ul className="space-y-2">
              {wrongCodesModalData.wrongCodes.map((code, index) => (
                <li
                  key={`${code}-${index}`}
                  className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 font-mono text-sm text-rose-200"
                >
                  {code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Нет неверных кодов.</p>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(selectedTeamForManualActionsId)}
        onClose={closeManualActionsModal}
        title={
          selectedTeamForManualActions?.teamName
            ? `Ручные действия — ${selectedTeamForManualActions.teamName}`
            : 'Ручные действия'
        }
        compactMobile
        footer={
          <>
            <button
              type="button"
              onClick={closeManualActionsModal}
              className="aq-modal-btn aq-modal-btn-secondary"
              disabled={manualActionLoading}
            >
              Закрыть
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {manualActionError ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {manualActionError}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Зачесть код команде
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs text-slate-400">
                  Код из ещё не введённых
                </label>
                <select
                  value={selectedManualCode}
                  onChange={(event) => setSelectedManualCode(event.target.value)}
                  className="w-full rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                  disabled={manualActionLoading || manualCodeCandidates.length === 0}
                >
                  {manualCodeCandidates.length === 0 ? (
                    <option value="">Нет доступных кодов</option>
                  ) : (
                    manualCodeCandidates.map((item) => (
                      <option key={`${item.category}-${item.code}`} value={item.code}>
                        {item.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                type="button"
                onClick={handleApplyManualCode}
                disabled={manualActionLoading || manualCodeCandidates.length === 0}
                className="aq-modal-btn aq-modal-btn-primary"
              >
                {manualActionLoading ? 'Применяем...' : 'Зачесть код'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
              Завершение задания
            </p>
            <p className="mt-1 text-sm text-amber-100/90">
              Принудительно завершает текущее задание для команды от имени
              администратора.
            </p>
            <button
              type="button"
              onClick={handleForceCompleteTask}
              disabled={manualActionLoading || selectedTeamForManualActions?.isTeamFinished}
              className="aq-modal-btn aq-modal-btn-primary mt-3"
            >
              {manualActionLoading ? 'Применяем...' : 'Выполнить задание'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

GameControlPageClient.propTypes = {
  session: PropTypes.shape({
    user: PropTypes.object.isRequired,
  }).isRequired,
}
