import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import Modal from '@components/Modal'
import getSessionSafe from '@helpers/getSessionSafe'
import formatDate from '@helpers/formatDate'
import formatDateTime from '@helpers/formatDateTime'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import { getNounBonusTasks, getNounTasks, getNounTeams } from '@helpers/getNoun'
import dbConnect from '@utils/dbConnect'

const GAME_STATUS_OPTIONS = ['active', 'started', 'finished', 'canceled'].map((value) => ({
  value,
  label: getGameStatusLabel(value),
}))

const GAME_STATUS_BADGE_STYLES = {
  active: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100',
  started: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
  finished: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100',
  canceled: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100',
}

const getStatusBadgeClassName = (status) => {
  if (!status) {
    return 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-100'
  }

  const normalized = typeof status === 'string' ? status.toLowerCase() : String(status)

  return (
    GAME_STATUS_BADGE_STYLES[normalized] ??
    'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-100'
  )
}

const GAME_TYPE_OPTIONS = [
  { value: 'classic', label: 'Классика' },
  { value: 'photo', label: 'Фотоквест' },
]

const CLUE_EARLY_MODE_OPTIONS = [
  { value: 'time', label: 'Добавить время до следующей подсказки' },
  { value: 'penalty', label: 'Штраф организатора за подсказку' },
]

const toMinutes = (seconds) => {
  const numeric = Number(seconds)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return Math.round(numeric / 60)
}

const toSeconds = (minutes) => {
  const numeric = Number(minutes)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return Math.round(numeric * 60)
}

const createPrice = () => ({
  id: `price-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  price: 0,
})

const createFinanceEntry = () => {
  const now = new Date()
  return {
    id: `finance-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'income',
    sum: 0,
    date: now.toISOString(),
    description: '',
  }
}

const createClue = () => ({
  id: `clue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  clue: '',
  images: [],
})

const createSubTask = () => ({
  id: `subtask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  name: '',
  task: '',
  bonus: 0,
})

const createPenaltyCode = () => ({
  id: `penalty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  code: '',
  penalty: 0,
  description: '',
})

const createBonusCode = () => ({
  id: `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  code: '',
  bonus: 0,
  description: '',
})

const createTask = () => ({
  id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  title: '',
  task: '',
  taskBonusForComplite: 0,
  clues: [],
  subTasks: [],
  images: [],
  codes: [],
  coordinates: { latitude: null, longitude: null, radius: null },
  penaltyCodes: [],
  bonusCodes: [],
  numCodesToCompliteTask: null,
  postMessage: '',
  canceled: false,
  isBonusTask: false,
})

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const sanitizeStringArray = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item !== '')

const serializeGameForComparison = (game) => {
  if (!game) {
    return null
  }

  return JSON.stringify(
    buildUpdatePayload({
      ...game,
      prices: game.prices ?? [],
      finances: game.finances ?? [],
      tasks: game.tasks ?? [],
    })
  )
}

const buildUpdatePayload = (game) => {
  const prices = (game.prices ?? []).map((price) => ({
    id: price.id,
    name: price.name,
    price: Number(price.price) || 0,
  }))

  const finances = (game.finances ?? []).map((entry) => ({
    id: entry.id,
    type: entry.type === 'expense' ? 'expense' : 'income',
    sum: Number(entry.sum) || 0,
    date: entry.date ? new Date(entry.date).toISOString() : null,
    description: entry.description,
  }))

  const tasks = (game.tasks ?? []).map((task) => {
    const normalizedCoordinates = {
      latitude: toNullableNumber(task.coordinates?.latitude),
      longitude: toNullableNumber(task.coordinates?.longitude),
      radius: toNullableNumber(task.coordinates?.radius),
    }

    const hasCoordinatesValue =
      normalizedCoordinates.latitude !== null ||
      normalizedCoordinates.longitude !== null ||
      normalizedCoordinates.radius !== null

    const baseTask = {
      title: typeof task.title === 'string' ? task.title : '',
      task: typeof task.task === 'string' ? task.task : '',
      taskBonusForComplite: Number(task.taskBonusForComplite) || 0,
      clues: (task.clues ?? []).map((clue) => {
        const normalizedClue = {
          clue: typeof clue.clue === 'string' ? clue.clue : '',
          images: sanitizeStringArray(clue.images),
        }

        if (clue.mongoId) {
          normalizedClue._id = clue.mongoId
        }

        return normalizedClue
      }),
      subTasks: (task.subTasks ?? []).map((subTask) => {
        const normalizedSubTask = {
          name: typeof subTask.name === 'string' ? subTask.name : '',
          task: typeof subTask.task === 'string' ? subTask.task : '',
          bonus: Number(subTask.bonus) || 0,
        }

        if (subTask.mongoId) {
          normalizedSubTask._id = subTask.mongoId
        }

        return normalizedSubTask
      }),
      images: sanitizeStringArray(task.images),
      codes: sanitizeStringArray(task.codes),
      coordinates: hasCoordinatesValue
        ? normalizedCoordinates
        : { latitude: null, longitude: null, radius: null },
      penaltyCodes: (task.penaltyCodes ?? []).map((penalty) => {
        const normalizedPenalty = {
          code: typeof penalty.code === 'string' ? penalty.code : '',
          penalty: Number(penalty.penalty) || 0,
          description: typeof penalty.description === 'string' ? penalty.description : '',
        }

        if (penalty.mongoId) {
          normalizedPenalty._id = penalty.mongoId
        }

        return normalizedPenalty
      }),
      bonusCodes: (task.bonusCodes ?? []).map((bonus) => {
        const normalizedBonus = {
          code: typeof bonus.code === 'string' ? bonus.code : '',
          bonus: Number(bonus.bonus) || 0,
          description: typeof bonus.description === 'string' ? bonus.description : '',
        }

        if (bonus.mongoId) {
          normalizedBonus._id = bonus.mongoId
        }

        return normalizedBonus
      }),
      numCodesToCompliteTask: toNullableNumber(task.numCodesToCompliteTask),
      postMessage: typeof task.postMessage === 'string' ? task.postMessage : '',
      canceled: Boolean(task.canceled),
      isBonusTask: Boolean(task.isBonusTask),
    }

    if (task.mongoId) {
      return { ...baseTask, _id: task.mongoId }
    }

    return baseTask
  })

  const manyCodesPenalty = Array.isArray(game.manyCodesPenalty)
    ? [Number(game.manyCodesPenalty[0]) || 0, Number(game.manyCodesPenalty[1]) || 0]
    : [0, 0]

  return {
    name: game.name,
    status: game.status,
    dateStart: game.dateStart ? new Date(game.dateStart).toISOString() : null,
    type: game.type,
    description: game.description,
    image: game.image ? game.image : null,
    startingPlace: game.startingPlace ?? '',
    finishingPlace: game.finishingPlace ?? '',
    taskDuration: Number(game.taskDuration) || 0,
    cluesDuration: Number(game.cluesDuration) || 0,
    clueEarlyAccessMode: game.clueEarlyAccessMode,
    clueEarlyPenalty: Number(game.clueEarlyPenalty) || 0,
    allowCaptainForceClue: Boolean(game.allowCaptainForceClue),
    allowCaptainFailTask: Boolean(game.allowCaptainFailTask),
    allowCaptainFinishBreak: Boolean(game.allowCaptainFinishBreak),
    breakDuration: Number(game.breakDuration) || 0,
    taskFailurePenalty: Number(game.taskFailurePenalty) || 0,
    manyCodesPenalty,
    individualStart: Boolean(game.individualStart),
    hidden: Boolean(game.hidden),
    showCreator: Boolean(game.showCreator),
    showTasks: Boolean(game.showTasks),
    hideResult: Boolean(game.hideResult),
    prices,
    finances,
    tasks,
  }
}

