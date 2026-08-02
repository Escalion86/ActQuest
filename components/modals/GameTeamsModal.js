import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetDurationField from '@components/cabinet/CabinetDurationField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import TeamSelectField from '@components/cabinet/TeamSelectField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import ImagesInput from '@components/cabinet/ImagesInput'
import NoticeBanner from '@components/NoticeBanner'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import requestApiJson from '@helpers/requestApiJson'
import {
  formatTaskDistributionTemplate,
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'
import { LOCATIONS } from '@server/serverConstants'
import TeamDescriptionModal from './TeamDescriptionModal'
import GameControlTeamStatsModal from './GameControlTeamStatsModal'
import TeamGamePaymentsModal from './TeamGamePaymentsModal'
import TeamPrequelsModal from './TeamPrequelsModal'

const resolveRatingBadge = (rating) =>
  rating?.isEligible && Number.isFinite(rating?.rank) ? `#${rating.rank}` : null

const formatDurationBadge = (secondsRaw) => {
  const totalSeconds = Math.max(0, Math.round(Number(secondsRaw) || 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0 && seconds > 0) {
    return `${minutes}м ${seconds}с`
  }
  if (minutes > 0) {
    return `${minutes}м`
  }
  return `${seconds}с`
}

const formatMoney = (amountRaw) => {
  const amount = Number(amountRaw)
  if (!Number.isFinite(amount)) {
    return '0 ₽'
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount)
}

const parseTaskDistributionTemplateText = (value) => {
  const source = String(value || '').trim()
  if (!source) return []

  return (source.match(/\[[^\]]*\]|\d+/g) || []).map((token) => {
    if (token.startsWith('[')) {
      return token
        .replace(/[[\]]/g, '')
        .split(',')
        .map((item) => Number(item.trim()))
        .filter(Number.isFinite)
    }

    return Number(token)
  })
}

const OpenDoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 3h11v18H4z" />
    <path d="M15 6h4l1 3v9l-1 3h-4" />
    <circle cx="10.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
  </svg>
)

const ClosedDoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 3h11v18H4z" />
    <path d="M15 6h4v12h-4" />
    <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" />
    <circle cx="10.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
  </svg>
)

const TeamStatsIcon = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3.5"
      y="3.5"
      width="13"
      height="13"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M6.5 13V10.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M10 13V8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M13.5 13V6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const TeamPaymentIcon = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18" />
    <path d="M7 15h4" />
    <path d="M15 15h2" />
  </svg>
)

