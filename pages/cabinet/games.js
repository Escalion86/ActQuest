import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import GameModals from '@components/modals/GameModals'
import getSessionSafe from '@helpers/getSessionSafe'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import { getNounTeams } from '@helpers/getNoun'
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

const extractErrorMessage = (error) => {
  if (!error) {
    return null
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message
  }

  if (typeof error.error === 'string' && error.error.trim().length > 0) {
    return error.error
  }

  return null
}

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

  const moderatorsSet = new Set()
  const normalizedModerators = Array.isArray(game.moderators)
    ? game.moderators
    : []

  normalizedModerators.forEach((moderator) => {
    if (!moderator) {
      return
    }

    if (typeof moderator === 'string' && moderator) {
      moderatorsSet.add(moderator)
      return
    }

    if (typeof moderator?.id === 'string' && moderator.id) {
      moderatorsSet.add(moderator.id)
    }
  })

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
    moderators: Array.from(moderatorsSet),
  }
}

const GamesPage = ({
  initialGames,
  initialLocation,
  session: initialSession,
  availableModerators: initialAvailableModerators,
}) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const userRole = activeSession?.user?.role ?? 'client'
  const currentUserTelegramId = activeSession?.user?.telegramId ?? null
  const currentUserIdString =
    currentUserTelegramId === null || currentUserTelegramId === undefined
      ? null
      : String(currentUserTelegramId)
  const currentUserTelegramIdNumber =
    currentUserTelegramId === null || currentUserTelegramId === undefined
      ? null
      : Number(currentUserTelegramId)
  const canEditAllGames = userRole === 'admin' || userRole === 'dev'
  const canEditOwnGames = userRole === 'moder'
  const currentUserDbId =
    activeSession?.user?._id === null || activeSession?.user?._id === undefined
      ? null
      : String(activeSession.user._id)

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
  const [selectedModeratorToAdd, setSelectedModeratorToAdd] = useState('')
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [registerGameId, setRegisterGameId] = useState('')
  const [registerTeamId, setRegisterTeamId] = useState('')
  const [registerTeams, setRegisterTeams] = useState([])
  const [isRegisterTeamsLoading, setIsRegisterTeamsLoading] = useState(false)
  const [registerFeedback, setRegisterFeedback] = useState(null)
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false)
  const [isCreateGameModalOpen, setIsCreateGameModalOpen] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [createGameFeedback, setCreateGameFeedback] = useState(null)
  const [isCreatingGame, setIsCreatingGame] = useState(false)

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
    setExpandedTaskIds([])
    setTeamsModalState({
      isLoading: false,
      error: null,
      gameTeams: [],
      availableTeams: [],
    })
    setSelectedTeamToAdd('')
    setRemovingTeamIds([])
    setSelectedModeratorToAdd('')
  }, [selectedGameId])

  const sortGamesByUpdatedAt = useCallback((items) => {
    if (!Array.isArray(items)) {
      return []
    }

    return [...items].sort((first, second) => {
      const firstTime = first?.updatedAt ? new Date(first.updatedAt).getTime() : 0
      const secondTime = second?.updatedAt
        ? new Date(second.updatedAt).getTime()
        : 0

      if (Number.isNaN(secondTime) && Number.isNaN(firstTime)) {
        return 0
      }

      if (Number.isNaN(secondTime)) {
        return -1
      }

      if (Number.isNaN(firstTime)) {
        return 1
      }

      return secondTime - firstTime
    })
  }, [])

  const resetRegisterForm = useCallback(() => {
    setRegisterGameId('')
    setRegisterTeamId('')
    setRegisterFeedback(null)
  }, [])

  const handleCloseRegisterModal = useCallback(() => {
    if (isRegisterSubmitting) {
      return
    }

    setIsRegisterModalOpen(false)
    setRegisterTeams([])
    setIsRegisterTeamsLoading(false)
    resetRegisterForm()
  }, [isRegisterSubmitting, resetRegisterForm])

  const loadRegisterTeams = useCallback(async () => {
    if (!location || !Number.isFinite(currentUserTelegramIdNumber)) {
      setRegisterTeams([])
      setRegisterTeamId('')
      return
    }

    setIsRegisterTeamsLoading(true)

    try {
      const membershipsParams = new URLSearchParams({
        collection: 'teamsusers',
        userTelegramId: String(currentUserTelegramIdNumber),
        role: 'capitan',
        limit: '200',
      })

      const membershipsResponse = await fetch(
        `/api/${location}/custom?${membershipsParams.toString()}`
      )
      const membershipsJson = await membershipsResponse.json()

      if (!membershipsResponse.ok || membershipsJson?.success === false) {
        if (
          membershipsResponse.status === 404 ||
          membershipsResponse.status === 204 ||
          membershipsJson?.errorCode === 'not_found'
        ) {
          setRegisterTeams([])
          setRegisterTeamId('')
          return
        }

        throw new Error(
          extractErrorMessage(membershipsJson?.error) ||
            'Не удалось загрузить список команд'
        )
      }

      const memberships = Array.isArray(membershipsJson?.data)
        ? membershipsJson.data
        : []

      const toStringId = (value) => {
        if (!value) {
          return null
        }

        if (typeof value === 'string') {
          return value
        }

        if (typeof value === 'object' && typeof value.toString === 'function') {
          const stringValue = value.toString()
          return stringValue === '[object Object]' ? null : stringValue
        }

        if (typeof value === 'number') {
          return value.toString()
        }

        return null
      }

      const teamIds = Array.from(
        new Set(
          memberships
            .map((membership) => toStringId(membership?.teamId))
            .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
        )
      )

      if (teamIds.length === 0) {
        setRegisterTeams([])
        setRegisterTeamId('')
        return
      }

      const teamsParams = new URLSearchParams({
        location,
        teamIds: teamIds.join(','),
      })

      const teamsResponse = await fetch(
        `/api/cabinet/teams?${teamsParams.toString()}`
      )
      const teamsJson = await teamsResponse.json()

      if (!teamsResponse.ok || teamsJson?.success === false) {
        if (
          teamsResponse.status === 404 ||
          teamsResponse.status === 204 ||
          teamsJson?.errorCode === 'not_found'
        ) {
          setRegisterTeams([])
          setRegisterTeamId('')
          return
        }

        throw new Error(
          extractErrorMessage(teamsJson?.error) ||
            'Не удалось загрузить данные команд'
        )
      }

      const teamsList = Array.isArray(teamsJson?.data)
        ? teamsJson.data.filter(Boolean)
        : []

      teamsList.sort((first, second) => {
        const firstName = (first?.name ?? '').toLowerCase()
        const secondName = (second?.name ?? '').toLowerCase()
        return firstName.localeCompare(secondName, 'ru')
      })

      setRegisterTeams(teamsList)

      if (teamsList.length === 1) {
        setRegisterTeamId(teamsList[0].id)
      }
    } catch (error) {
      console.error('Failed to load register teams', error)
      setRegisterFeedback({
        type: 'error',
        message:
          extractErrorMessage(error) || 'Не удалось загрузить список команд',
      })
      setRegisterTeams([])
    } finally {
      setIsRegisterTeamsLoading(false)
    }
  }, [currentUserTelegramIdNumber, location])

  useEffect(() => {
    if (isRegisterModalOpen) {
      resetRegisterForm()
      loadRegisterTeams()
    } else {
      setIsRegisterSubmitting(false)
    }
  }, [isRegisterModalOpen, loadRegisterTeams, resetRegisterForm])

  const handleSubmitRegister = useCallback(async () => {
    const trimmedGameId = registerGameId.trim()

    if (!trimmedGameId) {
      setRegisterFeedback({
        type: 'error',
        message: 'Введите идентификатор игры',
      })
      return
    }

    if (!registerTeamId) {
      setRegisterFeedback({
        type: 'error',
        message: 'Выберите команду, которую хотите зарегистрировать',
      })
      return
    }

    if (!location) {
      setRegisterFeedback({
        type: 'error',
        message: 'Не удалось определить площадку пользователя',
      })
      return
    }

    if (!Number.isFinite(currentUserTelegramIdNumber)) {
      setRegisterFeedback({
        type: 'error',
        message: 'Привяжите Telegram-аккаунт в профиле, чтобы регистрировать команды',
      })
      return
    }

    const selectedTeam = registerTeams.find((team) => team.id === registerTeamId)

    if (!selectedTeam) {
      setRegisterFeedback({
        type: 'error',
        message: 'Выбранная команда недоступна для регистрации',
      })
      return
    }

    setIsRegisterSubmitting(true)
    setRegisterFeedback(null)

    try {
      const gameResponse = await fetch(
        `/api/${location}/custom?collection=games&id=${encodeURIComponent(
          trimmedGameId
        )}`
      )
      const gameJson = await gameResponse.json()

      if (!gameResponse.ok || gameJson?.success === false) {
        throw new Error(
          extractErrorMessage(gameJson?.error) || 'Игра не найдена'
        )
      }

      const gameData = gameJson?.data ?? null
      const gameStatus = (gameData?.status ?? '').toString().toLowerCase()

      if (gameStatus && gameStatus !== 'active') {
        throw new Error('Запись на эту игру закрыта')
      }

      const existingParams = new URLSearchParams({
        collection: 'gamesteams',
        teamId: registerTeamId,
        gameId: trimmedGameId,
        limit: '1',
      })

      const existingResponse = await fetch(
        `/api/${location}/custom?${existingParams.toString()}`
      )
      const existingJson = await existingResponse.json()

      if (
        existingResponse.ok &&
        Array.isArray(existingJson?.data) &&
        existingJson.data.length > 0
      ) {
        throw new Error('Команда уже зарегистрирована на эту игру')
      }

      const registerResponse = await fetch(
        `/api/${location}/custom?collection=gamesteams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              teamId: registerTeamId,
              gameId: trimmedGameId,
            },
          }),
        }
      )
      const registerJson = await registerResponse.json()

      if (!registerResponse.ok || registerJson?.success === false) {
        throw new Error(
          extractErrorMessage(registerJson?.error) ||
            'Не удалось зарегистрироваться на игру'
        )
      }

      setRegisterFeedback({
        type: 'success',
        message: `Команда «${selectedTeam.name || 'без названия'}» зарегистрирована на игру`,
      })
      setRegisterGameId('')

      setGames((prev) =>
        prev.map((game) => {
          if (game.id !== trimmedGameId) {
            return game
          }

          return {
            ...game,
            teamsCount: (game.teamsCount ?? 0) + 1,
          }
        })
      )

      setPersistedGames((prev) =>
        prev.map((game) => {
          if (game.id !== trimmedGameId) {
            return game
          }

          return {
            ...game,
            teamsCount: (game.teamsCount ?? 0) + 1,
          }
        })
      )
    } catch (error) {
      console.error('Failed to register team to game', error)
      setRegisterFeedback({
        type: 'error',
        message:
          extractErrorMessage(error) ||
          'Не удалось зарегистрироваться на игру',
      })
    } finally {
      setIsRegisterSubmitting(false)
    }
  }, [
    currentUserTelegramIdNumber,
    location,
    registerGameId,
    registerTeamId,
    registerTeams,
    setGames,
    setPersistedGames,
  ])

  const handleOpenRegisterModal = useCallback(() => {
    setIsRegisterModalOpen(true)
  }, [])

  const handleOpenCreateGameModal = useCallback(() => {
    setCreateGameFeedback(null)
    setNewGameName('')
    setIsCreateGameModalOpen(true)
  }, [])

  const handleCloseCreateGameModal = useCallback(() => {
    if (isCreatingGame) {
      return
    }

    setIsCreateGameModalOpen(false)
    setNewGameName('')
    setCreateGameFeedback(null)
  }, [isCreatingGame])

  const handleCreateGame = useCallback(async () => {
    const trimmedName = newGameName.trim()

    if (!trimmedName) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Введите название игры',
      })
      return
    }

    if (!location) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Не удалось определить площадку пользователя',
      })
      return
    }

    if (!canEditAllGames) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Недостаточно прав для создания игры',
      })
      return
    }

    if (!Number.isFinite(currentUserTelegramIdNumber)) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Привяжите Telegram-аккаунт в профиле, чтобы создавать игры',
      })
      return
    }

    setIsCreatingGame(true)
    setCreateGameFeedback(null)

    try {
      const payload = {
        ...buildUpdatePayload({
          name: trimmedName,
          status: 'active',
          dateStart: null,
          type: 'classic',
          description: '',
          image: null,
          startingPlace: '',
          finishingPlace: '',
          taskDuration: 3600,
          cluesDuration: 1200,
          clueEarlyAccessMode: 'time',
          clueEarlyPenalty: 0,
          allowCaptainForceClue: true,
          allowCaptainFailTask: true,
          allowCaptainFinishBreak: true,
          breakDuration: 0,
          taskFailurePenalty: 0,
          manyCodesPenalty: [0, 0],
          individualStart: false,
          hidden: true,
          showCreator: true,
          showTasks: false,
          hideResult: false,
          prices: [],
          finances: [],
          tasks: [],
          moderators: [],
        }),
        creatorTelegramId: currentUserTelegramIdNumber,
      }

      const response = await fetch(
        `/api/${location}/custom?collection=games`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payload }),
        }
      )

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(
          extractErrorMessage(json?.error) || 'Не удалось создать игру'
        )
      }

      const createdGame = normalizeGameForCabinet({
        ...json.data,
        teamsCount: 0,
      })

      if (!createdGame) {
        throw new Error('Не удалось обработать данные созданной игры')
      }

      setGames((prev) =>
        sortGamesByUpdatedAt([
          createdGame,
          ...prev.filter((game) => game.id !== createdGame.id),
        ])
      )
      setPersistedGames((prev) =>
        sortGamesByUpdatedAt([
          createdGame,
          ...prev.filter((game) => game.id !== createdGame.id),
        ])
      )
      setSelectedGameId(createdGame.id)

      setFeedback({
        type: 'success',
        message: `Игра «${createdGame.name || 'Без названия'}» создана`,
      })

      setIsCreateGameModalOpen(false)
      setIsEditModalOpen(true)
    } catch (error) {
      console.error('Failed to create game', error)
      setCreateGameFeedback({
        type: 'error',
        message:
          extractErrorMessage(error) || 'Не удалось создать игру',
      })
    } finally {
      setIsCreatingGame(false)
    }
  }, [
    buildUpdatePayload,
    canEditAllGames,
    currentUserTelegramIdNumber,
    location,
    newGameName,
    setFeedback,
    setGames,
    setPersistedGames,
    setSelectedGameId,
    sortGamesByUpdatedAt,
  ])

  const availableModerators = useMemo(
    () =>
      Array.isArray(initialAvailableModerators)
        ? initialAvailableModerators
        : [],
    [initialAvailableModerators]
  )

  const availableModeratorsMap = useMemo(
    () =>
      new Map(
        availableModerators.map((moderator) => [moderator.id, moderator])
      ),
    [availableModerators]
  )

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
      }),
    []
  )

  const upcomingGames = useMemo(
    () =>
      games.filter((game) => {
        const status = (game?.status ?? '').toString().toLowerCase()
        return status !== 'finished' && status !== 'canceled'
      }),
    [games]
  )

  const pastGames = useMemo(
    () =>
      games.filter((game) => {
        const status = (game?.status ?? '').toString().toLowerCase()
        return status === 'finished' || status === 'canceled'
      }),
    [games]
  )

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId]
  )

  const isPhotoGame = selectedGame?.type === 'photo'

  useEffect(() => {
    if (!selectedGame) {
      setIsDescriptionModalOpen(false)
    }
  }, [selectedGame])

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

  const isGameModerator = useMemo(() => {
    if (!selectedGame || !currentUserDbId) {
      return false
    }

    return (selectedGame.moderators ?? []).some((moderator) => {
      if (!moderator) {
        return false
      }

      if (typeof moderator === 'string') {
        return moderator === currentUserDbId
      }

      return moderator.id === currentUserDbId
    })
  }, [currentUserDbId, selectedGame])

  const isDirty = useMemo(() => {
    if (!selectedGame || !persistedSelectedGame) {
      return false
    }

    return (
      serializeGameForComparison(selectedGame) !==
      serializeGameForComparison(persistedSelectedGame)
    )
  }, [persistedSelectedGame, selectedGame])

  const canEditSelectedGame = useMemo(() => {
    if (!selectedGame) {
      return false
    }

    if (canEditAllGames) {
      return true
    }

    if (isGameModerator) {
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
  }, [canEditAllGames, canEditOwnGames, currentUserIdString, isGameModerator, selectedGame])

  const canViewRestrictedGameInfo = canEditSelectedGame

  const canManageTeams = canViewRestrictedGameInfo

  const canManageGame = useCallback(
    (game) => {
      if (!game) {
        return false
      }

      if (canEditAllGames) {
        return true
      }

      if (canEditOwnGames) {
        if (!currentUserIdString) {
          return false
        }

        const creatorId = game?.creatorTelegramId
        if (creatorId && creatorId === currentUserIdString) {
          return true
        }
      }

      if (!currentUserDbId) {
        return false
      }

      const moderators = Array.isArray(game?.moderators)
        ? game.moderators
        : []

      return moderators.some((moderator) => {
        if (!moderator) {
          return false
        }

        if (typeof moderator === 'string') {
          return moderator === currentUserDbId
        }

        return moderator.id === currentUserDbId
      })
    },
    [canEditAllGames, canEditOwnGames, currentUserDbId, currentUserIdString]
  )

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

    setIsDescriptionModalOpen(false)
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
      const teamsParams = new URLSearchParams({ location })
      const [gameTeamsResponse, teamsResponse] = await Promise.all([
        fetch(
          `/api/cabinet/games/${encodeURIComponent(
            selectedGame.id
          )}/teams?${teamsParams.toString()}`
        ),
        fetch(`/api/${location}/custom?collection=teams&limit=200&sort=name_lowered`),
      ])

      const gameTeamsJson = await gameTeamsResponse.json()
      if (!gameTeamsResponse.ok || gameTeamsJson?.success === false) {
        throw new Error(
          extractErrorMessage(gameTeamsJson?.error) ||
            'Не удалось загрузить команды игры'
        )
      }

      const teamsJson = await teamsResponse.json()
      if (!teamsResponse.ok || teamsJson?.success === false) {
        throw new Error(
          extractErrorMessage(teamsJson?.error) ||
            'Не удалось загрузить список команд'
        )
      }

      const gameTeamsEntries = Array.isArray(gameTeamsJson?.data?.entries)
        ? gameTeamsJson.data.entries
        : []
      const linkedTeams = Array.isArray(gameTeamsJson?.data?.teams)
        ? gameTeamsJson.data.teams
        : []
      const allTeamsData = Array.isArray(teamsJson.data) ? teamsJson.data : []

      const allTeamIds = allTeamsData
        .map((team) => {
          if (team?._id) {
            try {
              return team._id.toString()
            } catch (error) {
              return ''
            }
          }

          return ''
        })
        .filter((id) => typeof id === 'string' && id.length > 0)

      let detailedTeamsMap = {}

      if (allTeamIds.length > 0) {
        const detailedParams = new URLSearchParams({ location })
        allTeamIds.forEach((id) => detailedParams.append('teamIds', id))

        try {
          const detailedResponse = await fetch(
            `/api/cabinet/teams?${detailedParams.toString()}`
          )
          const detailedJson = await detailedResponse.json()

          if (detailedResponse.ok && detailedJson?.success !== false) {
            const detailedTeams = Array.isArray(detailedJson?.data)
              ? detailedJson.data
              : []

            detailedTeamsMap = detailedTeams.reduce((acc, team) => {
              if (team?.id) {
                acc[team.id] = team
              }

              return acc
            }, {})
          } else {
            console.error(
              'Failed to load detailed team info for modal',
              detailedJson
            )
          }
        } catch (detailsError) {
          console.error(
            'Failed to load detailed team info for modal',
            detailsError
          )
        }
      }

      const linkedTeamsMap = linkedTeams.reduce((acc, team) => {
        if (team?.id) {
          acc[team.id] = team
        }

        return acc
      }, {})

      const gameTeams = gameTeamsEntries
        .map((entry) => {
          const entryId = entry?.id ? String(entry.id) : entry?._id?.toString()
          const teamId = entry?.teamId ? String(entry.teamId) : ''

          if (!entryId || !teamId) {
            return null
          }

          const teamInfo = linkedTeamsMap[teamId] ?? null
          const membersCount = Number.isFinite(teamInfo?.membersCount)
            ? teamInfo.membersCount
            : Array.isArray(teamInfo?.members)
            ? teamInfo.members.length
            : null

          return {
            id: entryId,
            teamId,
            teamName: teamInfo?.name || 'Неизвестная команда',
            teamDescription: teamInfo?.description || '',
            membersCount,
          }
        })
        .filter(Boolean)

      const allTeamsMap = allTeamsData.reduce((acc, team) => {
        if (team?._id) {
          const id = team._id.toString()
          const detailedTeam = detailedTeamsMap[id] ?? null
          const membersCount = Number.isFinite(detailedTeam?.membersCount)
            ? detailedTeam.membersCount
            : Array.isArray(detailedTeam?.members)
            ? detailedTeam.members.length
            : 0

          acc[id] = {
            id,
            name: team.name || 'Без названия',
            description: team.description || '',
            membersCount,
          }
        }

        return acc
      }, {})

      const existingTeamIds = new Set(gameTeams.map((entry) => entry.teamId))
      const availableTeams = Object.values(allTeamsMap).filter(
        (team) => team.id && !existingTeamIds.has(team.id)
      )

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
        error:
          extractErrorMessage(error) || 'Не удалось загрузить данные команд игры',
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
          data: {
            teamId: selectedTeamToAdd,
            gameId: selectedGame.id,
          },
        }),
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(
          extractErrorMessage(json?.error) || 'Не удалось добавить команду'
        )
      }

      await loadTeamsModalData()
    } catch (error) {
      console.error('Failed to add team to game', error)
      setTeamsModalState((prev) => ({
        ...prev,
        error: extractErrorMessage(error) || 'Не удалось добавить команду',
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
          throw new Error(
            extractErrorMessage(json?.error) || 'Не удалось удалить команду'
          )
        }

        await loadTeamsModalData()
      } catch (error) {
        console.error('Failed to remove team from game', error)
        setTeamsModalState((prev) => ({
          ...prev,
          error: extractErrorMessage(error) || 'Не удалось удалить команду',
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

  const handleSelectGameCard = useCallback((game) => {
    if (!game) {
      return
    }

    setSelectedGameId(game.id)
    setIsTeamsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDescriptionModalOpen(true)
  }, [])

  const handleEditGameFromList = useCallback(
    (game) => {
      if (!game || !canManageGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      setIsTeamsModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(true)
    },
    [canManageGame]
  )

  const handleManageTeamsFromList = useCallback(
    (game) => {
      if (!game || !canManageGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      setIsDescriptionModalOpen(false)
      setIsTeamsModalOpen(true)
    },
    [canManageGame]
  )

  const handleOpenEditModal = useCallback(() => {
    if (!canEditSelectedGame) {
      return
    }

    setIsDescriptionModalOpen(false)
    setIsEditModalOpen(true)
  }, [canEditSelectedGame])

  const handleCloseEditModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsEditModalOpen(false)
  }, [isSaving])

  const handleCloseDescriptionModal = useCallback(() => {
    setIsDescriptionModalOpen(false)
  }, [])

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

  const handleAddModerator = useCallback(() => {
    if (!selectedGame || !canEditSelectedGame) {
      return
    }

    const candidateId = selectedModeratorToAdd
    if (!candidateId) {
      return
    }

    const candidate = availableModeratorsMap.get(candidateId)
    if (!candidate) {
      return
    }

    updateSelectedGame((game) => {
      const currentModerators = Array.isArray(game.moderators)
        ? game.moderators.filter(Boolean)
        : []

      const alreadyExists = currentModerators.some((moderator) => {
        if (!moderator) {
          return false
        }

        if (typeof moderator === 'string') {
          return moderator === candidate.id
        }

        return moderator.id === candidate.id
      })

      if (alreadyExists) {
        return { moderators: currentModerators }
      }

      return {
        moderators: [...currentModerators, candidate],
      }
    })

    setSelectedModeratorToAdd('')
  }, [availableModeratorsMap, canEditSelectedGame, selectedGame, selectedModeratorToAdd, updateSelectedGame])

  const handleRemoveModerator = useCallback(
    (moderatorId) => {
      if (!canEditSelectedGame || !moderatorId) {
        return
      }

      updateSelectedGame((game) => ({
        moderators: (Array.isArray(game.moderators) ? game.moderators : []).filter((moderator) => {
          if (!moderator) {
            return false
          }

          if (typeof moderator === 'string') {
            return moderator !== moderatorId
          }

          return moderator.id !== moderatorId
        }),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const renderGameListItem = useCallback(
    (game) => {
      const startDateLabel = game.dateStart
        ? new Date(game.dateStart).toLocaleString('ru-RU', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : 'Дата не задана'

      const relativeUpdatedAt = game.updatedAt
        ? formatRelativeTimeFromNow(game.updatedAt)
        : '—'

      const canManageThisGame = canManageGame(game)

      return (
        <li key={game.id}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleSelectGameCard(game)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleSelectGameCard(game)
              }
            }}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-primary hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-violet-500/10"
            aria-pressed={selectedGameId === game.id}
            aria-label={`Открыть описание игры «${game.name || 'Без названия'}»`}
            title={game.name || 'Без названия'}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">
                  {game.name || 'Без названия'}
                </p>
              </div>
              {canManageThisGame && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleEditGameFromList(game)
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-slate-600 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:text-violet-100"
                    aria-label="Редактировать игру"
                    title="Редактировать игру"
                  >
                    <svg
                      className="h-4 w-4"
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
                        d="M12.5 5.5l2-2a1.5 1.5 0 112.121 2.121l-2 2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleManageTeamsFromList(game)
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-slate-600 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:text-violet-100"
                    aria-label="Управление командами"
                    title="Управление командами"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7 10a3 3 0 100-6 3 3 0 000 6z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.5 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2.5 15.5a4.5 4.5 0 019 0V17h-9v-1.5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.5 12.5c1.933 0 3.5 1.567 3.5 3.5V17h-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${getStatusBadgeClassName(game.status)}`}
              >
                {getGameStatusLabel(game.status)}
              </span>
              <span className="text-slate-500">{startDateLabel}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {canManageThisGame
                ? `${getNounTeams(game.teamsCount)} · Обновлено ${relativeUpdatedAt}`
                : getNounTeams(game.teamsCount)}
            </p>
          </div>
        </li>
      )
    },
    [canManageGame, getNounTeams, handleEditGameFromList, handleManageTeamsFromList, handleSelectGameCard, selectedGameId]
  )

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

  const selectedGameModerators = useMemo(() => {
    if (!selectedGame) {
      return []
    }

    return (selectedGame.moderators ?? []).filter(Boolean)
  }, [selectedGame])

  const availableModeratorsForSelect = useMemo(() => {
    if (!selectedGame) {
      return []
    }

    const existingIds = new Set(
      selectedGameModerators
        .map((moderator) => {
          if (!moderator) {
            return null
          }

          if (typeof moderator === 'string') {
            return moderator
          }

          return moderator.id
        })
        .filter(Boolean)
    )

    return availableModerators.filter((moderator) => !existingIds.has(moderator.id))
  }, [availableModerators, selectedGame, selectedGameModerators])

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
          <div className="md:col-span-5 space-y-4 md:max-w-4xl">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenRegisterModal}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Зарегистрироваться на игру по id
              </button>
              {canEditAllGames && (
                <button
                  type="button"
                  onClick={handleOpenCreateGameModal}
                  className="inline-flex items-center justify-center rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:hover:bg-violet-500/10"
                >
                  Создать игру
                </button>
              )}
            </div>
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

            {selectedGame && !location && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Не удалось определить площадку пользователя. Сохранение изменений недоступно.
              </div>
            )}

            {feedback && (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {feedback.message}
              </div>
            )}

            {selectedGame && editRestrictionMessage && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                {editRestrictionMessage}
              </div>
            )}

            {games.length > 0 ? (
              <div className="space-y-6">
                {upcomingGames.length > 0 && (
                  <div>
                    <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Активные и запланированные
                    </h3>
                    <ul className="mt-2 space-y-3">
                      {upcomingGames.map((game) => renderGameListItem(game))}
                    </ul>
                  </div>
                )}
                {pastGames.length > 0 && (
                  <div>
                    <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Завершённые и отменённые
                    </h3>
                    <ul className="mt-2 space-y-3">
                      {pastGames.map((game) => renderGameListItem(game))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-sm text-center text-slate-500 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                Для выбранного города пока нет игр. Создайте сценарий в телеграм-боте, чтобы он появился здесь.
              </div>
            )}
          </div>

          {selectedGame && (
            <div className="md:col-span-5">
              <div className="space-y-6">
                <GameModals
                  selectedGame={selectedGame}
                  isEditModalOpen={isEditModalOpen}
                  handleCloseEditModal={handleCloseEditModal}
                  canEditSelectedGame={canEditSelectedGame}
                  isSaving={isSaving}
                  location={location}
                  isDirty={isDirty}
                  handleModalPrimaryAction={handleModalPrimaryAction}
                  handleResetChanges={handleResetChanges}
                  updateSelectedGame={updateSelectedGame}
                  GAME_STATUS_OPTIONS={GAME_STATUS_OPTIONS}
                  GAME_TYPE_OPTIONS={GAME_TYPE_OPTIONS}
                  CLUE_EARLY_MODE_OPTIONS={CLUE_EARLY_MODE_OPTIONS}
                  toMinutes={toMinutes}
                  toSeconds={toSeconds}
                  handleAddTask={handleAddTask}
                  handleRemoveTask={handleRemoveTask}
                  handleTaskFieldChange={handleTaskFieldChange}
                  handleTaskNumberChange={handleTaskNumberChange}
                  handleTaskOptionalNumberChange={handleTaskOptionalNumberChange}
                  handleTaskCheckboxChange={handleTaskCheckboxChange}
                  handleTaskCoordinateChange={handleTaskCoordinateChange}
                  handleAddTaskCode={handleAddTaskCode}
                  handleTaskCodeChange={handleTaskCodeChange}
                  handleRemoveTaskCode={handleRemoveTaskCode}
                  handleAddTaskImage={handleAddTaskImage}
                  handleTaskImageChange={handleTaskImageChange}
                  handleRemoveTaskImage={handleRemoveTaskImage}
                  handleAddClue={handleAddClue}
                  handleTaskClueChange={handleTaskClueChange}
                  handleRemoveClue={handleRemoveClue}
                  handleAddClueImage={handleAddClueImage}
                  handleClueImageChange={handleClueImageChange}
                  handleRemoveClueImage={handleRemoveClueImage}
                  handleAddSubTask={handleAddSubTask}
                  handleSubTaskChange={handleSubTaskChange}
                  handleRemoveSubTask={handleRemoveSubTask}
                  handleAddPenaltyCode={handleAddPenaltyCode}
                  handlePenaltyCodeChange={handlePenaltyCodeChange}
                  handleRemovePenaltyCode={handleRemovePenaltyCode}
                  handleAddBonusCode={handleAddBonusCode}
                  handleBonusCodeChange={handleBonusCodeChange}
                  handleRemoveBonusCode={handleRemoveBonusCode}
                  handleAddPrice={handleAddPrice}
                  handlePriceChange={handlePriceChange}
                  handleRemovePrice={handleRemovePrice}
                  handleAddFinance={handleAddFinance}
                  handleFinanceChange={handleFinanceChange}
                  handleRemoveFinance={handleRemoveFinance}
                  currencyFormatter={currencyFormatter}
                  financesSummary={financesSummary}
                  balanceClass={balanceClass}
                  expandedTaskIds={expandedTaskIds}
                  toggleTaskExpansion={toggleTaskExpansion}
                  isTeamsModalOpen={isTeamsModalOpen}
                  handleCloseTeamsModal={handleCloseTeamsModal}
                  teamsModalState={teamsModalState}
                  removingTeamIds={removingTeamIds}
                  selectedTeamToAdd={selectedTeamToAdd}
                  setSelectedTeamToAdd={setSelectedTeamToAdd}
                  handleAddTeamToGame={handleAddTeamToGame}
                  isAddingTeam={isAddingTeam}
                  handleRemoveTeamFromGame={handleRemoveTeamFromGame}
                  isRegisterModalOpen={isRegisterModalOpen}
                  handleCloseRegisterModal={handleCloseRegisterModal}
                  isRegisterSubmitting={isRegisterSubmitting}
                  handleSubmitRegister={handleSubmitRegister}
                  registerTeamId={registerTeamId}
                  registerGameId={registerGameId}
                  setRegisterTeamId={setRegisterTeamId}
                  setRegisterGameId={setRegisterGameId}
                  registerFeedback={registerFeedback}
                  isRegisterTeamsLoading={isRegisterTeamsLoading}
                  registerTeams={registerTeams}
                  currentUserTelegramIdNumber={currentUserTelegramIdNumber}
                  isCreateGameModalOpen={isCreateGameModalOpen}
                  handleCloseCreateGameModal={handleCloseCreateGameModal}
                  isCreatingGame={isCreatingGame}
                  handleCreateGame={handleCreateGame}
                  newGameName={newGameName}
                  setNewGameName={setNewGameName}
                  createGameFeedback={createGameFeedback}
                  isDescriptionModalOpen={isDescriptionModalOpen}
                  handleCloseDescriptionModal={handleCloseDescriptionModal}
                  gameTypeLabel={gameTypeLabel}
                  plannedStartLabel={plannedStartLabel}
                  canViewRestrictedGameInfo={canViewRestrictedGameInfo}
                  selectedGameModerators={selectedGameModerators}
                  availableModeratorsForSelect={availableModeratorsForSelect}
                  availableModeratorsMap={availableModeratorsMap}
                  selectedModeratorToAdd={selectedModeratorToAdd}
                  setSelectedModeratorToAdd={setSelectedModeratorToAdd}
                  handleAddModerator={handleAddModerator}
                  handleRemoveModerator={handleRemoveModerator}
                  taskDurationLabel={taskDurationLabel}
                  cluesDurationLabel={cluesDurationLabel}
                  clueModeDetails={clueModeDetails}
                  breakDurationLabel={breakDurationLabel}
                  taskFailurePenaltyLabel={taskFailurePenaltyLabel}
                  manyCodesLimitLabel={manyCodesLimitLabel}
                  manyCodesPenaltyLabel={manyCodesPenaltyLabel}
                />
              </div>
            </div>
          )}
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

const moderatorShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  username: PropTypes.string,
  telegramId: PropTypes.string,
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
      moderators: PropTypes.arrayOf(moderatorShape),
    })
  ),
  initialLocation: PropTypes.string,
  session: PropTypes.object,
  availableModerators: PropTypes.arrayOf(moderatorShape),
}

GamesPage.defaultProps = {
  initialGames: [],
  initialLocation: null,
  session: null,
  availableModerators: [],
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
  let availableGameModerators = []

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const GamesModel = db.model('Games')
        const GamesTeamsModel = db.model('GamesTeams')
        const UsersModel = db.model('Users')

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
              moderators: 1,
            })
            .populate({
              path: 'moderators',
              select: { _id: 1, name: 1, username: 1, telegramId: 1 },
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

        const moderatorsDocs = await UsersModel.find({ role: 'moder' })
          .sort({ name: 1, username: 1 })
          .select({ _id: 1, name: 1, username: 1, telegramId: 1 })
          .lean()

        availableGameModerators = moderatorsDocs.map((moderator) => {
          const id = moderator?._id ? moderator._id.toString() : null

          if (!id) {
            return null
          }

          const telegramId =
            typeof moderator.telegramId === 'number'
              ? moderator.telegramId.toString()
              : moderator.telegramId

          return {
            id,
            name: moderator.name ?? '',
            username: moderator.username ?? '',
            telegramId: telegramId ? String(telegramId) : '',
          }
        }).filter(Boolean)
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
      availableModerators: availableGameModerators,
    },
  }
}

export default GamesPage