const GamesPage = ({ initialGames, initialLocation, session: initialSession }) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const userRole = activeSession?.user?.role ?? 'client'
  const currentUserTelegramId = activeSession?.user?.telegramId ?? null
  const currentUserIdString =
    currentUserTelegramId === null || currentUserTelegramId === undefined
      ? null
      : String(currentUserTelegramId)

  const [games, setGames] = useState(initialGames)
  const [persistedGames, setPersistedGames] = useState(initialGames)
  const [selectedGameId, setSelectedGameId] = useState(initialGames[0]?.id ?? null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState([])
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false)
  const [teamsModalState, setTeamsModalState] = useState({
    isLoading: false,
    error: null,
    gameTeams: [],
    availableTeams: [],
  })
  const [selectedTeamToAdd, setSelectedTeamToAdd] = useState('')
  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const [removingTeamIds, setRemovingTeamIds] = useState([])

  useEffect(() => {
    setGames(initialGames)
    setPersistedGames(initialGames)
    setSelectedGameId((prev) => {
      if (prev && initialGames.some((game) => game.id === prev)) {
        return prev
      }
      return initialGames[0]?.id ?? null
    })
  }, [initialGames])

  useEffect(() => {
    setFeedback(null)
  }, [selectedGameId])

  useEffect(() => {
    setIsEditModalOpen(false)
  }, [selectedGameId])

  useEffect(() => {
    setExpandedTaskIds([])
    setIsTeamsModalOpen(false)
    setTeamsModalState({
      isLoading: false,
      error: null,
      gameTeams: [],
      availableTeams: [],
    })
    setSelectedTeamToAdd('')
    setRemovingTeamIds([])
  }, [selectedGameId])

  const numberFormatter = useMemo(() => new Intl.NumberFormat('ru-RU'), [])
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
      }),
    []
  )

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId]
  )

  useEffect(() => {
    if (!selectedGame) {
      setExpandedTaskIds([])
      return
    }

    setExpandedTaskIds((prev) =>
      prev.filter((taskId) =>
        (selectedGame.tasks ?? []).some((task) => task.id === taskId)
      )
    )
  }, [selectedGame])

  const persistedSelectedGame = useMemo(
    () => persistedGames.find((game) => game.id === selectedGameId) ?? null,
    [persistedGames, selectedGameId]
  )

  const isDirty = useMemo(() => {
    if (!selectedGame || !persistedSelectedGame) {
      return false
    }

    return (
      serializeGameForComparison(selectedGame) !==
      serializeGameForComparison(persistedSelectedGame)
    )
  }, [persistedSelectedGame, selectedGame])

  const canEditAllGames = userRole === 'admin' || userRole === 'dev'
  const canEditOwnGames = userRole === 'moder'

  const canEditSelectedGame = useMemo(() => {
    if (!selectedGame) {
      return false
    }

    if (canEditAllGames) {
      return true
    }

    if (canEditOwnGames) {
      if (!currentUserIdString) {
        return false
      }

      const creatorId = selectedGame.creatorTelegramId
      if (!creatorId) {
        return false
      }

      return creatorId === currentUserIdString
    }

    return false
  }, [canEditAllGames, canEditOwnGames, currentUserIdString, selectedGame])

  const canViewRestrictedGameInfo = canEditSelectedGame

  const canManageTeams = canViewRestrictedGameInfo

  const editRestrictionMessage = useMemo(() => {
    if (!selectedGame || canEditSelectedGame) {
      return null
    }

    if (canEditOwnGames) {
      const creatorId = selectedGame?.creatorTelegramId ?? ''
      if (currentUserIdString && creatorId && creatorId !== currentUserIdString) {
        return 'Эта игра создана другим организатором. Модераторы могут редактировать только собственные игры.'
      }
    }

    return 'Недостаточно прав для редактирования игры. Обратитесь к администратору.'
  }, [canEditOwnGames, canEditSelectedGame, currentUserIdString, selectedGame])

  const updateSelectedGame = useCallback(
    (updater) => {
      if (!selectedGameId || !canEditSelectedGame) return

      setGames((prevGames) =>
        prevGames.map((game) => {
          if (game.id !== selectedGameId) {
            return game
          }

          const patch = typeof updater === 'function' ? updater(game) : updater
          return { ...game, ...patch }
        })
      )
    },
    [canEditSelectedGame, selectedGameId]
  )

  const handleResetChanges = useCallback(() => {
    if (!selectedGameId) return

    setGames((prevGames) =>
      prevGames.map((game) => {
        if (game.id !== selectedGameId) {
          return game
        }

        const original = persistedGames.find((item) => item.id === selectedGameId)
        return original ? { ...original } : game
      })
    )
    setFeedback(null)
  }, [persistedGames, selectedGameId])

  const handleSaveChanges = useCallback(async () => {
    if (!selectedGame || !location || !canEditSelectedGame) return

    setIsSaving(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/${location}/games/${selectedGame.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: buildUpdatePayload(selectedGame) }),
      })

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось сохранить игру')
      }

      const normalizedGame = normalizeGameForCabinet({
        ...json.data,
        teamsCount: selectedGame.teamsCount,
      })

      setGames((prevGames) =>
        prevGames.map((game) => (game.id === normalizedGame.id ? normalizedGame : game))
      )
      setPersistedGames((prevGames) =>
        prevGames.map((game) => (game.id === normalizedGame.id ? normalizedGame : game))
      )
      setFeedback({ type: 'success', message: 'Изменения сохранены' })
      setIsEditModalOpen(false)
    } catch (error) {
      console.error('Failed to update game', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить игру',
      })
    } finally {
      setIsSaving(false)
    }
  }, [canEditSelectedGame, location, selectedGame])

  const handleAddPrice = useCallback(() => {
    if (!canEditSelectedGame) return
    updateSelectedGame((game) => ({
      prices: [...(game.prices ?? []), createPrice()],
    }))
  }, [canEditSelectedGame, updateSelectedGame])

  const handlePriceChange = useCallback(
    (priceId, field, value) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        prices: (game.prices ?? []).map((price) =>
          price.id === priceId
            ? {
                ...price,
                [field]: field === 'price' ? Math.max(0, Number(value) || 0) : value,
              }
            : price
        ),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleRemovePrice = useCallback(
    (priceId) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        prices: (game.prices ?? []).filter((price) => price.id !== priceId),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleAddFinance = useCallback(() => {
    if (!canEditSelectedGame) return
    updateSelectedGame((game) => ({
      finances: [...(game.finances ?? []), createFinanceEntry()],
    }))
  }, [canEditSelectedGame, updateSelectedGame])

  const handleFinanceChange = useCallback(
    (financeId, field, value) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        finances: (game.finances ?? []).map((entry) => {
          if (entry.id !== financeId) {
            return entry
          }

          if (field === 'sum') {
            return { ...entry, sum: Math.max(0, Number(value) || 0) }
          }

          if (field === 'date') {
            return { ...entry, date: value ? new Date(value).toISOString() : null }
          }

          if (field === 'type') {
            return { ...entry, type: value === 'expense' ? 'expense' : 'income' }
          }

        return { ...entry, [field]: value }
      }),
    }))
  },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleRemoveFinance = useCallback(
    (financeId) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        finances: (game.finances ?? []).filter((entry) => entry.id !== financeId),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const updateTask = useCallback(
    (taskId, updater) => {
      if (!canEditSelectedGame) return

      updateSelectedGame((game) => ({
        tasks: (game.tasks ?? []).map((task) => {
          if (task.id !== taskId) {
            return task
          }

          const patch = typeof updater === 'function' ? updater(task) : updater
          return { ...task, ...patch }
        }),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleAddTask = useCallback(() => {
    if (!canEditSelectedGame) return

    const newTask = createTask()
    updateSelectedGame((game) => ({
      tasks: [...(game.tasks ?? []), newTask],
    }))
    setExpandedTaskIds((prev) => [...prev, newTask.id])
  }, [canEditSelectedGame, updateSelectedGame])

  const handleRemoveTask = useCallback(
    (taskId) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        tasks: (game.tasks ?? []).filter((task) => task.id !== taskId),
      }))
      setExpandedTaskIds((prev) => prev.filter((id) => id !== taskId))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleTaskFieldChange = useCallback(
    (taskId, field, value) => {
      updateTask(taskId, { [field]: value })
    },
    [updateTask]
  )

  const handleTaskNumberChange = useCallback(
    (taskId, field, value) => {
      const numeric = Number(value)
      updateTask(taskId, { [field]: Number.isFinite(numeric) ? numeric : 0 })
    },
    [updateTask]
  )

  const handleTaskOptionalNumberChange = useCallback(
    (taskId, field, value) => {
      updateTask(taskId, { [field]: toNullableNumber(value) })
    },
    [updateTask]
  )

  const handleTaskCheckboxChange = useCallback(
    (taskId, field, checked) => {
      updateTask(taskId, { [field]: Boolean(checked) })
    },
    [updateTask]
  )

  const handleTaskCoordinateChange = useCallback(
    (taskId, field, value) => {
      const numericValue = toNullableNumber(value)
      updateTask(taskId, (task) => ({
        coordinates: {
          ...(task.coordinates ?? { latitude: null, longitude: null, radius: null }),
          [field]: numericValue,
        },
      }))
    },
    [updateTask]
  )

  const handleAddTaskCode = useCallback(
    (taskId) => {
      updateTask(taskId, (task) => ({ codes: [...(task.codes ?? []), ''] }))
    },
    [updateTask]
  )

  const handleTaskCodeChange = useCallback(
    (taskId, index, value) => {
      updateTask(taskId, (task) => {
        const nextCodes = [...(task.codes ?? [])]
        nextCodes[index] = value
        return { codes: nextCodes }
      })
    },
    [updateTask]
  )

  const handleRemoveTaskCode = useCallback(
    (taskId, index) => {
      updateTask(taskId, (task) => ({
        codes: (task.codes ?? []).filter((_, codeIndex) => codeIndex !== index),
      }))
    },
    [updateTask]
  )

  const handleAddTaskImage = useCallback(
    (taskId) => {
      updateTask(taskId, (task) => ({ images: [...(task.images ?? []), ''] }))
    },
    [updateTask]
  )

  const handleTaskImageChange = useCallback(
    (taskId, index, value) => {
      updateTask(taskId, (task) => {
        const nextImages = [...(task.images ?? [])]
        nextImages[index] = value
        return { images: nextImages }
      })
    },
    [updateTask]
  )

  const handleRemoveTaskImage = useCallback(
    (taskId, index) => {
      updateTask(taskId, (task) => ({
        images: (task.images ?? []).filter((_, imageIndex) => imageIndex !== index),
      }))
    },
    [updateTask]
  )

  const handleAddClue = useCallback(
    (taskId) => {
      const newClue = createClue()
      updateTask(taskId, (task) => ({ clues: [...(task.clues ?? []), newClue] }))
    },
    [updateTask]
  )

  const handleTaskClueChange = useCallback(
    (taskId, clueId, field, value) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).map((clue) =>
          clue.id === clueId ? { ...clue, [field]: value } : clue
        ),
      }))
    },
    [updateTask]
  )

  const handleRemoveClue = useCallback(
    (taskId, clueId) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).filter((clue) => clue.id !== clueId),
      }))
    },
    [updateTask]
  )

  const handleAddClueImage = useCallback(
    (taskId, clueId) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).map((clue) =>
          clue.id === clueId
            ? { ...clue, images: [...(clue.images ?? []), ''] }
            : clue
        ),
      }))
    },
    [updateTask]
  )

  const handleClueImageChange = useCallback(
    (taskId, clueId, index, value) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).map((clue) => {
          if (clue.id !== clueId) {
            return clue
          }

          const nextImages = [...(clue.images ?? [])]
          nextImages[index] = value
          return { ...clue, images: nextImages }
        }),
      }))
    },
    [updateTask]
  )

  const handleRemoveClueImage = useCallback(
    (taskId, clueId, index) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).map((clue) =>
          clue.id === clueId
            ? {
                ...clue,
                images: (clue.images ?? []).filter((_, imageIndex) => imageIndex !== index),
              }
            : clue
        ),
      }))
    },
    [updateTask]
  )

  const handleAddSubTask = useCallback(
    (taskId) => {
      const newSubTask = createSubTask()
      updateTask(taskId, (task) => ({ subTasks: [...(task.subTasks ?? []), newSubTask] }))
    },
    [updateTask]
  )

  const handleSubTaskChange = useCallback(
    (taskId, subTaskId, field, value) => {
      updateTask(taskId, (task) => ({
        subTasks: (task.subTasks ?? []).map((subTask) =>
          subTask.id === subTaskId ? { ...subTask, [field]: value } : subTask
        ),
      }))
    },
    [updateTask]
  )

  const handleRemoveSubTask = useCallback(
    (taskId, subTaskId) => {
      updateTask(taskId, (task) => ({
        subTasks: (task.subTasks ?? []).filter((subTask) => subTask.id !== subTaskId),
      }))
    },
    [updateTask]
  )

  const handleAddPenaltyCode = useCallback(
    (taskId) => {
      const newPenalty = createPenaltyCode()
      updateTask(taskId, (task) => ({
        penaltyCodes: [...(task.penaltyCodes ?? []), newPenalty],
      }))
    },
    [updateTask]
  )

  const handlePenaltyCodeChange = useCallback(
    (taskId, penaltyId, field, value) => {
      updateTask(taskId, (task) => ({
        penaltyCodes: (task.penaltyCodes ?? []).map((penalty) =>
          penalty.id === penaltyId ? { ...penalty, [field]: value } : penalty
        ),
      }))
    },
    [updateTask]
  )

  const handleRemovePenaltyCode = useCallback(
    (taskId, penaltyId) => {
      updateTask(taskId, (task) => ({
        penaltyCodes: (task.penaltyCodes ?? []).filter((penalty) => penalty.id !== penaltyId),
      }))
    },
    [updateTask]
  )

  const handleAddBonusCode = useCallback(
    (taskId) => {
      const newBonus = createBonusCode()
      updateTask(taskId, (task) => ({
        bonusCodes: [...(task.bonusCodes ?? []), newBonus],
      }))
    },
    [updateTask]
  )

  const handleBonusCodeChange = useCallback(
    (taskId, bonusId, field, value) => {
      updateTask(taskId, (task) => ({
        bonusCodes: (task.bonusCodes ?? []).map((bonus) =>
          bonus.id === bonusId ? { ...bonus, [field]: value } : bonus
        ),
      }))
    },
    [updateTask]
  )

  const handleRemoveBonusCode = useCallback(
    (taskId, bonusId) => {
      updateTask(taskId, (task) => ({
        bonusCodes: (task.bonusCodes ?? []).filter((bonus) => bonus.id !== bonusId),
      }))
    },
    [updateTask]
  )

  const toggleTaskExpansion = useCallback((taskId) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    )
  }, [])

  const handleOpenTeamsModal = useCallback(() => {
    if (!canManageTeams) {
      return
    }

    setIsTeamsModalOpen(true)
  }, [canManageTeams])

  const handleCloseTeamsModal = useCallback(() => {
    setIsTeamsModalOpen(false)
  }, [])

  const loadTeamsModalData = useCallback(async () => {
    if (!selectedGame || !location) {
      setTeamsModalState({
        isLoading: false,
        error: location
          ? 'Не выбрана игра для управления командами'
          : 'Не удалось определить площадку',
        gameTeams: [],
        availableTeams: [],
      })
      setSelectedTeamToAdd('')
      return
    }

    setTeamsModalState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const [gameTeamsResponse, teamsResponse] = await Promise.all([
        fetch(
          `/api/${location}/custom?collection=gamesteams&gameId=${encodeURIComponent(
            selectedGame.id
          )}`
        ),
        fetch(`/api/${location}/custom?collection=teams&limit=200&sort=name_lowered`),
      ])

      const gameTeamsJson = await gameTeamsResponse.json()
      if (!gameTeamsResponse.ok || gameTeamsJson?.success === false) {
        throw new Error(gameTeamsJson?.error || 'Не удалось загрузить команды игры')
      }

      const teamsJson = await teamsResponse.json()
      if (!teamsResponse.ok || teamsJson?.success === false) {
        throw new Error(teamsJson?.error || 'Не удалось загрузить список команд')
      }

      const gameTeamsData = Array.isArray(gameTeamsJson.data)
        ? gameTeamsJson.data
        : []
      const allTeamsData = Array.isArray(teamsJson.data) ? teamsJson.data : []

      const teamsMap = allTeamsData.reduce((acc, team) => {
        if (team?._id) {
          const id = team._id.toString()
          acc[id] = {
            id,
            name: team.name || 'Без названия',
            description: team.description || '',
          }
        }
        return acc
      }, {})

      const missingTeamIds = gameTeamsData
        .map((entry) => (entry?.teamId ? entry.teamId.toString() : null))
        .filter((teamId) => teamId && !teamsMap[teamId])

      if (missingTeamIds.length > 0) {
        const additionalTeams = await Promise.all(
          missingTeamIds.map(async (teamId) => {
            try {
              const response = await fetch(`/api/${location}/teams/${teamId}`)
              const json = await response.json()
              if (!response.ok || json?.success === false) {
                return null
              }

              const team = json.data
              if (team?._id) {
                return {
                  id: team._id.toString(),
                  name: team.name || 'Без названия',
                  description: team.description || '',
                }
              }

              return null
            } catch (error) {
              console.error('Failed to load team details', error)
              return null
            }
          })
        )

        additionalTeams
          .filter(Boolean)
          .forEach((team) => {
            teamsMap[team.id] = team
          })
      }

      const existingTeamIds = new Set(
        gameTeamsData
          .map((entry) => (entry?.teamId ? entry.teamId.toString() : null))
          .filter(Boolean)
      )

      const availableTeams = allTeamsData
        .map((team) => ({
          id: team?._id ? team._id.toString() : '',
          name: team?.name || 'Без названия',
          description: team?.description || '',
        }))
        .filter((team) => team.id && !existingTeamIds.has(team.id))

      const gameTeams = gameTeamsData.map((entry) => {
        const entryId = entry?._id ? entry._id.toString() : entry?.id || ''
        const teamId = entry?.teamId ? entry.teamId.toString() : ''
        const teamInfo = teamId ? teamsMap[teamId] : null

        return {
          id: entryId,
          teamId,
          teamName: teamInfo?.name || 'Неизвестная команда',
          teamDescription: teamInfo?.description || '',
        }
      })

      setTeamsModalState({
        isLoading: false,
        error: null,
        gameTeams,
        availableTeams,
      })

      if (availableTeams.length > 0) {
        setSelectedTeamToAdd((prev) =>
          prev && availableTeams.some((team) => team.id === prev)
            ? prev
            : availableTeams[0].id
        )
      } else {
        setSelectedTeamToAdd('')
      }
    } catch (error) {
      console.error('Failed to load teams for modal', error)
      setTeamsModalState({
        isLoading: false,
        error: error?.message || 'Не удалось загрузить данные',
        gameTeams: [],
        availableTeams: [],
      })
      setSelectedTeamToAdd('')
    }
  }, [location, selectedGame])

  const handleAddTeamToGame = useCallback(async () => {
    if (!selectedGame || !location || !selectedTeamToAdd) {
      return
    }

    setIsAddingTeam(true)
    setTeamsModalState((prev) => ({ ...prev, error: null }))

    try {
      const response = await fetch(`/api/${location}/gamesteams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamToAdd,
          gameId: selectedGame.id,
        }),
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось добавить команду')
      }

      await loadTeamsModalData()
    } catch (error) {
      console.error('Failed to add team to game', error)
      setTeamsModalState((prev) => ({
        ...prev,
        error: error?.message || 'Не удалось добавить команду',
      }))
    } finally {
      setIsAddingTeam(false)
    }
  }, [selectedGame, location, selectedTeamToAdd, loadTeamsModalData])

  const handleRemoveTeamFromGame = useCallback(
    async (gameTeamId) => {
      if (!gameTeamId || !location) {
        return
      }

      setRemovingTeamIds((prev) =>
        prev.includes(gameTeamId) ? prev : [...prev, gameTeamId]
      )
      setTeamsModalState((prev) => ({ ...prev, error: null }))

      try {
        const response = await fetch(`/api/${location}/gamesteams/${gameTeamId}`, {
          method: 'DELETE',
        })

        const json = await response.json()
        if (!response.ok || json?.success === false) {
          throw new Error(json?.error || 'Не удалось удалить команду')
        }

        await loadTeamsModalData()
      } catch (error) {
        console.error('Failed to remove team from game', error)
        setTeamsModalState((prev) => ({
          ...prev,
          error: error?.message || 'Не удалось удалить команду',
        }))
      } finally {
        setRemovingTeamIds((prev) => prev.filter((id) => id !== gameTeamId))
      }
    },
    [location, loadTeamsModalData]
  )

  useEffect(() => {
    if (isTeamsModalOpen) {
      loadTeamsModalData()
    }
  }, [isTeamsModalOpen, loadTeamsModalData])

  const handleOpenEditModal = useCallback(() => {
    if (!canEditSelectedGame) {
      return
    }

    setIsEditModalOpen(true)
  }, [canEditSelectedGame])

  const handleCloseEditModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsEditModalOpen(false)
  }, [isSaving])

  const handleModalPrimaryAction = useCallback(() => {
    if (isSaving) {
      return
    }

    if (isDirty && canEditSelectedGame) {
      handleSaveChanges()
    } else {
      handleCloseEditModal()
    }
  }, [canEditSelectedGame, handleCloseEditModal, handleSaveChanges, isDirty, isSaving])

  const tasksSummary = useMemo(() => {
    if (!selectedGame?.tasksStats) {
      return null
    }

    const { total, bonus, canceled } = selectedGame.tasksStats
    return {
      total,
      bonus,
      canceled,
      totalLabel: getNounTasks(total),
      bonusLabel: bonus > 0 ? getNounBonusTasks(bonus) : null,
      canceledLabel: canceled > 0 ? `${canceled} отменено` : null,
    }
  }, [selectedGame])

  const gameTypeLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    const option = GAME_TYPE_OPTIONS.find((item) => item.value === selectedGame.type)
    return option?.label ?? '—'
  }, [selectedGame])

  const plannedStartLabel = useMemo(() => {
    if (!selectedGame?.dateStart) {
      return 'Дата не назначена'
    }

    try {
      return new Date(selectedGame.dateStart).toLocaleString('ru-RU', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    } catch (error) {
      return 'Дата не назначена'
    }
  }, [selectedGame])

  const taskDurationLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    const minutes = toMinutes(selectedGame.taskDuration)
    return minutes > 0 ? `${minutes} мин` : 'Не задано'
  }, [selectedGame])

  const cluesDurationLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    const minutes = toMinutes(selectedGame.cluesDuration)
    return minutes > 0 ? `${minutes} мин` : 'Подсказки отключены'
  }, [selectedGame])

  const clueModeDetails = useMemo(() => {
    if (!selectedGame) {
      return { modeLabel: '—', valueLabel: '—' }
    }

    const option = CLUE_EARLY_MODE_OPTIONS.find(
      (item) => item.value === selectedGame.clueEarlyAccessMode
    )
    const minutes = toMinutes(selectedGame.clueEarlyPenalty)

    if (selectedGame.clueEarlyAccessMode === 'penalty') {
      return {
        modeLabel: option?.label ?? '—',
        valueLabel: minutes > 0 ? `Штраф ${minutes} мин` : 'Штраф не применяется',
      }
    }

    return {
      modeLabel: option?.label ?? '—',
      valueLabel:
        minutes > 0
          ? `После подсказки добавляется ${minutes} мин ожидания`
          : 'Без дополнительного времени',
    }
  }, [selectedGame])

  const breakDurationLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    const minutes = toMinutes(selectedGame.breakDuration)
    return minutes > 0 ? `${minutes} мин` : 'Без перерывов'
  }, [selectedGame])

  const taskFailurePenaltyLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    if (selectedGame.type === 'photo') {
      const value = Number(selectedGame.taskFailurePenalty) || 0
      return value > 0 ? `${value} баллов` : 'Штраф отсутствует'
    }

    const minutes = toMinutes(selectedGame.taskFailurePenalty)
    return minutes > 0 ? `${minutes} мин` : 'Штраф отсутствует'
  }, [selectedGame])

  const manyCodesLimitLabel = useMemo(() => {
    if (!selectedGame || selectedGame.type === 'photo') {
      return null
    }

    const limit = Number(selectedGame.manyCodesPenalty?.[0]) || 0
    return limit > 0 ? `${limit} попыток` : 'Лимит не задан'
  }, [selectedGame])

  const manyCodesPenaltyLabel = useMemo(() => {
    if (!selectedGame || selectedGame.type === 'photo') {
      return null
    }

    const seconds = Number(selectedGame.manyCodesPenalty?.[1]) || 0
    const minutes = toMinutes(seconds)
    return minutes > 0 ? `${minutes} мин` : 'Без штрафа'
  }, [selectedGame])

  const financesSummary = useMemo(() => {
    if (!selectedGame?.finances) {
      return { income: 0, expense: 0, balance: 0 }
    }

    const { income, expense } = selectedGame.finances.reduce(
      (acc, entry) => {
        if (entry.type === 'expense') {
          acc.expense += Number(entry.sum) || 0
        } else {
          acc.income += Number(entry.sum) || 0
        }
        return acc
      },
      { income: 0, expense: 0 }
    )

    return { income, expense, balance: income - expense }
  }, [selectedGame])

  const balanceClass = financesSummary.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
  return (
    <>
      <Head>
        <title>ActQuest — Игры</title>
      </Head>
      <CabinetLayout
        title="Игры"
        description="Редактируйте сценарии, управляйте статусами и готовьте квесты к запуску."
        activePage="games"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-violet-50 border border-violet-100 shadow-sm rounded-2xl dark:bg-violet-500/10 dark:border-violet-500/40">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-violet-600 font-semibold shadow-sm dark:bg-violet-500/40 dark:text-violet-100"
                aria-hidden="true"
              >
                i
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-violet-900 dark:text-violet-50">Ваши игры</p>
                <p className="text-xs leading-5 text-violet-700 dark:text-violet-200">
                  Выберите игру, чтобы открыть ключевые настройки, управлять составами и следить за финансами.
                </p>
              </div>
            </div>

            {games.length > 0 ? (
              <ul className="space-y-3">
                {games.map((game) => {
                  const startDateLabel = game.dateStart
                    ? new Date(game.dateStart).toLocaleString('ru-RU', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : 'Дата не задана'

                  const relativeUpdatedAt = game.updatedAt
                    ? formatRelativeTimeFromNow(game.updatedAt)
                    : '—'

                  return (
                    <li key={game.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedGameId(game.id)}
                        className={`w-full text-left p-4 border rounded-2xl transition hover:border-primary hover:bg-blue-50 dark:hover:bg-violet-500/10 ${
                          selectedGameId === game.id
                            ? 'border-primary bg-blue-50 shadow-sm dark:border-violet-400 dark:bg-violet-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80'
                        }`}
                      >
                        <p className="text-sm font-semibold text-primary">
                          {game.name || 'Без названия'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${getStatusBadgeClassName(game.status)}`}
                          >
                            {getGameStatusLabel(game.status)}
                          </span>
                          <span className="text-slate-500">{startDateLabel}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {getNounTeams(game.teamsCount)} · Обновлено {relativeUpdatedAt}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center text-slate-500 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                Для выбранного города пока нет игр. Создайте сценарий в телеграм-боте, чтобы он появился здесь.
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            {selectedGame ? (
              <div className="space-y-6">
                <div className="p-5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(selectedGame.status)}`}
                        >
                          {getGameStatusLabel(selectedGame.status)}
                        </span>
                        <span className="text-xs text-slate-500">
                          Команд: {numberFormatter.format(selectedGame.teamsCount ?? 0)}
                        </span>
                        {selectedGame.updatedAt && (
                          <span className="text-xs text-slate-500">
                            Обновлено {formatRelativeTimeFromNow(selectedGame.updatedAt)}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-4 text-xl font-semibold text-primary">
                        {selectedGame.name || 'Без названия'}
                      </h2>
                      {tasksSummary && (
                        <p className="mt-3 text-sm text-slate-600">
                          {tasksSummary.totalLabel}
                          {tasksSummary.bonusLabel ? ` · ${tasksSummary.bonusLabel}` : ''}
                          {tasksSummary.canceledLabel ? ` · ${tasksSummary.canceledLabel}` : ''}
                        </p>
                      )}
                    </div>
                    {(canManageTeams || canEditSelectedGame) && (
                      <div className="flex flex-wrap justify-start gap-3 md:justify-end">
                        {canManageTeams && (
                          <button
                            type="button"
                            onClick={handleOpenTeamsModal}
                            className="inline-flex justify-center rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                          >
                            Управление командами
                          </button>
                        )}
                        {canEditSelectedGame && (
                          <button
                            type="button"
                            onClick={handleOpenEditModal}
                            className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            Редактировать игру
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!location && (
                  <div className="p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl">
                    Не удалось определить площадку пользователя. Сохранение изменений недоступно.
                  </div>
                )}

                {feedback && (
                  <div
                    className={`p-4 text-sm border rounded-2xl ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                {editRestrictionMessage && (
                  <div className="p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl">
                    {editRestrictionMessage}
                  </div>
                )}

                <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                  <h3 className="text-lg font-semibold text-primary">Общая информация</h3>
                  {selectedGame.image && (
                    <img
                      src={selectedGame.image}
                      alt="Обложка игры"
                      className="mt-4 h-48 w-full rounded-xl object-cover"
                    />
                  )}
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Тип игры
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{gameTypeLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Плановое начало
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {plannedStartLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Место старта
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {selectedGame.startingPlace || 'Не указано'}
                      </dd>
                    </div>
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Финиш
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.finishingPlace || 'Не указан'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Индивидуальный старт
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.individualStart ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Показывать организатора
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.showCreator ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Публиковать задания в кабинете
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.showTasks ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Скрывать результаты
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.hideResult ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {selectedGame.description && (
                    <p className="mt-4 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                      {selectedGame.description}
                    </p>
                  )}
                </section>

                <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                  <h3 className="text-lg font-semibold text-primary">Параметры проведения</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Длительность задания
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{taskDurationLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Интервал подсказок
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{cluesDurationLabel}</dd>
                    </div>
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Режим досрочной подсказки
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {clueModeDetails.modeLabel}
                          <br />
                          <span className="text-xs text-slate-500">{clueModeDetails.valueLabel}</span>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Перерыв между заданиями
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{breakDurationLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Штраф за невыполненное задание
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {taskFailurePenaltyLabel}
                      </dd>
                    </div>
                    {canViewRestrictedGameInfo && manyCodesLimitLabel && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Лимит неверных кодов
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {manyCodesLimitLabel}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && manyCodesPenaltyLabel && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Штраф за превышение лимита
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {manyCodesPenaltyLabel}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                  <h3 className="text-lg font-semibold text-primary">Опции для капитана</h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainForceClue ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        aria-hidden="true"
                      />
                      <span>
                        Капитан {selectedGame.allowCaptainForceClue ? 'может' : 'не может'} запрашивать подсказку
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFailTask ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        aria-hidden="true"
                      />
                      <span>
                        Капитан {selectedGame.allowCaptainFailTask ? 'может' : 'не может'} провалить задание
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFinishBreak ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        aria-hidden="true"
                      />
                      <span>
                        Капитан {selectedGame.allowCaptainFinishBreak ? 'может' : 'не может'} завершать перерыв
                      </span>
                    </li>
                  </ul>
                </section>

                <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                  <h3 className="text-lg font-semibold text-primary">Стоимость участия</h3>
                  {selectedGame.prices?.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {selectedGame.prices.map((price) => (
                        <li
                          key={price.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                        >
                          <span className="text-slate-600 dark:text-slate-200">
                            {price.name || 'Без названия'}
                          </span>
                          <span className="font-semibold text-primary">
                            {currencyFormatter.format(Number(price.price) || 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Стоимость участия не указана.</p>
                  )}
                </section>

                {canViewRestrictedGameInfo && (
                  <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-semibold text-primary">Финансы</h3>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                      <p>
                        Доходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.income)}</span>
                      </p>
                      <p className="mt-1">
                        Расходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.expense)}</span>
                      </p>
                      <p className={`mt-1 font-semibold ${balanceClass}`}>
                        Баланс: {currencyFormatter.format(financesSummary.balance)}
                      </p>
                    </div>
                    {selectedGame.finances?.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {selectedGame.finances.map((entry) => (
                          <li
                            key={entry.id}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span
                                className={`text-xs font-semibold ${
                                  entry.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                                }`}
                              >
                                {entry.type === 'expense' ? 'Расход' : 'Доход'}
                              </span>
                              <span className="text-sm font-semibold text-primary">
                                {currencyFormatter.format(Number(entry.sum) || 0)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {entry.date ? formatDate(entry.date) : 'Дата не указана'}
                            </p>
                            {entry.description ? (
                              <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                                {entry.description}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">Финансовые записи отсутствуют.</p>
                    )}
                  </section>
                )}

                <Modal
                  isOpen={isEditModalOpen}
                  title={`Редактирование игры «${selectedGame.name || 'Без названия'}»`}
                  onClose={handleCloseEditModal}
                >
                <fieldset disabled={!canEditSelectedGame || isSaving} className="space-y-6 border-0 p-0 m-0">
                  <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="game-title" className="text-sm font-semibold text-primary">
                        Название игры
                      </label>
                      <input
                        id="game-title"
                        type="text"
                        value={selectedGame.name}
                        onChange={(event) =>
                          updateSelectedGame({ name: event.target.value })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="game-status" className="text-sm font-semibold text-primary">
                        Статус
                      </label>
                      <select
                        id="game-status"
                        value={selectedGame.status}
                        onChange={(event) =>
                          updateSelectedGame({ status: event.target.value })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      >
                        {GAME_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="game-type" className="text-sm font-semibold text-primary">
                        Тип игры
                      </label>
                      <select
                        id="game-type"
                        value={selectedGame.type}
                        onChange={(event) =>
                          updateSelectedGame({ type: event.target.value })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      >
                        {GAME_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="game-date" className="text-sm font-semibold text-primary">
                        Плановое начало
                      </label>
                      <input
                        id="game-date"
                        type="datetime-local"
                        value={
                          selectedGame.dateStart
                            ? formatDateTime(selectedGame.dateStart, true, true)
                            : ''
                        }
                        onChange={(event) =>
                          updateSelectedGame({
                            dateStart: event.target.value
                              ? new Date(event.target.value).toISOString()
                              : null,
                          })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      id="game-individual-start"
                      type="checkbox"
                      checked={Boolean(selectedGame.individualStart)}
                      onChange={(event) =>
                        updateSelectedGame({ individualStart: event.target.checked })
                      }
                      className="w-4 h-4 text-primary border-slate-300 rounded"
                    />
                    <label htmlFor="game-individual-start" className="text-sm text-slate-600">
                      Индивидуальный старт для команд
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="game-starting-place" className="text-sm font-semibold text-primary">
                        Место сбора
                      </label>
                      <input
                        id="game-starting-place"
                        type="text"
                        value={selectedGame.startingPlace}
                        onChange={(event) =>
                          updateSelectedGame({ startingPlace: event.target.value })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="game-finishing-place" className="text-sm font-semibold text-primary">
                        Место окончания
                      </label>
                      <input
                        id="game-finishing-place"
                        type="text"
                        value={selectedGame.finishingPlace}
                        onChange={(event) =>
                          updateSelectedGame({ finishingPlace: event.target.value })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="game-description" className="text-sm font-semibold text-primary">
                      Описание
                    </label>
                    <textarea
                      id="game-description"
                      value={selectedGame.description}
                      onChange={(event) =>
                        updateSelectedGame({ description: event.target.value })
                      }
                      rows={5}
                      className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="game-image" className="text-sm font-semibold text-primary">
                      Ссылка на обложку
                    </label>
                    <input
                      id="game-image"
                      type="text"
                      value={selectedGame.image}
                      onChange={(event) =>
                        updateSelectedGame({ image: event.target.value })
                      }
                      className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                    />
                    {selectedGame.image && (
                      <img
                        src={selectedGame.image}
                        alt={selectedGame.name || 'Обложка игры'}
                        className="object-cover w-full h-40 mt-3 rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    )}
                  </div>
                  </section>

                  <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                  <h2 className="text-lg font-semibold text-primary">Настройки заданий и подсказок</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="game-task-duration" className="text-sm font-semibold text-primary">
                        Продолжительность задания (мин)
                      </label>
                      <input
                        id="game-task-duration"
                        type="number"
                        min="0"
                        value={toMinutes(selectedGame.taskDuration)}
                        onChange={(event) =>
                          updateSelectedGame({
                            taskDuration: toSeconds(event.target.value),
                          })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="game-clues-duration" className="text-sm font-semibold text-primary">
                        Время до подсказки (мин)
                      </label>
                      <input
                        id="game-clues-duration"
                        type="number"
                        min="0"
                        value={toMinutes(selectedGame.cluesDuration)}
                        onChange={(event) =>
                          updateSelectedGame({
                            cluesDuration: toSeconds(event.target.value),
                          })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Укажите 0, чтобы отключить автоматическую выдачу подсказок.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="game-clue-mode" className="text-sm font-semibold text-primary">
                        Режим досрочной подсказки
                      </label>
                      <select
                        id="game-clue-mode"
                        value={selectedGame.clueEarlyAccessMode}
                        onChange={(event) =>
                          updateSelectedGame({
                            clueEarlyAccessMode: event.target.value,
                          })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      >
                        {CLUE_EARLY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="game-clue-penalty" className="text-sm font-semibold text-primary">
                        {selectedGame.clueEarlyAccessMode === 'penalty'
                          ? 'Штраф за досрочную подсказку (мин)'
                          : 'Дополнительное время после подсказки (мин)'}
                      </label>
                      <input
                        id="game-clue-penalty"
                        type="number"
                        min="0"
                        value={toMinutes(selectedGame.clueEarlyPenalty)}
                        onChange={(event) =>
                          updateSelectedGame({
                            clueEarlyPenalty: toSeconds(event.target.value),
                          })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="game-break-duration" className="text-sm font-semibold text-primary">
                        Перерыв между заданиями (мин)
                      </label>
                      <input
                        id="game-break-duration"
                        type="number"
                        min="0"
                        value={toMinutes(selectedGame.breakDuration)}
                        onChange={(event) =>
                          updateSelectedGame({
                            breakDuration: toSeconds(event.target.value),
                          })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="game-task-penalty" className="text-sm font-semibold text-primary">
                        {selectedGame.type === 'photo'
                          ? 'Штраф за невыполненное задание (баллы)'
                          : 'Штраф за невыполненное задание (мин)'}
                      </label>
                      <input
                        id="game-task-penalty"
                        type="number"
                        min="0"
                        value={
                          selectedGame.type === 'photo'
                            ? Number(selectedGame.taskFailurePenalty) || 0
                            : toMinutes(selectedGame.taskFailurePenalty)
                        }
                        onChange={(event) =>
                          updateSelectedGame({
                            taskFailurePenalty:
                              selectedGame.type === 'photo'
                                ? Math.max(0, Number(event.target.value) || 0)
                                : toSeconds(event.target.value),
                          })
                        }
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {selectedGame.type !== 'photo' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="game-many-codes-limit" className="text-sm font-semibold text-primary">
                          Лимит неверных кодов для штрафа
                        </label>
                        <input
                          id="game-many-codes-limit"
                          type="number"
                          min="0"
                          value={selectedGame.manyCodesPenalty?.[0] ?? 0}
                          onChange={(event) =>
                            updateSelectedGame({
                              manyCodesPenalty: [
                                Math.max(0, Number(event.target.value) || 0),
                                selectedGame.manyCodesPenalty?.[1] ?? 0,
                              ],
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="game-many-codes-penalty" className="text-sm font-semibold text-primary">
                          Штраф за превышение лимита (мин)
                        </label>
                        <input
                          id="game-many-codes-penalty"
                          type="number"
                          min="0"
                          value={toMinutes(selectedGame.manyCodesPenalty?.[1] ?? 0)}
                          onChange={(event) =>
                            updateSelectedGame({
                              manyCodesPenalty: [
                                selectedGame.manyCodesPenalty?.[0] ?? 0,
                                toSeconds(event.target.value),
                              ],
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGame.allowCaptainForceClue)}
                        onChange={(event) =>
                          updateSelectedGame({
                            allowCaptainForceClue: event.target.checked,
                          })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      Досрочные подсказки капитанам
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGame.allowCaptainFailTask)}
                        onChange={(event) =>
                          updateSelectedGame({
                            allowCaptainFailTask: event.target.checked,
                          })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      Слив задания капитаном
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGame.allowCaptainFinishBreak)}
                        onChange={(event) =>
                          updateSelectedGame({
                            allowCaptainFinishBreak: event.target.checked,
                          })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      Досрочное завершение перерыва
                    </label>
                  </div>
                  </section>


                  <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-primary">Задания</h2>
                    <button
                      type="button"
                      onClick={handleAddTask}
                      className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Добавить задание
                    </button>
                  </div>

                  {selectedGame.tasks?.length > 0 ? (
                    <div className="space-y-4">
                      {selectedGame.tasks.map((task, index) => {
                        const isExpanded = expandedTaskIds.includes(task.id)

                        return (
                          <div
                            key={task.id}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTaskExpansion(task.id)}
                              className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-primary transition hover:bg-blue-50 dark:bg-slate-800/70 dark:hover:bg-violet-500/10"
                            >
                              <div>
                                <p>
                                  {index + 1}. {task.title || 'Без названия'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {task.isBonusTask ? 'Бонусное задание' : 'Основное задание'}
                                  {task.canceled ? ' · Отменено' : ''}
                                  {task.codes?.length
                                    ? ` · Код${task.codes.length === 1 ? '' : 'ы'}: ${task.codes.length}`
                                    : ''}
                                  {task.clues?.length
                                    ? ` · Подсказок: ${task.clues.length}`
                                    : ''}
                                </p>
                              </div>
                              <span className="text-xs font-semibold">
                                {isExpanded ? 'Свернуть' : 'Развернуть'}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="space-y-5 px-4 py-5">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <label className="text-sm font-semibold text-primary" htmlFor={`task-title-${task.id}`}>
                                      Название задания
                                    </label>
                                    <input
                                      id={`task-title-${task.id}`}
                                      type="text"
                                      value={task.title}
                                      onChange={(event) =>
                                        handleTaskFieldChange(task.id, 'title', event.target.value)
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2 md:items-start">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(task.isBonusTask)}
                                        onChange={(event) =>
                                          handleTaskCheckboxChange(
                                            task.id,
                                            'isBonusTask',
                                            event.target.checked
                                          )
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-primary"
                                      />
                                      Бонусное задание
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(task.canceled)}
                                        onChange={(event) =>
                                          handleTaskCheckboxChange(
                                            task.id,
                                            'canceled',
                                            event.target.checked
                                          )
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-primary"
                                      />
                                      Задание отменено
                                    </label>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-primary" htmlFor={`task-text-${task.id}`}>
                                    Описание задания
                                  </label>
                                  <textarea
                                    id={`task-text-${task.id}`}
                                    rows={4}
                                    value={task.task}
                                    onChange={(event) =>
                                      handleTaskFieldChange(task.id, 'task', event.target.value)
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                  />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <label className="text-sm font-semibold text-primary" htmlFor={`task-bonus-${task.id}`}>
                                      Бонус за выполнение
                                    </label>
                                    <input
                                      id={`task-bonus-${task.id}`}
                                      type="number"
                                      min="0"
                                      value={task.taskBonusForComplite ?? 0}
                                      onChange={(event) =>
                                        handleTaskNumberChange(
                                          task.id,
                                          'taskBonusForComplite',
                                          event.target.value
                                        )
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-sm font-semibold text-primary" htmlFor={`task-codes-required-${task.id}`}>
                                      Кодов для выполнения
                                    </label>
                                    <input
                                      id={`task-codes-required-${task.id}`}
                                      type="number"
                                      min="0"
                                      value={task.numCodesToCompliteTask ?? ''}
                                      onChange={(event) =>
                                        handleTaskOptionalNumberChange(
                                          task.id,
                                          'numCodesToCompliteTask',
                                          event.target.value
                                        )
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                    />
                                    <p className="mt-1 text-xs text-slate-500">
                                      Оставьте пустым, чтобы требовались все коды.
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-primary" htmlFor={`task-post-message-${task.id}`}>
                                    Сообщение после выполнения
                                  </label>
                                  <textarea
                                    id={`task-post-message-${task.id}`}
                                    rows={3}
                                    value={task.postMessage}
                                    onChange={(event) =>
                                      handleTaskFieldChange(task.id, 'postMessage', event.target.value)
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                  />
                                </div>

                                <div>
                                  <h4 className="text-sm font-semibold text-primary">Координаты</h4>
                                  <div className="mt-2 grid gap-4 sm:grid-cols-3">
                                    <div>
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-lat-${task.id}`}>
                                        Широта
                                      </label>
                                      <input
                                        id={`task-lat-${task.id}`}
                                        type="number"
                                        step="any"
                                        value={task.coordinates?.latitude ?? ''}
                                        onChange={(event) =>
                                          handleTaskCoordinateChange(
                                            task.id,
                                            'latitude',
                                            event.target.value
                                          )
                                        }
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-lng-${task.id}`}>
                                        Долгота
                                      </label>
                                      <input
                                        id={`task-lng-${task.id}`}
                                        type="number"
                                        step="any"
                                        value={task.coordinates?.longitude ?? ''}
                                        onChange={(event) =>
                                          handleTaskCoordinateChange(
                                            task.id,
                                            'longitude',
                                            event.target.value
                                          )
                                        }
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-radius-${task.id}`}>
                                        Радиус (м)
                                      </label>
                                      <input
                                        id={`task-radius-${task.id}`}
                                        type="number"
                                        min="0"
                                        value={task.coordinates?.radius ?? ''}
                                        onChange={(event) =>
                                          handleTaskCoordinateChange(
                                            task.id,
                                            'radius',
                                            event.target.value
                                          )
                                        }
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Коды для задания</h4>
                                    <button
                                      type="button"
                                      onClick={() => handleAddTaskCode(task.id)}
                                      className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                    >
                                      Добавить код
                                    </button>
                                  </div>
                                  {task.codes?.length > 0 ? (
                                    <div className="mt-3 space-y-3">
                                      {task.codes.map((codeValue, codeIndex) => (
                                        <div
                                          key={`${task.id}-code-${codeIndex}`}
                                          className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                        >
                                          <input
                                            type="text"
                                            value={codeValue}
                                            onChange={(event) =>
                                              handleTaskCodeChange(
                                                task.id,
                                                codeIndex,
                                                event.target.value
                                              )
                                            }
                                            placeholder="Код"
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveTaskCode(task.id, codeIndex)}
                                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                          >
                                            Удалить
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-500">Кодов пока нет.</p>
                                  )}
                                </div>

                                <div>
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Изображения задания</h4>
                                    <button
                                      type="button"
                                      onClick={() => handleAddTaskImage(task.id)}
                                      className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                    >
                                      Добавить изображение
                                    </button>
                                  </div>
                                  {task.images?.length > 0 ? (
                                    <div className="mt-3 space-y-3">
                                      {task.images.map((imageValue, imageIndex) => (
                                        <div
                                          key={`${task.id}-image-${imageIndex}`}
                                          className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                        >
                                          <input
                                            type="text"
                                            value={imageValue}
                                            onChange={(event) =>
                                              handleTaskImageChange(
                                                task.id,
                                                imageIndex,
                                                event.target.value
                                              )
                                            }
                                            placeholder="Ссылка на изображение"
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveTaskImage(task.id, imageIndex)}
                                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                          >
                                            Удалить
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-500">Изображений пока нет.</p>
                                  )}
                                </div>

                                <div>
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Подсказки</h4>
                                    <button
                                      type="button"
                                      onClick={() => handleAddClue(task.id)}
                                      className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                    >
                                      Добавить подсказку
                                    </button>
                                  </div>
                                  {task.clues?.length > 0 ? (
                                    <div className="mt-3 space-y-4">
                                      {task.clues.map((clue, clueIndex) => (
                                        <div
                                          key={clue.id}
                                          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-sm font-semibold text-primary">
                                              Подсказка {clueIndex + 1}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveClue(task.id, clue.id)}
                                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                            >
                                              Удалить подсказку
                                            </button>
                                          </div>
                                          <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-clue-${clue.id}`}>
                                              Текст подсказки
                                            </label>
                                            <textarea
                                              id={`task-clue-${clue.id}`}
                                              rows={3}
                                              value={clue.clue}
                                              onChange={(event) =>
                                                handleTaskClueChange(
                                                  task.id,
                                                  clue.id,
                                                  'clue',
                                                  event.target.value
                                                )
                                              }
                                              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                            />
                                          </div>
                                          <div>
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Изображения подсказки
                                              </h5>
                                              <button
                                                type="button"
                                                onClick={() => handleAddClueImage(task.id, clue.id)}
                                                className="inline-flex justify-center rounded-xl border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                              >
                                                Добавить ссылку
                                              </button>
                                            </div>
                                            {clue.images?.length > 0 ? (
                                              <div className="mt-3 space-y-3">
                                                {clue.images.map((imageValue, imageIndex) => (
                                                  <div
                                                    key={`${clue.id}-image-${imageIndex}`}
                                                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                                  >
                                                    <input
                                                      type="text"
                                                      value={imageValue}
                                                      onChange={(event) =>
                                                        handleClueImageChange(
                                                          task.id,
                                                          clue.id,
                                                          imageIndex,
                                                          event.target.value
                                                        )
                                                      }
                                                      placeholder="Ссылка на изображение"
                                                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleRemoveClueImage(task.id, clue.id, imageIndex)
                                                      }
                                                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                                    >
                                                      Удалить
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="mt-3 text-sm text-slate-500">Изображения отсутствуют.</p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-500">Подсказок пока нет.</p>
                                  )}
                                </div>

                                <div>
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Подзадания</h4>
                                    <button
                                      type="button"
                                      onClick={() => handleAddSubTask(task.id)}
                                      className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                    >
                                      Добавить подзадание
                                    </button>
                                  </div>
                                  {task.subTasks?.length > 0 ? (
                                    <div className="mt-3 space-y-4">
                                      {task.subTasks.map((subTask, subIndex) => (
                                        <div
                                          key={subTask.id}
                                          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-sm font-semibold text-primary">
                                              Подзадание {subIndex + 1}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveSubTask(task.id, subTask.id)}
                                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                            >
                                              Удалить подзадание
                                            </button>
                                          </div>
                                          <div className="grid gap-4 md:grid-cols-2">
                                            <div>
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-subtask-name-${subTask.id}`}>
                                                Название
                                              </label>
                                              <input
                                                id={`task-subtask-name-${subTask.id}`}
                                                type="text"
                                                value={subTask.name}
                                                onChange={(event) =>
                                                  handleSubTaskChange(
                                                    task.id,
                                                    subTask.id,
                                                    'name',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                            </div>
                                            <div>
                                              <label
                                                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                                htmlFor={`task-subtask-bonus-${subTask.id}`}
                                              >
                                                Бонус
                                              </label>
                                              <input
                                                id={`task-subtask-bonus-${subTask.id}`}
                                                type="number"
                                                min="0"
                                                value={subTask.bonus ?? 0}
                                                onChange={(event) =>
                                                  handleSubTaskChange(
                                                    task.id,
                                                    subTask.id,
                                                    'bonus',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-subtask-text-${subTask.id}`}>
                                              Описание
                                            </label>
                                            <textarea
                                              id={`task-subtask-text-${subTask.id}`}
                                              rows={3}
                                              value={subTask.task}
                                              onChange={(event) =>
                                                handleSubTaskChange(
                                                  task.id,
                                                  subTask.id,
                                                  'task',
                                                  event.target.value
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-500">Подзаданий пока нет.</p>
                                  )}
                                </div>

                                <div>
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Штрафные коды</h4>
                                    <button
                                      type="button"
                                      onClick={() => handleAddPenaltyCode(task.id)}
                                      className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                    >
                                      Добавить штраф
                                    </button>
                                  </div>
                                  {task.penaltyCodes?.length > 0 ? (
                                    <div className="mt-3 space-y-4">
                                      {task.penaltyCodes.map((penalty) => (
                                        <div
                                          key={penalty.id}
                                          className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                        >
                                          <div className="grid gap-3 md:grid-cols-4">
                                            <div className="md:col-span-2">
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-penalty-code-${penalty.id}`}>
                                                Код
                                              </label>
                                              <input
                                                id={`task-penalty-code-${penalty.id}`}
                                                type="text"
                                                value={penalty.code}
                                                onChange={(event) =>
                                                  handlePenaltyCodeChange(
                                                    task.id,
                                                    penalty.id,
                                                    'code',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-penalty-value-${penalty.id}`}>
                                                Штраф
                                              </label>
                                              <input
                                                id={`task-penalty-value-${penalty.id}`}
                                                type="number"
                                                min="0"
                                                value={penalty.penalty ?? 0}
                                                onChange={(event) =>
                                                  handlePenaltyCodeChange(
                                                    task.id,
                                                    penalty.id,
                                                    'penalty',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-penalty-description-${penalty.id}`}>
                                              Комментарий
                                            </label>
                                            <input
                                              id={`task-penalty-description-${penalty.id}`}
                                              type="text"
                                              value={penalty.description}
                                              onChange={(event) =>
                                                handlePenaltyCodeChange(
                                                  task.id,
                                                  penalty.id,
                                                  'description',
                                                  event.target.value
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                            />
                                          </div>
                                          <div className="flex justify-end">
                                            <button
                                              type="button"
                                              onClick={() => handleRemovePenaltyCode(task.id, penalty.id)}
                                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                            >
                                              Удалить штраф
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-500">Штрафных кодов пока нет.</p>
                                  )}
                                </div>

                                <div>
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Бонусные коды</h4>
                                    <button
                                      type="button"
                                      onClick={() => handleAddBonusCode(task.id)}
                                      className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                    >
                                      Добавить бонус
                                    </button>
                                  </div>
                                  {task.bonusCodes?.length > 0 ? (
                                    <div className="mt-3 space-y-4">
                                      {task.bonusCodes.map((bonus) => (
                                        <div
                                          key={bonus.id}
                                          className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                        >
                                          <div className="grid gap-3 md:grid-cols-4">
                                            <div className="md:col-span-2">
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-bonus-code-${bonus.id}`}>
                                                Код
                                              </label>
                                              <input
                                                id={`task-bonus-code-${bonus.id}`}
                                                type="text"
                                                value={bonus.code}
                                                onChange={(event) =>
                                                  handleBonusCodeChange(
                                                    task.id,
                                                    bonus.id,
                                                    'code',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-bonus-value-${bonus.id}`}>
                                                Бонус
                                              </label>
                                              <input
                                                id={`task-bonus-value-${bonus.id}`}
                                                type="number"
                                                min="0"
                                                value={bonus.bonus ?? 0}
                                                onChange={(event) =>
                                                  handleBonusCodeChange(
                                                    task.id,
                                                    bonus.id,
                                                    'bonus',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-bonus-description-${bonus.id}`}>
                                              Комментарий
                                            </label>
                                            <input
                                              id={`task-bonus-description-${bonus.id}`}
                                              type="text"
                                              value={bonus.description}
                                              onChange={(event) =>
                                                handleBonusCodeChange(
                                                  task.id,
                                                  bonus.id,
                                                  'description',
                                                  event.target.value
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                            />
                                          </div>
                                          <div className="flex justify-end">
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveBonusCode(task.id, bonus.id)}
                                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                            >
                                              Удалить бонус
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-500">Бонусных кодов пока нет.</p>
                                  )}
                                </div>

                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTask(task.id)}
                                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                  >
                                    Удалить задание
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Пока нет заданий. Добавьте первое, чтобы начать.
                    </p>
                  )}
                  </section>

                  <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                  <h2 className="text-lg font-semibold text-primary">Публикация и результаты</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGame.hidden)}
                        onChange={(event) =>
                          updateSelectedGame({ hidden: event.target.checked })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      Игра скрыта из общего списка
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGame.showCreator)}
                        onChange={(event) =>
                          updateSelectedGame({ showCreator: event.target.checked })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      Показывать организатора игрокам
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGame.showTasks)}
                        onChange={(event) =>
                          updateSelectedGame({ showTasks: event.target.checked })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      Открыть задания после завершения
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGame.hideResult)}
                        onChange={(event) =>
                          updateSelectedGame({ hideResult: event.target.checked })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      Скрыть результаты для участников
                    </label>
                  </div>
                  </section>

                  <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-primary">Стоимость участия</h2>
                    <button
                      type="button"
                      onClick={handleAddPrice}
                      className="px-3 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
                    >
                      Добавить тариф
                    </button>
                  </div>

                  {(selectedGame.prices ?? []).length > 0 ? (
                    <div className="space-y-3">
                      {selectedGame.prices.map((price) => (
                        <div
                          key={price.id}
                          className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-center p-4 border border-slate-200 dark:border-slate-700 rounded-2xl"
                        >
                          <input
                            type="text"
                            value={price.name}
                            onChange={(event) =>
                              handlePriceChange(price.id, 'name', event.target.value)
                            }
                            placeholder="Название тарифа"
                            className="w-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                          <input
                            type="number"
                            min="0"
                            value={price.price}
                            onChange={(event) =>
                              handlePriceChange(price.id, 'price', event.target.value)
                            }
                            placeholder="Стоимость"
                            className="w-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePrice(price.id)}
                            className="px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50"
                          >
                            Удалить
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Добавьте тариф, чтобы задать стоимость участия для команд.
                    </p>
                  )}
                </section>

                <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-primary">Финансы игры</h2>
                    <button
                      type="button"
                      onClick={handleAddFinance}
                      className="px-3 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
                    >
                      Добавить запись
                    </button>
                  </div>

                  {(selectedGame.finances ?? []).length > 0 ? (
                    <div className="space-y-3">
                      {selectedGame.finances.map((entry) => (
                        <div
                          key={entry.id}
                          className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-center p-4 border border-slate-200 dark:border-slate-700 rounded-2xl"
                        >
                          <select
                            value={entry.type}
                            onChange={(event) =>
                              handleFinanceChange(entry.id, 'type', event.target.value)
                            }
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          >
                            <option value="income">Доход</option>
                            <option value="expense">Расход</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            value={entry.sum}
                            onChange={(event) =>
                              handleFinanceChange(entry.id, 'sum', event.target.value)
                            }
                            placeholder="Сумма"
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                          <input
                            type="date"
                            value={entry.date ? formatDate(entry.date, true) : ''}
                            onChange={(event) =>
                              handleFinanceChange(entry.id, 'date', event.target.value)
                            }
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveFinance(entry.id)}
                            className="px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50"
                          >
                            Удалить
                          </button>
                          <div className="md:col-span-3">
                            <input
                              type="text"
                              value={entry.description}
                              onChange={(event) =>
                                handleFinanceChange(entry.id, 'description', event.target.value)
                              }
                              placeholder="Комментарий"
                              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Пока нет финансовых записей по этой игре. Добавьте доходы и расходы, чтобы контролировать бюджет.
                    </p>
                  )}

                  <div className="p-4 bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                    <p className="text-sm text-slate-600">
                      Доходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.income)}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Расходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.expense)}</span>
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${balanceClass}`}>
                      Баланс: {currencyFormatter.format(financesSummary.balance)}
                    </p>
                  </div>
                  </section>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={handleModalPrimaryAction}
                      disabled={
                        isSaving || (isDirty && (!canEditSelectedGame || !location))
                      }
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                        isSaving || (isDirty && (!canEditSelectedGame || !location))
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-primary hover:bg-blue-700'
                      }`}
                    >
                      {isDirty
                        ? isSaving
                          ? 'Сохранение…'
                          : 'Сохранить и закрыть'
                        : 'Закрыть'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetChanges}
                      disabled={!canEditSelectedGame || !isDirty}
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold rounded-xl border transition ${
                        !canEditSelectedGame || !isDirty
                          ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                          : 'border-primary text-primary hover:bg-blue-50 dark:hover:bg-violet-500/10'
                      }`}
                    >
                      Отменить изменения
                    </button>
                  </div>
                </fieldset>
                </Modal>
                <Modal
                  isOpen={isTeamsModalOpen}
                  title={`Команды игры «${selectedGame.name || 'Без названия'}»`}
                  onClose={handleCloseTeamsModal}
                >
                  <div className="space-y-5">
                    {teamsModalState.error && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {teamsModalState.error}
                      </div>
                    )}

                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-primary">Зарегистрированные команды</h3>
                      {teamsModalState.isLoading ? (
                        <p className="text-sm text-slate-500">Загружаем список команд…</p>
                      ) : teamsModalState.gameTeams.length > 0 ? (
                        <ul className="space-y-3">
                          {teamsModalState.gameTeams.map((team) => {
                            const isRemoving = removingTeamIds.includes(team.id)
                            return (
                              <li
                                key={team.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="font-semibold text-primary">{team.teamName}</p>
                                    {team.teamDescription ? (
                                      <p className="mt-1 text-xs text-slate-500">{team.teamDescription}</p>
                                    ) : null}
                                    <p className="mt-1 text-xs text-slate-400">ID команды: {team.teamId || '—'}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTeamFromGame(team.id)}
                                    disabled={isRemoving || teamsModalState.isLoading}
                                    className={`inline-flex justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                      isRemoving || teamsModalState.isLoading
                                        ? 'cursor-not-allowed border-slate-200 text-slate-400'
                                        : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                    }`}
                                  >
                                    {isRemoving ? 'Удаление…' : 'Удалить'}
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">Пока ни одна команда не зарегистрирована на эту игру.</p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                      <h3 className="text-sm font-semibold text-primary">Добавить команду</h3>
                      {teamsModalState.availableTeams.length > 0 ? (
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <select
                            value={selectedTeamToAdd}
                            onChange={(event) => setSelectedTeamToAdd(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                          >
                            {teamsModalState.availableTeams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAddTeamToGame}
                            disabled={!selectedTeamToAdd || isAddingTeam || teamsModalState.isLoading}
                            className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                              !selectedTeamToAdd || isAddingTeam || teamsModalState.isLoading
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-primary hover:bg-blue-700'
                            }`}
                          >
                            {isAddingTeam ? 'Добавление…' : 'Добавить'}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          Свободных команд не найдено. Создайте команду или освободите её от участия в игре.
                        </p>
                      )}
                    </div>
                  </div>
                </Modal>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
                <p>Выберите игру из списка слева, чтобы просмотреть детали.</p>
              </div>
            )}
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

const priceShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  price: PropTypes.number,
})

const financeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['income', 'expense']),
  sum: PropTypes.number,
  date: PropTypes.string,
  description: PropTypes.string,
})

const clueShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  mongoId: PropTypes.string,
  clue: PropTypes.string,
  images: PropTypes.arrayOf(PropTypes.string),
})

const subTaskShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  mongoId: PropTypes.string,
  name: PropTypes.string,
  task: PropTypes.string,
  bonus: PropTypes.number,
})

const penaltyCodeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  mongoId: PropTypes.string,
  code: PropTypes.string,
  penalty: PropTypes.number,
  description: PropTypes.string,
})

const bonusCodeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  mongoId: PropTypes.string,
  code: PropTypes.string,
  bonus: PropTypes.number,
  description: PropTypes.string,
})

const coordinatesShape = PropTypes.shape({
  latitude: PropTypes.number,
  longitude: PropTypes.number,
  radius: PropTypes.number,
})

GamesPage.propTypes = {
  initialGames: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      status: PropTypes.string,
      dateStart: PropTypes.string,
      type: PropTypes.string,
      description: PropTypes.string,
      image: PropTypes.string,
      startingPlace: PropTypes.string,
      finishingPlace: PropTypes.string,
      taskDuration: PropTypes.number,
      cluesDuration: PropTypes.number,
      clueEarlyAccessMode: PropTypes.string,
      clueEarlyPenalty: PropTypes.number,
      allowCaptainForceClue: PropTypes.bool,
      allowCaptainFailTask: PropTypes.bool,
      allowCaptainFinishBreak: PropTypes.bool,
      breakDuration: PropTypes.number,
      taskFailurePenalty: PropTypes.number,
      manyCodesPenalty: PropTypes.arrayOf(PropTypes.number),
      individualStart: PropTypes.bool,
      hidden: PropTypes.bool,
      showCreator: PropTypes.bool,
      showTasks: PropTypes.bool,
      hideResult: PropTypes.bool,
      prices: PropTypes.arrayOf(priceShape),
      finances: PropTypes.arrayOf(financeShape),
      tasks: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          mongoId: PropTypes.string,
          title: PropTypes.string,
          task: PropTypes.string,
          taskBonusForComplite: PropTypes.number,
          clues: PropTypes.arrayOf(clueShape),
          subTasks: PropTypes.arrayOf(subTaskShape),
          images: PropTypes.arrayOf(PropTypes.string),
          codes: PropTypes.arrayOf(PropTypes.string),
          coordinates: coordinatesShape,
          penaltyCodes: PropTypes.arrayOf(penaltyCodeShape),
          bonusCodes: PropTypes.arrayOf(bonusCodeShape),
          numCodesToCompliteTask: PropTypes.number,
          postMessage: PropTypes.string,
          canceled: PropTypes.bool,
          isBonusTask: PropTypes.bool,
        })
      ),
      teamsCount: PropTypes.number,
      tasksStats: PropTypes.shape({
        total: PropTypes.number,
        bonus: PropTypes.number,
        canceled: PropTypes.number,
      }),
      updatedAt: PropTypes.string,
      createdAt: PropTypes.string,
    })
  ),
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

GamesPage.defaultProps = {
  initialGames: [],
  initialLocation: null,
  session: null,
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/games'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  const userRole = session?.user?.role ?? 'client'
  const rawTelegramId = session?.user?.telegramId
  const numericTelegramId =
    rawTelegramId === null || rawTelegramId === undefined
      ? null
      : Number(rawTelegramId)
  const creatorTelegramId = Number.isFinite(numericTelegramId)
    ? numericTelegramId
    : null
  let initialGames = []

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const GamesModel = db.model('Games')
        const GamesTeamsModel = db.model('GamesTeams')

        const canLoadAllGames = userRole === 'admin' || userRole === 'dev'
        const canLoadOwnGames = userRole === 'moder' && creatorTelegramId !== null

        if (canLoadAllGames || canLoadOwnGames) {
          const query = canLoadAllGames ? {} : { creatorTelegramId }

          const gamesDocs = await GamesModel.find(query)
            .sort({ updatedAt: -1 })
            .select({
              _id: 1,
              name: 1,
              status: 1,
              dateStart: 1,
              dateStartFact: 1,
              dateEndFact: 1,
              type: 1,
              description: 1,
              image: 1,
              startingPlace: 1,
              finishingPlace: 1,
              taskDuration: 1,
              cluesDuration: 1,
              clueEarlyAccessMode: 1,
              clueEarlyPenalty: 1,
              allowCaptainForceClue: 1,
              allowCaptainFailTask: 1,
              allowCaptainFinishBreak: 1,
              breakDuration: 1,
              taskFailurePenalty: 1,
              manyCodesPenalty: 1,
              individualStart: 1,
              hidden: 1,
              showCreator: 1,
              showTasks: 1,
              hideResult: 1,
              prices: 1,
              finances: 1,
              tasks: 1,
              updatedAt: 1,
              createdAt: 1,
              creatorTelegramId: 1,
            })
            .lean()

          const gameIds = gamesDocs
            .map((game) => (game?._id ? game._id.toString() : null))
            .filter(Boolean)

          let teamsCountMap = {}

          if (gameIds.length > 0) {
            const gamesTeams = await GamesTeamsModel.find({ gameId: { $in: gameIds } })
              .select({ gameId: 1 })
              .lean()

            teamsCountMap = gamesTeams.reduce((acc, doc) => {
              if (!doc?.gameId) {
                return acc
              }

              const key = doc.gameId
              acc[key] = (acc[key] ?? 0) + 1
              return acc
            }, {})
          }

          initialGames = gamesDocs.map((game) =>
            normalizeGameForCabinet({
              ...game,
              teamsCount: game?._id ? teamsCountMap[game._id.toString()] ?? 0 : 0,
            })
          )
        }
      }
    } catch (error) {
      console.error('Failed to load games for cabinet', error)
    }
  }

  return {
    props: {
      session,
      initialGames,
      initialLocation: location,
    },
  }
}

export default GamesPage