const GameTeamsModal = ({
  selectedGame,
  isTeamsModalOpen,
  handleCloseTeamsModal,
  teamsModalState,
  removingTeamIds,
  updatingOutOfCompetitionTeamIds,
  updatingPaidGameTeamIds,
  selectedTeamToAdd,
  setSelectedTeamToAdd,
  handleAddTeamToGame,
  isAddingTeam,
  handleRemoveTeamFromGame,
  handleToggleTeamOutOfCompetition,
  handleToggleTeamPaidGame,
  handleRefreshTeamsModalData,
  currentUserRole,
  isReadOnly = false,
}) => {
  const [isTeamDetailsModalOpen, setIsTeamDetailsModalOpen] = useState(false)
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null)
  const [selectedTeamDetailsId, setSelectedTeamDetailsId] = useState('')
  const [isRestrictedDeleteModalOpen, setIsRestrictedDeleteModalOpen] =
    useState(false)
  const [restrictedDeleteTeamName, setRestrictedDeleteTeamName] = useState('')
  const [isTeamEditModalOpen, setIsTeamEditModalOpen] = useState(false)
  const [teamToEdit, setTeamToEdit] = useState(null)
  const [isSavingTeamEdit, setIsSavingTeamEdit] = useState(false)
  const [teamEditError, setTeamEditError] = useState('')
  const [isTeamAdjustmentsModalOpen, setIsTeamAdjustmentsModalOpen] =
    useState(false)
  const [teamAdjustmentsError, setTeamAdjustmentsError] = useState('')
  const [isSavingTeamAdjustments, setIsSavingTeamAdjustments] = useState(false)
  const [teamAdjustmentsTarget, setTeamAdjustmentsTarget] = useState(null)
  const [teamAdjustmentRows, setTeamAdjustmentRows] = useState([])
  const [isAdjustmentEditorOpen, setIsAdjustmentEditorOpen] = useState(false)
  const [adjustmentEditorMode, setAdjustmentEditorMode] = useState('create')
  const [adjustmentDraft, setAdjustmentDraft] = useState({
    id: '',
    type: 'penalty',
    seconds: 60,
    name: '',
    scope: 'total_adjustment',
    showInAdjustments: true,
    taskIndex: '',
  })
  const [selectedTeamStatsName, setSelectedTeamStatsName] = useState('')
  const [selectedTeamStats, setSelectedTeamStats] = useState(null)
  const [isTeamStatsModalOpen, setIsTeamStatsModalOpen] = useState(false)
  const [isTeamPaymentsModalOpen, setIsTeamPaymentsModalOpen] = useState(false)
  const [teamPaymentsTarget, setTeamPaymentsTarget] = useState(null)
  const [teamPrequelsTarget, setTeamPrequelsTarget] = useState(null)
  const [teamDistributionTarget, setTeamDistributionTarget] = useState(null)
  const [teamDistributionText, setTeamDistributionText] = useState('')
  const [teamDistributionError, setTeamDistributionError] = useState('')
  const [isSavingTeamDistribution, setIsSavingTeamDistribution] =
    useState(false)
  const [distributingTeamId, setDistributingTeamId] = useState('')

  const teamDetailsQuery = useQuery({
    queryKey: ['team', selectedTeamDetailsId],
    queryFn: () => fetchCabinetTeamDetails({ teamId: selectedTeamDetailsId }),
    enabled: isTeamDetailsModalOpen && Boolean(selectedTeamDetailsId),
    staleTime: 1000 * 60 * 5,
  })
  const resolvedSelectedTeamDetails =
    teamDetailsQuery.data || selectedTeamDetails
  const teamDetailsError = teamDetailsQuery.error?.message || ''
  const adjustmentTaskOptions = useMemo(
    () =>
      (Array.isArray(selectedGame?.tasks) ? selectedGame.tasks : []).map(
        (task, index) => ({
          value: String(index),
          label: String(task?.title || '').trim() || `Задание ${index + 1}`,
        }),
      ),
    [selectedGame?.tasks],
  )

  const isManualAdjustmentItem = useCallback((item) => {
    if (!item || typeof item !== 'object') {
      return false
    }

    const source = String(item.source || '')
      .trim()
      .toLowerCase()
    if (source === 'manual_team_adjustment') {
      return true
    }

    const name = String(item.name || '').trim()
    if (name.startsWith('Досрочная подсказка')) {
      return false
    }

    // Legacy fallback: старые ручные корректировки могли быть без source.
    // Считаем ручными записи без source и без task binding.
    const hasTaskId =
      typeof item.taskId === 'string' && item.taskId.trim() !== ''
    const hasTaskIndex =
      item?.taskIndex !== null &&
      item?.taskIndex !== undefined &&
      item?.taskIndex !== '' &&
      Number.isFinite(Number(item.taskIndex))
    return !source && !hasTaskId && !hasTaskIndex
  }, [])

  const closeTeamDetailsModal = useCallback(() => {
    setIsTeamDetailsModalOpen(false)
    setSelectedTeamDetailsId('')
  }, [])

  const closeRestrictedDeleteModal = useCallback(() => {
    setIsRestrictedDeleteModalOpen(false)
    setRestrictedDeleteTeamName('')
  }, [])

  const gameStatus = String(selectedGame?.status || '')
    .trim()
    .toLowerCase()
  const isPlayerMode = selectedGame?.participationMode === 'player'
  const canAddTeams =
    !isReadOnly &&
    !isPlayerMode &&
    gameStatus === 'active' &&
    selectedGame?.registrationOpen !== false
  const canEditRegisteredTeams =
    !isReadOnly &&
    ['dev', 'admin', 'moder'].includes(
      String(currentUserRole || '').toLowerCase(),
    )
  const canViewTeamStats =
    canEditRegisteredTeams &&
    (gameStatus === 'finished' || gameStatus === 'closed')
  const locationOptions = useMemo(
    () =>
      Object.entries(LOCATIONS)
        .filter(([, location]) => !location?.hidden)
        .map(([value, location]) => ({
          value,
          label:
            typeof location?.townRu === 'string' && location.townRu.trim()
              ? location.townRu.trim()
              : value,
        })),
    [],
  )
  const selectedAvailableTeam = useMemo(
    () =>
      teamsModalState.availableTeams.find(
        (team) => team?.id === selectedTeamToAdd,
      ) ?? null,
    [selectedTeamToAdd, teamsModalState.availableTeams],
  )

  useEffect(() => {
    if (!isTeamsModalOpen) {
      setIsTeamDetailsModalOpen(false)
      setSelectedTeamDetails(null)
      setSelectedTeamDetailsId('')
      setIsRestrictedDeleteModalOpen(false)
      setRestrictedDeleteTeamName('')
      setIsTeamEditModalOpen(false)
      setTeamToEdit(null)
      setIsSavingTeamEdit(false)
      setTeamEditError('')
      setIsTeamAdjustmentsModalOpen(false)
      setTeamAdjustmentsError('')
      setIsSavingTeamAdjustments(false)
      setTeamAdjustmentsTarget(null)
      setTeamAdjustmentRows([])
      setIsAdjustmentEditorOpen(false)
      setAdjustmentEditorMode('create')
      setAdjustmentDraft({
        id: '',
        type: 'penalty',
        seconds: 60,
        name: '',
      })
      setSelectedTeamStatsName('')
      setSelectedTeamStats(null)
      setIsTeamStatsModalOpen(false)
      setIsTeamPaymentsModalOpen(false)
      setTeamPaymentsTarget(null)
      setTeamPrequelsTarget(null)
      setTeamDistributionTarget(null)
      setTeamDistributionText('')
      setTeamDistributionError('')
      setIsSavingTeamDistribution(false)
      setDistributingTeamId('')
    }
  }, [isTeamsModalOpen])

  const handleCloseTeamStatsModal = useCallback(() => {
    setIsTeamStatsModalOpen(false)
    setSelectedTeamStatsName('')
    setSelectedTeamStats(null)
  }, [])

  const handleOpenTeamPaymentsModal = useCallback((team) => {
    if (!team?.id) {
      return
    }

    const members = Array.isArray(team?.teamDetails?.members)
      ? team.teamDetails.members.filter((member) => member?.userId)
      : []
    const target = {
      gameTeamId: String(team.id),
      teamId: String(team.teamId || ''),
      teamName: String(team.teamName || 'Без названия'),
      paidGame: Boolean(team.paidGame),
      members,
      totalPaid: Number(team.totalPaid) || 0,
    }

    setTeamPaymentsTarget(target)
    setIsTeamPaymentsModalOpen(true)
  }, [])

  const handleOpenTeamDistributionModal = useCallback(
    (team) => {
      const tasksCount = Array.isArray(selectedGame?.tasks)
        ? selectedGame.tasks.length
        : 0
      const template = normalizeStoredTaskDistributionTemplate(
        team?.taskDistributionTemplate,
        tasksCount,
      )

      setTeamDistributionTarget({
        gameTeamId: String(team?.id || ''),
        teamName: String(team?.teamName || 'Команда'),
      })
      setTeamDistributionText(formatTaskDistributionTemplate(template))
      setTeamDistributionError('')
    },
    [selectedGame?.tasks],
  )

  const handleCloseTeamDistributionModal = useCallback(() => {
    if (isSavingTeamDistribution) {
      return
    }
    setTeamDistributionTarget(null)
    setTeamDistributionText('')
    setTeamDistributionError('')
  }, [isSavingTeamDistribution])

  const handleSaveTeamDistributionTemplate = useCallback(async () => {
    if (!selectedGame?.id || !teamDistributionTarget?.gameTeamId) {
      setTeamDistributionError('Не передан идентификатор игры или команды')
      return
    }

    const tasksCount = Array.isArray(selectedGame?.tasks)
      ? selectedGame.tasks.length
      : 0
    const rawText = String(teamDistributionText || '').trim()
    const template = rawText
      ? normalizeTaskDistributionTemplate(
          parseTaskDistributionTemplateText(rawText),
          tasksCount,
        )
      : []

    if (template.length > 0) {
      const validation = validateTaskDistributionTemplate(template, tasksCount)
      if (!validation.valid) {
        setTeamDistributionError(
          validation.messages[0] || 'Шаблон команды некорректен',
        )
        return
      }
    }

    setIsSavingTeamDistribution(true)
    setTeamDistributionError('')

    try {
      await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_task_distribution_template',
            gameTeamId: String(teamDistributionTarget.gameTeamId),
            taskDistributionTemplate: template.map((block) =>
              block.map((taskIndex) => taskIndex + 1),
            ),
          }),
          fallbackMessage: 'Не удалось сохранить шаблон команды',
        },
      )

      if (typeof handleRefreshTeamsModalData === 'function') {
        await handleRefreshTeamsModalData()
      }

      setTeamDistributionTarget(null)
      setTeamDistributionText('')
    } catch (error) {
      setTeamDistributionError(
        error?.message || 'Не удалось сохранить шаблон команды',
      )
    } finally {
      setIsSavingTeamDistribution(false)
    }
  }, [
    handleRefreshTeamsModalData,
    selectedGame?.id,
    selectedGame?.tasks,
    teamDistributionTarget?.gameTeamId,
    teamDistributionText,
  ])

  const handleDistributeTeamTasks = useCallback(
    async (team) => {
      if (!selectedGame?.id || !team?.id) {
        return
      }

      setDistributingTeamId(String(team.id))
      try {
        await requestApiJson('/api/cabinet/admin/task-distribution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: String(selectedGame.id),
            teamId: String(team.id),
          }),
          fallbackMessage: 'Не удалось распределить задания команды',
        })

        if (typeof handleRefreshTeamsModalData === 'function') {
          await handleRefreshTeamsModalData()
        }
      } finally {
        setDistributingTeamId('')
      }
    },
    [handleRefreshTeamsModalData, selectedGame?.id],
  )

  const handleOpenTeamStatsModal = useCallback(
    async (team) => {
      if (!team?.teamId || !selectedGame?.id) {
        return
      }
      setSelectedTeamStatsName(String(team?.teamName || 'Без названия'))
      setSelectedTeamStats(null)
      setIsTeamStatsModalOpen(true)

      try {
        const { json } = await requestApiJson(
          `/api/cabinet/admin/game-status?gameId=${encodeURIComponent(String(selectedGame.id))}`,
          {
            fallbackMessage: 'Не удалось загрузить статистику команды',
          },
        )

        const teams = Array.isArray(json?.data?.teams) ? json.data.teams : []
        const matchedTeam = teams.find(
          (item) => String(item?.teamId || '') === String(team.teamId || ''),
        )

        setSelectedTeamStats(matchedTeam?.teamProgressStats || null)
      } catch (error) {
        setSelectedTeamStats({
          error: error?.message || 'Не удалось загрузить статистику команды',
        })
      }
    },
    [selectedGame?.id],
  )

  const getManualAdjustmentRowsFromTeam = useCallback(
    (team) => {
      const timeAddings = Array.isArray(team?.timeAddings)
        ? team.timeAddings
        : []
      return timeAddings.filter(isManualAdjustmentItem).map((item, index) => {
        const rawSeconds = Number(item.time)
        const seconds = Number.isFinite(rawSeconds)
          ? Math.max(1, Math.abs(Math.round(rawSeconds)))
          : 1
        const name = String(item.name || '').trim()
        return {
          id: `manual-adjustment-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          type: rawSeconds < 0 ? 'bonus' : 'penalty',
          seconds,
          name: name || `Ручная корректировка #${index + 1}`,
          scope:
            String(item.scope || '').trim() === 'task_elapsed'
              ? 'task_elapsed'
              : 'total_adjustment',
          showInAdjustments:
            String(item.scope || '').trim() === 'task_elapsed'
              ? item.showInAdjustments !== false
              : true,
          taskIndex: Number.isInteger(Number(item.taskIndex))
            ? String(Number(item.taskIndex))
            : '',
        }
      })
    },
    [isManualAdjustmentItem],
  )

  const getSystemAdjustmentRowsFromTeam = useCallback(
    (team) => {
      const timeAddings = Array.isArray(team?.timeAddings)
        ? team.timeAddings
        : []
      const automaticRows = timeAddings
        .filter((item) => {
          const seconds = Number(item?.time)
          return (
            item &&
            typeof item === 'object' &&
            Number.isFinite(seconds) &&
            Math.round(seconds) !== 0 &&
            !isManualAdjustmentItem(item)
          )
        })
        .map((item, index) => {
          const rawSeconds = Number(item.time)
          const taskIndex = Number.isInteger(Number(item.taskIndex))
            ? Number(item.taskIndex)
            : null
          const taskLabel =
            taskIndex !== null
              ? adjustmentTaskOptions.find(
                  (option) => option.value === String(taskIndex),
                )?.label || `Задание ${taskIndex + 1}`
              : ''
          const source = String(item.source || '').trim()
          return {
            id: `system-adjustment-${index}-${source || 'legacy'}-${String(item.name || '').slice(0, 16)}`,
            type: rawSeconds < 0 ? 'bonus' : 'penalty',
            seconds: Math.max(1, Math.abs(Math.round(rawSeconds))),
            name:
              String(item.name || '').trim() ||
              `Системная корректировка #${index + 1}`,
            source,
            scope:
              String(item.scope || '').trim() === 'task_elapsed'
                ? 'task_elapsed'
                : 'total_adjustment',
            showInAdjustments: item.showInAdjustments !== false,
            taskLabel,
          }
        })

      const prequelRows = (
        Array.isArray(team?.prequelAdjustments) ? team.prequelAdjustments : []
      )
        .map((item, index) => {
          const rawSeconds = Number(item?.time)
          if (!Number.isFinite(rawSeconds) || Math.round(rawSeconds) === 0) {
            return null
          }

          const source = String(item?.source || '').trim()
          const code = String(item?.code || '').trim()
          const description = String(item?.description || '').trim()

          return {
            id:
              String(item?.id || '').trim() ||
              `prequel-adjustment-${index}-${source || 'prequel'}`,
            type: rawSeconds < 0 ? 'bonus' : 'penalty',
            seconds: Math.max(1, Math.abs(Math.round(rawSeconds))),
            name:
              String(item?.name || '').trim() ||
              (code ? `Код приквела: ${code}` : 'Корректировка приквела'),
            source,
            scope: 'total_adjustment',
            showInAdjustments: true,
            taskLabel: '',
            metaLabel:
              source === 'prequel_wrong_attempts_limit'
                ? 'Приквел · лимит неверных кодов'
                : source === 'prequel_penalty_code'
                  ? 'Приквел · штрафной код'
                  : 'Приквел · бонусный код',
            code,
            description,
          }
        })
        .filter(Boolean)

      return [...prequelRows, ...automaticRows]
    },
    [adjustmentTaskOptions, isManualAdjustmentItem],
  )

  const createEmptyManualAdjustmentRow = useCallback(() => {
    const now = Date.now()
    return {
      id: `manual-adjustment-new-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'penalty',
      seconds: 60,
      name: '',
      scope: 'total_adjustment',
      showInAdjustments: true,
      taskIndex: '',
    }
  }, [])

  const handleOpenTeamAdjustmentsModal = useCallback(
    (team) => {
      if (!team?.id) {
        return
      }

      const initialRows = getManualAdjustmentRowsFromTeam(team)
      console.info('[team-adjustments][client] open_modal', {
        gameId: String(selectedGame?.id || ''),
        gameName: String(selectedGame?.name || ''),
        gameTeamId: String(team?.id || ''),
        teamId: String(team?.teamId || ''),
        teamName: String(team?.teamName || ''),
        teamTimeAddings: Array.isArray(team?.timeAddings)
          ? team.timeAddings
          : [],
        parsedManualAdjustments: initialRows,
      })
      setTeamAdjustmentsTarget({
        gameTeamId: String(team.id),
        teamName: String(team.teamName || 'Без названия'),
        systemAdjustments: getSystemAdjustmentRowsFromTeam(team),
      })
      setTeamAdjustmentRows(initialRows)
      setTeamAdjustmentsError('')
      setIsTeamAdjustmentsModalOpen(true)
    },
    [
      getManualAdjustmentRowsFromTeam,
      getSystemAdjustmentRowsFromTeam,
      selectedGame?.id,
      selectedGame?.name,
    ],
  )

  const handleCloseTeamAdjustmentsModal = useCallback(() => {
    if (isSavingTeamAdjustments) {
      return
    }
    setIsTeamAdjustmentsModalOpen(false)
    setTeamAdjustmentsError('')
    setTeamAdjustmentsTarget(null)
    setTeamAdjustmentRows([])
    setIsAdjustmentEditorOpen(false)
  }, [isSavingTeamAdjustments])

  const handleAddTeamAdjustmentRow = useCallback(() => {
    const row = createEmptyManualAdjustmentRow()
    setAdjustmentEditorMode('create')
    setAdjustmentDraft({
      id: row.id,
      type: row.type,
      seconds: row.seconds,
      name: '',
      scope: row.scope,
      showInAdjustments: row.showInAdjustments,
      taskIndex: row.taskIndex,
    })
    setIsAdjustmentEditorOpen(true)
  }, [createEmptyManualAdjustmentRow])

  const handleRemoveTeamAdjustmentRow = useCallback((rowId) => {
    setTeamAdjustmentRows((prev) => prev.filter((row) => row.id !== rowId))
  }, [])

  const handleUpdateTeamAdjustmentRow = useCallback((rowId, patch) => {
    setTeamAdjustmentRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    )
  }, [])

  const formatAdjustmentDuration = useCallback((secondsValue) => {
    const totalSeconds = Math.max(0, Number(secondsValue) || 0)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0 && seconds > 0) {
      return `${minutes} мин ${seconds} сек`
    }
    if (minutes > 0) {
      return `${minutes} мин`
    }
    return `${seconds} сек`
  }, [])

  const handleOpenAdjustmentEditor = useCallback((row) => {
    if (!row?.id) {
      return
    }
    setAdjustmentEditorMode('edit')
    setAdjustmentDraft({
      id: row.id,
      type: row.type === 'bonus' ? 'bonus' : 'penalty',
      seconds: Math.max(1, Number(row.seconds) || 0),
      name: String(row.name || ''),
      scope: row.scope === 'task_elapsed' ? 'task_elapsed' : 'total_adjustment',
      showInAdjustments:
        row.scope === 'task_elapsed' ? row.showInAdjustments !== false : true,
      taskIndex:
        row.taskIndex !== null &&
        row.taskIndex !== undefined &&
        row.taskIndex !== '' &&
        Number.isInteger(Number(row.taskIndex))
          ? String(Number(row.taskIndex))
          : '',
    })
    setIsAdjustmentEditorOpen(true)
  }, [])

  const handleCloseAdjustmentEditor = useCallback(() => {
    if (isSavingTeamAdjustments) {
      return
    }
    setIsAdjustmentEditorOpen(false)
  }, [isSavingTeamAdjustments])

  const handleSaveAdjustmentDraft = useCallback(() => {
    const normalizedSeconds = Math.max(
      1,
      Math.round(Number(adjustmentDraft?.seconds) || 0),
    )
    const normalizedType =
      String(adjustmentDraft?.type || '')
        .trim()
        .toLowerCase() === 'bonus'
        ? 'bonus'
        : 'penalty'
    const normalizedName = String(adjustmentDraft?.name || '').trim()
    const normalizedScope =
      String(adjustmentDraft?.scope || '').trim() === 'task_elapsed'
        ? 'task_elapsed'
        : 'total_adjustment'
    const normalizedTaskIndex =
      normalizedScope === 'task_elapsed' &&
      Number.isInteger(Number(adjustmentDraft?.taskIndex))
        ? String(Number(adjustmentDraft.taskIndex))
        : ''
    const normalizedShowInAdjustments =
      normalizedScope === 'total_adjustment'
        ? true
        : Boolean(adjustmentDraft?.showInAdjustments)
    const rowId =
      typeof adjustmentDraft?.id === 'string' && adjustmentDraft.id.trim()
        ? adjustmentDraft.id
        : createEmptyManualAdjustmentRow().id

    if (adjustmentEditorMode === 'edit') {
      handleUpdateTeamAdjustmentRow(rowId, {
        type: normalizedType,
        seconds: normalizedSeconds,
        name: normalizedName,
        scope: normalizedScope,
        showInAdjustments: normalizedShowInAdjustments,
        taskIndex: normalizedTaskIndex,
      })
    } else {
      setTeamAdjustmentRows((prev) => [
        ...prev,
        {
          id: rowId,
          type: normalizedType,
          seconds: normalizedSeconds,
          name: normalizedName,
          scope: normalizedScope,
          showInAdjustments: normalizedShowInAdjustments,
          taskIndex: normalizedTaskIndex,
        },
      ])
    }

    setIsAdjustmentEditorOpen(false)
  }, [
    adjustmentDraft?.id,
    adjustmentDraft?.name,
    adjustmentDraft?.seconds,
    adjustmentDraft?.showInAdjustments,
    adjustmentDraft?.scope,
    adjustmentDraft?.taskIndex,
    adjustmentDraft?.type,
    adjustmentEditorMode,
    createEmptyManualAdjustmentRow,
    handleUpdateTeamAdjustmentRow,
  ])

  const handleSaveTeamAdjustments = useCallback(async () => {
    if (!selectedGame?.id || !teamAdjustmentsTarget?.gameTeamId) {
      setTeamAdjustmentsError('Не передан идентификатор игры или регистрации')
      return
    }

    const prepared = teamAdjustmentRows
      .map((row, index) => {
        const secondsRaw = Number(row?.seconds)
        if (!Number.isFinite(secondsRaw) || secondsRaw <= 0) {
          return null
        }
        const seconds = Math.round(secondsRaw)
        const normalizedType =
          String(row?.type || '')
            .trim()
            .toLowerCase() === 'bonus'
            ? 'bonus'
            : 'penalty'
        const rawName = String(row?.name || '').trim()
        return {
          name: rawName || `Ручная корректировка #${index + 1}`,
          time: normalizedType === 'bonus' ? -seconds : seconds,
          scope:
            row?.scope === 'task_elapsed' && row?.taskIndex !== ''
              ? 'task_elapsed'
              : 'total_adjustment',
          showInAdjustments:
            row?.scope === 'task_elapsed' && row?.taskIndex !== ''
              ? Boolean(row?.showInAdjustments)
              : true,
          taskIndex:
            row?.scope === 'task_elapsed' &&
            Number.isInteger(Number(row.taskIndex))
              ? Number(row.taskIndex)
              : null,
        }
      })
      .filter(Boolean)

    setIsSavingTeamAdjustments(true)
    setTeamAdjustmentsError('')

    try {
      await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_time_addings',
            gameTeamId: String(teamAdjustmentsTarget.gameTeamId),
            manualAdjustments: prepared,
          }),
          fallbackMessage: 'Не удалось сохранить бонусы/штрафы',
        },
      )

      if (typeof handleRefreshTeamsModalData === 'function') {
        await handleRefreshTeamsModalData()
      }

      setIsTeamAdjustmentsModalOpen(false)
      setTeamAdjustmentsTarget(null)
      setTeamAdjustmentRows([])
    } catch (error) {
      setTeamAdjustmentsError(
        error?.message || 'Не удалось сохранить бонусы/штрафы',
      )
    } finally {
      setIsSavingTeamAdjustments(false)
    }
  }, [
    handleRefreshTeamsModalData,
    selectedGame?.id,
    teamAdjustmentRows,
    teamAdjustmentsTarget?.gameTeamId,
  ])

  const handleOpenTeamEdit = useCallback((team) => {
    if (!team) {
      return
    }

    const details =
      team?.teamDetails && typeof team.teamDetails === 'object'
        ? team.teamDetails
        : {}
    const draft = {
      id: String(team?.teamId || team?.id || '').trim(),
      name: String(details?.name || team?.teamName || '').trim(),
      description: String(details?.description || team?.teamDescription || ''),
      image: String(details?.image || team?.teamImage || ''),
      open: Boolean(
        typeof details?.open === 'boolean' ? details.open : team?.open,
      ),
      location: String(details?.location || ''),
    }

    if (!draft.id) {
      setTeamEditError('Не удалось определить команду для редактирования')
      return
    }

    setTeamToEdit(draft)
    setTeamEditError('')
    setIsTeamEditModalOpen(true)
  }, [])

  const handleCloseTeamEdit = useCallback(() => {
    if (isSavingTeamEdit) {
      return
    }
    setIsTeamEditModalOpen(false)
    setTeamToEdit(null)
    setTeamEditError('')
  }, [isSavingTeamEdit])

  const handleTeamEditFieldChange = useCallback((field, value) => {
    setTeamToEdit((prev) => (prev ? { ...prev, [field]: value } : prev))
  }, [])

  const handleSaveTeamEdit = useCallback(async () => {
    if (!teamToEdit?.id || !selectedGame?.id) {
      setTeamEditError('Не передан идентификатор команды')
      return
    }
    if (!String(teamToEdit.name || '').trim()) {
      setTeamEditError('Введите название команды')
      return
    }

    setIsSavingTeamEdit(true)
    setTeamEditError('')

    try {
      await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_team_profile',
            teamId: teamToEdit.id,
            update: {
              name: String(teamToEdit.name || '').trim(),
              description: String(teamToEdit.description || ''),
              image: String(teamToEdit.image || ''),
              open: Boolean(teamToEdit.open),
              location: String(teamToEdit.location || '').trim(),
            },
          }),
          fallbackMessage: 'Не удалось сохранить изменения команды',
        },
      )

      if (typeof handleRefreshTeamsModalData === 'function') {
        await handleRefreshTeamsModalData()
      }
      setIsTeamEditModalOpen(false)
      setTeamToEdit(null)
    } catch (error) {
      setTeamEditError(
        error?.message || 'Не удалось сохранить изменения команды',
      )
    } finally {
      setIsSavingTeamEdit(false)
    }
  }, [handleRefreshTeamsModalData, selectedGame?.id, teamToEdit])

  const handleOpenTeamDetails = useCallback((team) => {
    if (!team) {
      return
    }

    const membersCount = Number.isFinite(team?.membersCount)
      ? team.membersCount
      : 0
    const fallbackTeamDetails = {
      id: team?.teamId || team?.id || '',
      name: team?.teamName || 'Без названия',
      description: team?.teamDescription || '',
      image: team?.teamImage || '',
      open: Boolean(team?.open),
      membersCount,
      gamesCount: 0,
      captain: null,
      members: [],
      games: [],
      updatedAt: team?.updatedAt || null,
      createdAt: null,
    }

    const normalizedTeamDetails = team?.teamDetails
      ? {
          ...team.teamDetails,
          id: team.teamDetails.id || fallbackTeamDetails.id,
          name: team.teamDetails.name || fallbackTeamDetails.name,
          description:
            team.teamDetails.description || fallbackTeamDetails.description,
          image: team.teamDetails.image || fallbackTeamDetails.image,
          open:
            typeof team.teamDetails.open === 'boolean'
              ? team.teamDetails.open
              : fallbackTeamDetails.open,
          membersCount: Number.isFinite(team.teamDetails.membersCount)
            ? team.teamDetails.membersCount
            : fallbackTeamDetails.membersCount,
        }
      : fallbackTeamDetails

    setSelectedTeamDetails(normalizedTeamDetails)
    setSelectedTeamDetailsId(fallbackTeamDetails.id)
    setIsTeamDetailsModalOpen(true)
  }, [])

  return (
    <>
      <Modal
        isOpen={isTeamsModalOpen}
        title={`${isPlayerMode ? 'Игроки' : 'Команды'} игры «${selectedGame?.name || 'Без названия'}»`}
        onClose={handleCloseTeamsModal}
      >
        {selectedGame ? (
          <div className="space-y-5">
            {teamsModalState.error && (
              <NoticeBanner tone="error" variant="neon">
                {teamsModalState.error}
              </NoticeBanner>
            )}
            {teamDetailsError && (
              <NoticeBanner tone="error" variant="neon">
                {teamDetailsError}
              </NoticeBanner>
            )}

            <div className="space-y-4">
              {teamsModalState.isLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {isPlayerMode
                    ? 'Загружаем список игроков…'
                    : 'Загружаем список команд…'}
                </p>
              ) : teamsModalState.gameTeams.length > 0 ? (
                <ul className="space-y-3">
                  {teamsModalState.gameTeams.map((team) => {
                    const isRemoving = removingTeamIds.includes(team.id)
                    const isUpdatingOutOfCompetition =
                      updatingOutOfCompetitionTeamIds.includes(team.id)
                    const membersCount = Number.isFinite(team?.membersCount)
                      ? team.membersCount
                      : 0
                    const ratingBadge = resolveRatingBadge(team?.rating)
                    const manualTimeAddings = Array.isArray(team?.timeAddings)
                      ? team.timeAddings.filter(isManualAdjustmentItem)
                      : []
                    const prequelAdjustments = Array.isArray(
                      team?.prequelAdjustments,
                    )
                      ? team.prequelAdjustments
                      : []
                    const penaltySeconds = manualTimeAddings.reduce(
                      (sum, item) => {
                        const value = Number(item?.time)
                        if (!Number.isFinite(value) || value <= 0) {
                          return sum
                        }
                        return sum + Math.round(value)
                      },
                      0,
                    )
                    const bonusSeconds = manualTimeAddings.reduce(
                      (sum, item) => {
                        const value = Number(item?.time)
                        if (!Number.isFinite(value) || value >= 0) {
                          return sum
                        }
                        return sum + Math.abs(Math.round(value))
                      },
                      0,
                    )
                    const prequelPenaltySeconds = prequelAdjustments.reduce(
                      (sum, item) => {
                        const value = Number(item?.time)
                        if (!Number.isFinite(value) || value <= 0) {
                          return sum
                        }
                        return sum + Math.round(value)
                      },
                      0,
                    )
                    const prequelBonusSeconds = prequelAdjustments.reduce(
                      (sum, item) => {
                        const value = Number(item?.time)
                        if (!Number.isFinite(value) || value >= 0) {
                          return sum
                        }
                        return sum + Math.abs(Math.round(value))
                      },
                      0,
                    )
                    const isRandomDistribution =
                      selectedGame?.taskDistributionMode === 'random'
                    const teamTemplate =
                      normalizeStoredTaskDistributionTemplate(
                        team?.taskDistributionTemplate,
                        Array.isArray(selectedGame?.tasks)
                          ? selectedGame.tasks.length
                          : 0,
                      )
                    const teamSequence = Array.isArray(team?.taskSequence)
                      ? team.taskSequence
                          .map((item) => Number(item))
                          .filter(Number.isInteger)
                      : []
                    const isDistributingTeam =
                      distributingTeamId === String(team.id)

                    return (
                      <li key={team.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenTeamDetails(team)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleOpenTeamDetails(team)
                            }
                          }}
                          className="w-full cursor-pointer text-left p-3 border rounded-2xl transition sm:p-4 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 hover:border-primary hover:bg-blue-50 dark:hover:border-[#7A00FF]/60 dark:hover:bg-[#110a24]"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start min-w-0 gap-3">
                              <div className="overflow-hidden border rounded-full h-11 w-11 shrink-0 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
                                <img
                                  src={
                                    team.teamImage || '/img/avatars/team.png'
                                  }
                                  alt={`Иконка команды ${team.teamName}`}
                                  className="object-cover w-full h-full"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {ratingBadge ? (
                                    <span className="px-2 py-1 text-xs font-medium border rounded-full border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                      {ratingBadge}
                                    </span>
                                  ) : null}
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${
                                      team.open
                                        ? 'border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]'
                                        : 'border-red-300 bg-red-100 text-red-700 dark:border-red-500/45 dark:bg-red-500/14 dark:text-red-200'
                                    }`}
                                    title={team.open ? 'Открыта' : 'Закрыта'}
                                  >
                                    {team.open ? (
                                      <OpenDoorIcon />
                                    ) : (
                                      <ClosedDoorIcon />
                                    )}
                                  </span>
                                  {canEditRegisteredTeams && team.paidGame ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-full border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                                      title="Команда оплатила игру"
                                    >
                                      <svg
                                        className="w-3.5 h-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <rect
                                          x="2"
                                          y="6"
                                          width="20"
                                          height="12"
                                          rx="2"
                                        />
                                        <circle cx="12" cy="12" r="2.5" />
                                        <line x1="6" y1="10" x2="6" y2="14" />
                                        <line x1="18" y1="10" x2="18" y2="14" />
                                      </svg>
                                    </span>
                                  ) : null}
                                  {team.outOfCompetition ? (
                                    <span className="px-2 py-1 text-xs font-medium border rounded-full border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                      Вне зачёта
                                    </span>
                                  ) : null}
                                  <p className="min-w-0 text-sm font-semibold break-words text-primary dark:text-slate-100">
                                    {team.teamName}
                                  </p>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  Участников: {membersCount}
                                </p>
                                {bonusSeconds > 0 || penaltySeconds > 0 ? (
                                  <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {bonusSeconds > 0 ? (
                                      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200">
                                        Бонус: -
                                        {formatDurationBadge(bonusSeconds)}
                                      </span>
                                    ) : null}
                                    {penaltySeconds > 0 ? (
                                      <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100/80 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-500/45 dark:bg-rose-500/15 dark:text-rose-200">
                                        Штраф: +
                                        {formatDurationBadge(penaltySeconds)}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {prequelBonusSeconds > 0 ||
                                prequelPenaltySeconds > 0 ? (
                                  <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {prequelBonusSeconds > 0 ? (
                                      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200">
                                        Приквел: -
                                        {formatDurationBadge(
                                          prequelBonusSeconds,
                                        )}
                                      </span>
                                    ) : null}
                                    {prequelPenaltySeconds > 0 ? (
                                      <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100/80 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-500/45 dark:bg-rose-500/15 dark:text-rose-200">
                                        Приквел: +
                                        {formatDurationBadge(
                                          prequelPenaltySeconds,
                                        )}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {isRandomDistribution ? (
                                  <div
                                    className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3 text-xs text-cyan-900 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-100"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <div className="space-y-1">
                                      <p>
                                        <span className="font-semibold">
                                          Шаблон:{' '}
                                        </span>
                                        {teamTemplate.length > 0
                                          ? formatTaskDistributionTemplate(
                                              teamTemplate,
                                            )
                                          : 'общий шаблон игры'}
                                      </p>
                                      <p>
                                        <span className="font-semibold">
                                          Маршрут:{' '}
                                        </span>
                                        {teamSequence.length > 0
                                          ? teamSequence
                                              .map((taskIndex) => taskIndex + 1)
                                              .join(' → ')
                                          : 'не распределён'}
                                      </p>
                                    </div>
                                    {canEditRegisteredTeams ? (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          className="rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-800 transition hover:border-cyan-500 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/40 dark:bg-slate-900/70 dark:text-cyan-100 dark:hover:border-cyan-300"
                                          onClick={() =>
                                            handleOpenTeamDistributionModal(
                                              team,
                                            )
                                          }
                                          disabled={isReadOnly}
                                        >
                                          Изменить шаблон
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:border-emerald-300"
                                          onClick={() =>
                                            handleDistributeTeamTasks(team)
                                          }
                                          disabled={
                                            isReadOnly || isDistributingTeam
                                          }
                                        >
                                          {isDistributingTeam
                                            ? 'Распределяем…'
                                            : 'Распределить для команды'}
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                {!isReadOnly ? (
                                  <div className="flex flex-wrap items-center gap-3 mt-2">
                                    <label
                                      className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={Boolean(team.outOfCompetition)}
                                        disabled={
                                          currentUserRole === 'client' ||
                                          isUpdatingOutOfCompetition ||
                                          teamsModalState.isLoading
                                        }
                                        onChange={(event) => {
                                          handleToggleTeamOutOfCompetition({
                                            gameTeamId: team.id,
                                            outOfCompetition: Boolean(
                                              event.target.checked,
                                            ),
                                          })
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 dark:border-slate-600"
                                      />
                                      Вне зачёта
                                    </label>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pl-14 sm:pl-0">
                              {canEditRegisteredTeams ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setTeamPrequelsTarget({
                                      gameTeamId: String(team.id || ''),
                                      teamName: String(
                                        team.teamName || 'Команда',
                                      ),
                                    })
                                  }}
                                  aria-label={`Приквелы команды ${team.teamName || ''}`}
                                  title="Приквелы команды"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:border-cyan-400 hover:bg-cyan-100 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-200 sm:h-8 sm:w-8"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    aria-hidden="true"
                                  >
                                    <path d="M4 6h16v12H4z" />
                                    <path d="m8 10 4-3 4 3v5H8z" />
                                    <path d="M10 18v-4h4v4" />
                                  </svg>
                                </button>
                              ) : null}
                              {canEditRegisteredTeams ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleOpenTeamPaymentsModal(team)
                                  }}
                                  aria-label={`Оплата команды ${team.teamName || ''}`}
                                  title="Оплата команды"
                                  className="inline-flex items-center justify-center transition border rounded-lg h-9 w-9 border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:border-emerald-400/65 dark:hover:bg-emerald-500/20 sm:h-8 sm:w-8"
                                >
                                  <TeamPaymentIcon />
                                </button>
                              ) : null}
                              {canEditRegisteredTeams &&
                              team?.teamKind !== 'personal' ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleOpenTeamEdit(team)
                                  }}
                                  aria-label={`Редактировать команду ${team.teamName || ''}`}
                                  title="Редактировать команду"
                                  className="flex items-center justify-center transition border rounded-lg w-9 h-9 border-cyan-200 bg-cyan-50 text-cyan-600 hover:border-cyan-400 hover:bg-cyan-100 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:border-cyan-400/65 dark:hover:bg-cyan-500/20 sm:h-8 sm:w-8"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M4 13.5V16h2.5L15 7.5l-2.5-2.5L4 13.5z"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M11.5 5l2.5 2.5"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </button>
                              ) : null}
                              {canEditRegisteredTeams ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleOpenTeamAdjustmentsModal(team)
                                  }}
                                  aria-label={`Редактировать бонусы и штрафы команды ${team.teamName || ''}`}
                                  title="Редактировать бонусы/штрафы за игру"
                                  className="flex items-center justify-center transition border rounded-lg w-9 h-9 border-violet-200 bg-violet-50 text-violet-600 hover:border-violet-400 hover:bg-violet-100 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:border-violet-400/65 dark:hover:bg-violet-500/20 sm:h-8 sm:w-8"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M10 3v14M3 10h14"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                    />
                                    <circle
                                      cx="10"
                                      cy="10"
                                      r="6.5"
                                      stroke="currentColor"
                                      strokeWidth="1.4"
                                      opacity="0.5"
                                    />
                                  </svg>
                                </button>
                              ) : null}
                              {canViewTeamStats ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleOpenTeamStatsModal(team)
                                  }}
                                  aria-label={`Статистика команды ${team.teamName || ''}`}
                                  title="Статистика команды"
                                  className="flex items-center justify-center text-indigo-600 transition border border-indigo-200 rounded-lg w-9 h-9 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-500/35 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:border-indigo-400/65 dark:hover:bg-indigo-500/20 sm:h-8 sm:w-8"
                                >
                                  <TeamStatsIcon />
                                </button>
                              ) : null}
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    // Временное ограничение: обычные пользователи не могут удалять команды
                                    if (currentUserRole === 'client') {
                                      setIsRestrictedDeleteModalOpen(true)
                                      setRestrictedDeleteTeamName(
                                        team.teamName || 'Без названия',
                                      )
                                      return
                                    }
                                    if (typeof window !== 'undefined') {
                                      const confirmed = window.confirm(
                                        `Удалить команду «${team.teamName || 'Без названия'}» из игры?`,
                                      )
                                      if (!confirmed) {
                                        return
                                      }
                                    }
                                    handleRemoveTeamFromGame(team.id)
                                  }}
                                  disabled={
                                    isRemoving ||
                                    isUpdatingOutOfCompetition ||
                                    teamsModalState.isLoading
                                  }
                                  aria-label={`Удалить команду ${team.teamName || ''} из игры`}
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition sm:h-8 sm:w-8
                                    ${
                                      isRemoving || teamsModalState.isLoading
                                        ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
                                        : 'border-red-200 bg-red-50 text-red-500 hover:border-red-400 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:border-red-400/60 dark:hover:bg-red-500/20'
                                    }`}
                                >
                                  {isRemoving ? (
                                    <svg
                                      className="w-4 h-4 animate-spin"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      className="w-4 h-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.75"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          {canEditRegisteredTeams ? (
                            <div className="flex justify-end mt-3">
                              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                                Оплачено: {formatMoney(team.totalPaid)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {isPlayerMode
                    ? 'Пока ни один игрок не зарегистрирован на эту игру.'
                    : 'Пока ни одна команда не зарегистрирована на эту игру.'}
                </p>
              )}
            </div>

            {canAddTeams && (
              <FormSectionCard className="p-4 bg-slate-50 dark:bg-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Добавить команду
                </h3>
                {teamsModalState.availableTeams.length > 0 ? (
                  <div className="flex flex-col gap-3 mt-3 sm:flex-row sm:items-center">
                    <div className="w-full">
                      <TeamSelectField
                        label={null}
                        teams={teamsModalState.availableTeams}
                        selectedTeamId={selectedTeamToAdd}
                        onSelect={setSelectedTeamToAdd}
                        onClear={() => setSelectedTeamToAdd('')}
                        disabled={isAddingTeam || teamsModalState.isLoading}
                        placeholder="Выбрать команду"
                        modalTitle="Выбор команды для добавления в игру"
                        searchPlaceholder="Поиск по ID команды, названию, имени участника или телефону"
                      />
                    </div>
                    <CabinetButton
                      onClick={handleAddTeamToGame}
                      disabled={
                        !selectedAvailableTeam?.id ||
                        isAddingTeam ||
                        teamsModalState.isLoading
                      }
                      variant="primary"
                      size="md"
                      className={`inline-flex justify-center ${
                        isAddingTeam ? 'cursor-wait' : ''
                      }`}
                    >
                      {isAddingTeam ? 'Добавление…' : 'Добавить'}
                    </CabinetButton>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Свободных команд не найдено. Создайте команду или освободите
                    её от участия в игре.
                  </p>
                )}
              </FormSectionCard>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Игра не выбрана. Закройте окно и выберите игру снова.
          </p>
        )}
      </Modal>
      <TeamDescriptionModal
        isOpen={isTeamDetailsModalOpen}
        onClose={closeTeamDetailsModal}
        selectedTeam={resolvedSelectedTeamDetails}
      />
      <TeamGamePaymentsModal
        isOpen={isTeamPaymentsModalOpen}
        onClose={() => {
          setIsTeamPaymentsModalOpen(false)
          setTeamPaymentsTarget(null)
        }}
        selectedGame={selectedGame}
        target={teamPaymentsTarget}
        updatingPaidGameTeamIds={updatingPaidGameTeamIds}
        onPaidGameChange={handleToggleTeamPaidGame}
        onPaymentsChanged={handleRefreshTeamsModalData}
      />
      <TeamPrequelsModal
        isOpen={Boolean(teamPrequelsTarget)}
        onClose={() => setTeamPrequelsTarget(null)}
        gameId={String(selectedGame?.id || '')}
        gameTeamId={teamPrequelsTarget?.gameTeamId || ''}
        teamName={teamPrequelsTarget?.teamName || ''}
        onUpdated={handleRefreshTeamsModalData}
      />
      <Modal
        isOpen={Boolean(teamDistributionTarget)}
        onClose={handleCloseTeamDistributionModal}
        title={`Шаблон заданий — ${teamDistributionTarget?.teamName || 'Команда'}`}
        footer={
          <>
            <button
              type="button"
              className="aq-modal-btn aq-modal-btn-secondary"
              onClick={handleCloseTeamDistributionModal}
              disabled={isSavingTeamDistribution}
            >
              Отмена
            </button>
            <button
              type="button"
              className={`aq-modal-btn aq-modal-btn-primary ${isSavingTeamDistribution ? 'cursor-wait' : ''}`}
              onClick={handleSaveTeamDistributionTemplate}
              disabled={isSavingTeamDistribution}
            >
              {isSavingTeamDistribution ? 'Сохранение…' : 'Сохранить'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {teamDistributionError ? (
            <NoticeBanner tone="error" variant="neon">
              {teamDistributionError}
            </NoticeBanner>
          ) : null}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Пустое поле использует общий шаблон игры. После изменения нажмите
            «Распределить для команды».
          </p>
          <div>
            <label
              htmlFor="team-task-distribution-template"
              className="text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Шаблон
            </label>
            <textarea
              id="team-task-distribution-template"
              rows={4}
              value={teamDistributionText}
              onChange={(event) => setTeamDistributionText(event.target.value)}
              placeholder="[1,2],[3,4,5],[6,7,8],[9,10]"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              disabled={isSavingTeamDistribution}
            />
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isRestrictedDeleteModalOpen}
        onClose={closeRestrictedDeleteModal}
        title="Удаление команды запрещено"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Удаление команды <strong>«{restrictedDeleteTeamName}»</strong>{' '}
            невозможно.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Для удаления команды из игры необходимо обратиться к администратору
            проекта.
          </p>
        </div>
      </Modal>
      <Modal
        isOpen={isTeamEditModalOpen}
        onClose={handleCloseTeamEdit}
        title={`Редактирование команды «${teamToEdit?.name || 'Без названия'}»`}
        footer={
          <>
            <button
              type="button"
              className="aq-modal-btn aq-modal-btn-secondary"
              onClick={handleCloseTeamEdit}
              disabled={isSavingTeamEdit}
            >
              Отмена
            </button>
            <button
              type="button"
              className={`aq-modal-btn aq-modal-btn-primary ${isSavingTeamEdit ? 'cursor-wait' : ''}`}
              onClick={handleSaveTeamEdit}
              disabled={isSavingTeamEdit}
            >
              {isSavingTeamEdit ? 'Сохранение…' : 'Сохранить и закрыть'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {teamEditError ? (
            <NoticeBanner tone="error" variant="neon">
              {teamEditError}
            </NoticeBanner>
          ) : null}
          <div>
            <label
              htmlFor="game-team-edit-name"
              className="text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Название команды
            </label>
            <input
              id="game-team-edit-name"
              type="text"
              value={teamToEdit?.name || ''}
              onChange={(event) =>
                handleTeamEditFieldChange('name', event.target.value)
              }
              className="w-full px-4 py-2 mt-2 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </div>
          <CabinetSelectField
            id="game-team-edit-location"
            label="Город команды"
            value={teamToEdit?.location || ''}
            onChange={(event) =>
              handleTeamEditFieldChange('location', event.target.value)
            }
            labelClassName="text-sm font-semibold text-slate-700 dark:text-slate-100"
            selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">Не указан</option>
            {locationOptions.map((locationOption) => (
              <option key={locationOption.value} value={locationOption.value}>
                {locationOption.label}
              </option>
            ))}
          </CabinetSelectField>
          <div>
            <label
              htmlFor="game-team-edit-description"
              className="text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Описание
            </label>
            <textarea
              id="game-team-edit-description"
              value={teamToEdit?.description || ''}
              rows={4}
              onChange={(event) =>
                handleTeamEditFieldChange('description', event.target.value)
              }
              className="w-full px-4 py-2 mt-2 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-100">
              Логотип команды
            </label>
            <div className="mt-2">
              <ImagesInput
                images={teamToEdit?.image ? [teamToEdit.image] : []}
                onChange={(nextImages) =>
                  handleTeamEditFieldChange('image', nextImages?.[0] ?? '')
                }
                directory="teams"
                imageName={teamToEdit?.id || 'team'}
                maxImages={1}
                previewShape="circle"
                disabled={isSavingTeamEdit}
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(teamToEdit?.open)}
              onChange={(event) =>
                handleTeamEditFieldChange('open', event.target.checked)
              }
              className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400 dark:border-slate-600"
            />
            Команда открыта для вступления
          </label>
        </div>
      </Modal>
      <Modal
        isOpen={isTeamAdjustmentsModalOpen}
        onClose={handleCloseTeamAdjustmentsModal}
        title={`Бонусы/штрафы — ${teamAdjustmentsTarget?.teamName || 'Команда'}`}
        footer={
          <>
            <button
              type="button"
              className="aq-modal-btn aq-modal-btn-secondary"
              onClick={handleCloseTeamAdjustmentsModal}
              disabled={isSavingTeamAdjustments}
            >
              Отмена
            </button>
            <button
              type="button"
              className={`aq-modal-btn aq-modal-btn-primary ${isSavingTeamAdjustments ? 'cursor-wait' : ''}`}
              onClick={handleSaveTeamAdjustments}
              disabled={isSavingTeamAdjustments}
            >
              {isSavingTeamAdjustments ? 'Сохранение…' : 'Сохранить и закрыть'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {teamAdjustmentsError ? (
            <NoticeBanner tone="error" variant="neon">
              {teamAdjustmentsError}
            </NoticeBanner>
          ) : null}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Здесь можно задать только ручные корректировки за игру. Бонус
            уменьшает итоговое время, штраф увеличивает.
          </p>
          {Array.isArray(teamAdjustmentsTarget?.systemAdjustments) &&
          teamAdjustmentsTarget.systemAdjustments.length > 0 ? (
            <div className="p-3 border rounded-2xl border-cyan-200 bg-cyan-50/70 dark:border-cyan-500/35 dark:bg-cyan-500/10">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">
                  Системные корректировки
                </h4>
                <span className="text-xs text-cyan-700 dark:text-cyan-200/80">
                  Только просмотр
                </span>
              </div>
              <div className="space-y-2">
                {teamAdjustmentsTarget.systemAdjustments.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      row.type === 'bonus'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100'
                        : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {row.name || 'Системная корректировка'}
                      </span>
                      <span className="font-mono font-semibold">
                        {row.type === 'bonus' ? '−' : '+'}
                        {formatAdjustmentDuration(row.seconds)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs opacity-80">
                      {row.taskLabel ? <span>{row.taskLabel}</span> : null}
                      {row.metaLabel ? <span>{row.metaLabel}</span> : null}
                      <span>
                        {row.scope === 'task_elapsed'
                          ? 'Учитывается во времени задания'
                          : 'Общая корректировка'}
                      </span>
                      {row.showInAdjustments ? (
                        <span>Видна в результатах</span>
                      ) : (
                        <span>Скрыта из результатов</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            {teamAdjustmentRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Ручные корректировки пока не добавлены.
              </p>
            ) : (
              teamAdjustmentRows.map((row, index) => (
                <div
                  key={row.id}
                  className="relative p-3 pt-8 overflow-hidden border rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <span
                    className={`absolute left-0 top-0 inline-flex items-center rounded-br-full border-b border-r px-3 py-0.5 text-[11px] font-semibold ${
                      row.type === 'bonus'
                        ? 'border-emerald-300 bg-emerald-100/80 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-200'
                        : 'border-rose-300 bg-rose-100/80 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-200'
                    }`}
                  >
                    {row.type === 'bonus' ? 'Бонус' : 'Штраф'}
                  </span>
                  {row.scope === 'task_elapsed' ? (
                    <span className="absolute left-20 top-0 inline-flex items-center rounded-b-lg border-b border-x border-cyan-300 bg-cyan-100/80 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/45 dark:bg-cyan-500/15 dark:text-cyan-200">
                      Время задания
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleRemoveTeamAdjustmentRow(row.id)}
                    disabled={isSavingTeamAdjustments}
                    className="absolute inline-flex items-center justify-center transition border rounded-lg right-3 top-2 h-7 w-7 border-rose-200 bg-rose-50 text-rose-500 hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/65 dark:hover:bg-rose-500/20"
                    aria-label="Удалить корректировку"
                    title="Удалить корректировку"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 6h14"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M6 6l.7 9.2A1.5 1.5 0 0 0 8.2 16.6h3.6a1.5 1.5 0 0 0 1.5-1.4L14 6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 6V4.8c0-.45.35-.8.8-.8h2.4c.45 0 .8.35.8.8V6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8.8 8.5v5M11.2 8.5v5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAdjustmentEditor(row)}
                    disabled={isSavingTeamAdjustments}
                    className="absolute inline-flex items-center justify-center transition border rounded-lg right-11 top-2 h-7 w-7 border-cyan-200 bg-cyan-50 text-cyan-600 hover:border-cyan-400 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:border-cyan-400/65 dark:hover:bg-cyan-500/20"
                    aria-label="Редактировать корректировку"
                    title="Редактировать корректировку"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 13.5V16h2.5L15 7.5l-2.5-2.5L4 13.5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M11.5 5l2.5 2.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  <div className="space-y-1">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {String(row.name || '').trim() ||
                          `Корректировка #${index + 1}`}
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          row.type === 'bonus'
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-rose-600 dark:text-rose-300'
                        }`}
                      >
                        {row.type === 'bonus' ? '−' : '+'}
                        {formatAdjustmentDuration(row.seconds)}
                      </p>
                      {row.scope === 'task_elapsed' ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {adjustmentTaskOptions.find(
                            (option) => option.value === String(row.taskIndex),
                          )?.label || 'Задание не выбрано'}
                          {row.showInAdjustments
                            ? ' · видно в корректировках'
                            : ' · скрыто из корректировок'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={handleAddTeamAdjustmentRow}
              className="aq-modal-btn aq-modal-btn-secondary"
              disabled={isSavingTeamAdjustments}
            >
              Добавить корректировку
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isAdjustmentEditorOpen}
        onClose={handleCloseAdjustmentEditor}
        title={
          adjustmentEditorMode === 'edit'
            ? 'Редактирование корректировки'
            : 'Новая корректировка'
        }
        footer={
          <>
            <button
              type="button"
              className="aq-modal-btn aq-modal-btn-secondary"
              onClick={handleCloseAdjustmentEditor}
              disabled={isSavingTeamAdjustments}
            >
              Отмена
            </button>
            <button
              type="button"
              className="aq-modal-btn aq-modal-btn-primary"
              onClick={handleSaveAdjustmentDraft}
              disabled={
                isSavingTeamAdjustments ||
                (adjustmentDraft.scope === 'task_elapsed' &&
                  adjustmentDraft.taskIndex === '')
              }
            >
              Готово
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
              Тип
            </label>
            <select
              value={adjustmentDraft.type}
              onChange={(event) =>
                setAdjustmentDraft((prev) => ({
                  ...prev,
                  type: event.target.value === 'bonus' ? 'bonus' : 'penalty',
                }))
              }
              className="w-full px-3 py-2 mt-1 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            >
              <option value="penalty">Штраф</option>
              <option value="bonus">Бонус</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
              Применение
            </label>
            <select
              value={adjustmentDraft.scope}
              onChange={(event) => {
                const nextScope =
                  event.target.value === 'task_elapsed'
                    ? 'task_elapsed'
                    : 'total_adjustment'
                setAdjustmentDraft((prev) => ({
                  ...prev,
                  scope: nextScope,
                  showInAdjustments:
                    nextScope === 'total_adjustment'
                      ? true
                      : Boolean(prev.showInAdjustments),
                  taskIndex: nextScope === 'task_elapsed' ? prev.taskIndex : '',
                }))
              }}
              className="w-full px-3 py-2 mt-1 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            >
              <option value="total_adjustment">Итог игры</option>
              <option value="task_elapsed">Время задания</option>
            </select>
          </div>
          {adjustmentDraft.scope === 'task_elapsed' ? (
            <>
              <div>
                <label className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
                  Задание
                </label>
                <select
                  value={adjustmentDraft.taskIndex}
                  onChange={(event) =>
                    setAdjustmentDraft((prev) => ({
                      ...prev,
                      taskIndex: event.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 mt-1 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                >
                  <option value="">Выберите задание</option>
                  {adjustmentTaskOptions.map((option, index) => (
                    <option
                      key={`adjustment-task-${index}`}
                      value={option.value}
                    >
                      {index + 1}. {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-3 px-3 py-2 text-sm border rounded-xl border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(adjustmentDraft.showInAdjustments)}
                  onChange={(event) =>
                    setAdjustmentDraft((prev) => ({
                      ...prev,
                      showInAdjustments: event.target.checked,
                    }))
                  }
                  className="w-4 h-4 mt-1 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>Показать в блоке дополнительных корректировок</span>
              </label>
            </>
          ) : (
            <p className="px-3 text-xs text-slate-500 dark:text-slate-400">
              Корректировка итога игры всегда показывается в дополнительных
              корректировках.
            </p>
          )}
          <div>
            <label className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
              Комментарий
            </label>
            <input
              type="text"
              value={adjustmentDraft.name}
              onChange={(event) =>
                setAdjustmentDraft((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              className="w-full px-3 py-2 mt-1 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              placeholder="Комментарий корректировки"
            />
          </div>
          <CabinetDurationField
            id="team-adjustment-draft-duration"
            label="Время"
            valueSeconds={adjustmentDraft.seconds}
            onChangeSeconds={(nextSeconds) =>
              setAdjustmentDraft((prev) => ({
                ...prev,
                seconds: Math.max(1, Number(nextSeconds) || 0),
              }))
            }
            disabled={isSavingTeamAdjustments}
            minutesLabel="мин"
            secondsLabel="сек"
          />
        </div>
      </Modal>
      <GameControlTeamStatsModal
        isOpen={isTeamStatsModalOpen}
        onClose={handleCloseTeamStatsModal}
        teamName={selectedTeamStatsName}
        stats={
          selectedTeamStats &&
          typeof selectedTeamStats === 'object' &&
          !selectedTeamStats.error
            ? selectedTeamStats
            : null
        }
      />
    </>
  )
}

const teamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  teamName: PropTypes.string,
  teamDescription: PropTypes.string,
  teamImage: PropTypes.string,
  teamKind: PropTypes.oneOf(['regular', 'personal']),
  teamId: PropTypes.string,
  open: PropTypes.bool,
  outOfCompetition: PropTypes.bool,
  paidGame: PropTypes.bool,
  totalPaid: PropTypes.number,
  updatedAt: PropTypes.string,
  membersCount: PropTypes.number,
  rating: PropTypes.shape({
    rank: PropTypes.number,
    isEligible: PropTypes.bool,
  }),
  teamDetails: PropTypes.object,
  timeAddings: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      time: PropTypes.number,
      source: PropTypes.string,
      scope: PropTypes.string,
      showInAdjustments: PropTypes.bool,
      taskIndex: PropTypes.number,
      taskId: PropTypes.string,
    }),
  ),
  prequelAdjustments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      time: PropTypes.number,
      source: PropTypes.string,
      scope: PropTypes.string,
      showInAdjustments: PropTypes.bool,
      code: PropTypes.string,
      description: PropTypes.string,
      createdAt: PropTypes.string,
    }),
  ),
})

const availableTeamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  description: PropTypes.string,
  members: PropTypes.array,
  membersCount: PropTypes.number,
})

GameTeamsModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    status: PropTypes.string,
    participationMode: PropTypes.oneOf(['team', 'player']),
    tasks: PropTypes.array,
  }),
  isTeamsModalOpen: PropTypes.bool.isRequired,
  handleCloseTeamsModal: PropTypes.func.isRequired,
  teamsModalState: PropTypes.shape({
    isLoading: PropTypes.bool.isRequired,
    error: PropTypes.string,
    gameTeams: PropTypes.arrayOf(teamShape).isRequired,
    availableTeams: PropTypes.arrayOf(availableTeamShape).isRequired,
  }).isRequired,
  removingTeamIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  updatingOutOfCompetitionTeamIds: PropTypes.arrayOf(PropTypes.string)
    .isRequired,
  updatingPaidGameTeamIds: PropTypes.arrayOf(PropTypes.string),
  selectedTeamToAdd: PropTypes.string,
  setSelectedTeamToAdd: PropTypes.func.isRequired,
  handleAddTeamToGame: PropTypes.func.isRequired,
  isAddingTeam: PropTypes.bool.isRequired,
  handleRemoveTeamFromGame: PropTypes.func.isRequired,
  handleToggleTeamOutOfCompetition: PropTypes.func.isRequired,
  handleToggleTeamPaidGame: PropTypes.func,
  handleRefreshTeamsModalData: PropTypes.func,
  currentUserRole: PropTypes.string,
  isReadOnly: PropTypes.bool,
}

GameTeamsModal.defaultProps = {
  selectedGame: null,
  selectedTeamToAdd: '',
  updatingPaidGameTeamIds: [],
  handleToggleTeamPaidGame: undefined,
  handleRefreshTeamsModalData: undefined,
  currentUserRole: null,
}

export default memo(GameTeamsModal)
