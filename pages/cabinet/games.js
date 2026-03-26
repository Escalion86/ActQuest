import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useRouter } from 'next/router'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import SelectableCard from '@components/cabinet/SelectableCard'
import CardActionIconButton, {
  EditCardIcon,
  StatusCardIcon,
  TeamCardIcon,
} from '@components/cabinet/CardActionIconButton'
import FeedbackToast from '@components/FeedbackToast'
import NoticeBanner from '@components/NoticeBanner'
import GameModals from '@components/modals/GameModals'
import GameStatusModal from '@components/modals/GameStatusModal'
import getSessionSafe from '@helpers/getSessionSafe'
import extractErrorMessage from '@helpers/extractErrorMessage'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { toStringId } from '@helpers/idAndDate'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import fetchGamesForCabinet from '@helpers/fetchGamesForCabinet'
import requestApiJson from '@helpers/requestApiJson'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import { getNounTeams } from '@helpers/getNoun'
import NeonCheckbox from '@components/NeonCheckbox'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

const GAME_STATUS_BADGE_STYLES = {
  active:
    'border border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]',
  started:
    'border border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-[#17e6ae]/35 dark:bg-[#17e6ae]/12 dark:text-[#c8ffe9]',
  finished:
    'border border-violet-300 bg-violet-100 text-violet-700 dark:border-[#7A00FF]/35 dark:bg-[#7A00FF]/12 dark:text-[#e2d5ff]',
  closed:
    'border border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-[#8b5cf6]/45 dark:bg-[#8b5cf6]/14 dark:text-[#e9ddff]',
  canceled:
    'border border-rose-300 bg-rose-100 text-rose-700 dark:border-[#ff4d6d]/35 dark:bg-[#ff4d6d]/12 dark:text-[#ffd1da]',
}

const getStatusBadgeClassName = (status) => {
  if (!status) {
    return 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-100'
  }

  const normalized =
    typeof status === 'string' ? status.toLowerCase() : String(status)

  return (
    GAME_STATUS_BADGE_STYLES[normalized] ??
    'border border-slate-300 bg-slate-100 text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200'
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

const GAMES_PAGE_SIZE = 10
const GAMES_FILTER_LOCATION_STORAGE_KEY = 'cabinet_games_location_filter'
const GAMES_DISPLAY_MODE_STORAGE_KEY = 'cabinet_games_display_mode'
const PAST_GAMES_SEASON_FILTER_ALL = 'all'
const PAST_GAMES_SEASON_FILTER_OFFSEASON = 'offseason'
const PAST_GAMES_SEASON_FILTER_NONRATED = 'nonrated'
const CREATE_GAME_MODE_EMPTY = 'empty'
const CREATE_GAME_MODE_CLONE = 'clone'
const DEFAULT_CREATE_GAME_CLONE_OPTIONS = {
  basic: true,
  rules: true,
  captainRules: true,
  tasks: true,
  locations: true,
  moderators: true,
  publication: true,
  prices: true,
}

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
  const normalizedIsRated = Boolean(game.isRated ?? true)

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

const gameLocationOptions = Object.entries(LOCATIONS)
  .filter(([, value]) => !value?.hidden)
  .map(([key, value]) => ({
    key,
    label: value?.townRu
      ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
      : key.toUpperCase(),
  }))

const isClosedStatus = (status) =>
  (typeof status === 'string' ? status.toLowerCase() : String(status)) ===
  'closed'

const isGameConducted = (game) => {
  if (!game) {
    return false
  }

  const normalizedStatus = String(game.status || '').toLowerCase()
  if (
    normalizedStatus === 'started' ||
    normalizedStatus === 'finished' ||
    normalizedStatus === 'closed'
  ) {
    return true
  }

  return Boolean(game.dateStartFact || game.dateEndFact)
}

const normalizeVisibleStatus = (status, canSeeClosedStatus) => {
  if (isClosedStatus(status) && !canSeeClosedStatus) {
    return 'finished'
  }
  return status
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

const cloneGameDraft = (game) => {
  if (!game || typeof game !== 'object') {
    return null
  }

  return JSON.parse(JSON.stringify(game))
}

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
    }),
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
          description:
            typeof penalty.description === 'string' ? penalty.description : '',
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
          description:
            typeof bonus.description === 'string' ? bonus.description : '',
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
    ? [
        Number(game.manyCodesPenalty[0]) || 0,
        Number(game.manyCodesPenalty[1]) || 0,
      ]
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

  const normalizedIsRated = Boolean(game.isRated ?? true)

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
    isRated: normalizedIsRated,
    seasonId:
      normalizedIsRated &&
      typeof game.seasonId === 'string' &&
      game.seasonId.trim()
        ? game.seasonId.trim()
        : null,
    seasonName:
      normalizedIsRated &&
      typeof game.seasonName === 'string' &&
      game.seasonName.trim()
        ? game.seasonName.trim()
        : null,
    hidden: normalizedIsRated ? false : Boolean(game.hidden),
    showCreator: Boolean(game.showCreator),
    showTasks: Boolean(game.showTasks),
    hideResult: Boolean(game.hideResult),
    prices,
    finances,
    tasks,
    moderators: Array.from(moderatorsSet),
  }
}

const GameCardImage = ({ src, alt, className, placeholderClassName }) => {
  const [hasLoadError, setHasLoadError] = useState(false)

  if (!src || hasLoadError) {
    return (
      <div
        className={
          placeholderClassName ||
          'flex min-h-[180px] w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400'
        }
      >
        <img
          src="/logo_title.png"
          alt="ActQuest"
          className="aq-logo-float h-auto w-[70%] max-w-[220px] opacity-90"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className || 'block h-auto w-full'}
      loading="lazy"
      onError={() => setHasLoadError(true)}
    />
  )
}

GameCardImage.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  className: PropTypes.string,
  placeholderClassName: PropTypes.string,
}

GameCardImage.defaultProps = {
  src: '',
  alt: 'Изображение',
  className: '',
  placeholderClassName: '',
}

const GamesPage = ({
  initialGames,
  initialHasMore,
  initialLocation,
  session: initialSession,
  availableModerators: initialAvailableModerators,
}) => {
  const router = useRouter()
  const { activeSession } = useMergedSession(initialSession)
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const { effectiveRole: userRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
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
  const canSeeClosedStatus = userRole === 'admin' || userRole === 'dev'
  const canEditOwnGames = userRole === 'moder' || userRole === 'moderator'
  const safeInitialGames = Array.isArray(initialGames) ? initialGames : []
  const currentUserDbId =
    activeSession?.user?._id === null || activeSession?.user?._id === undefined
      ? null
      : String(activeSession.user._id)

  const [games, setGames] = useState(safeInitialGames)
  const [persistedGames, setPersistedGames] = useState(safeInitialGames)
  const [hasMoreGames, setHasMoreGames] = useState(Boolean(initialHasMore))
  const [isLoadingMoreGames, setIsLoadingMoreGames] = useState(false)
  const [selectedGameId, setSelectedGameId] = useState(
    safeInitialGames[0]?.id ?? null,
  )
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [statusModalGameId, setStatusModalGameId] = useState('')
  const [statusValidationResult, setStatusValidationResult] = useState(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toastEvent, setToastEvent] = useState(null)
  const setFeedback = useCallback((feedback) => {
    if (!feedback) {
      return
    }

    const type = feedback.type === 'error' ? 'error' : 'success'
    const message =
      typeof feedback.message === 'string' && feedback.message.trim()
        ? feedback.message
        : type === 'error'
          ? 'Произошла ошибка'
          : 'Операция выполнена'

    setToastEvent({
      id: Date.now(),
      type,
      message,
    })
  }, [])
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
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false)
  const [resultsModalState, setResultsModalState] = useState({
    isLoading: false,
    error: null,
    gameId: null,
    gameName: '',
    rows: [],
    teamsCount: 0,
    participantsCount: 0,
    computed: null,
    interactiveResultsUrl: null,
  })
  const [resultsCacheByGameId, setResultsCacheByGameId] = useState({})
  const [isGeneratingResults, setIsGeneratingResults] = useState(false)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [registerGameId, setRegisterGameId] = useState('')
  const [registerTeamId, setRegisterTeamId] = useState('')
  const [registerTeams, setRegisterTeams] = useState([])
  const [isRegisterTeamsLoading, setIsRegisterTeamsLoading] = useState(false)
  const [registerFeedback, setRegisterFeedback] = useState(null)
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false)
  const [isCreateGameModalOpen, setIsCreateGameModalOpen] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [newGameIsRated, setNewGameIsRated] = useState(true)
  const [createGameLocation, setCreateGameLocation] = useState('')
  const [createGameSeasonId, setCreateGameSeasonId] = useState('')
  const [seasonsByLocation, setSeasonsByLocation] = useState({})
  const [seasonsLoadingByLocation, setSeasonsLoadingByLocation] = useState({})
  const [creatingSeasonByLocation, setCreatingSeasonByLocation] = useState({})
  const [createGameMode, setCreateGameMode] = useState(CREATE_GAME_MODE_EMPTY)
  const [cloneSourceGameId, setCloneSourceGameId] = useState('')
  const [cloneSourceGames, setCloneSourceGames] = useState([])
  const [isCloneSourceGamesLoading, setIsCloneSourceGamesLoading] =
    useState(false)
  const [createGameCloneOptions, setCreateGameCloneOptions] = useState(
    DEFAULT_CREATE_GAME_CLONE_OPTIONS,
  )
  const [createGameFeedback, setCreateGameFeedback] = useState(null)
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isLocationFilterLoading, setIsLocationFilterLoading] = useState(false)
  const [locationFilterError, setLocationFilterError] = useState(null)
  const [gamesDisplayMode, setGamesDisplayMode] = useState('list')
  const [showCanceledGames, setShowCanceledGames] = useState(false)
  const [pastGamesSeasonFilter, setPastGamesSeasonFilter] = useState(
    PAST_GAMES_SEASON_FILTER_ALL,
  )
  const rawViewQuery = Array.isArray(router.query?.view)
    ? router.query.view[0]
    : router.query?.view
  const gamesView =
    rawViewQuery === 'upcoming' || rawViewQuery === 'past'
      ? rawViewQuery
      : 'all'
  const isUpcomingView = gamesView === 'upcoming'
  const isPastView = gamesView === 'past'
  const shouldShowLocationFilter = isUpcomingView || isPastView
  const isFilteredGamesView =
    rawViewQuery === 'upcoming' || rawViewQuery === 'past'
  const defaultGamesFilterLocation = useMemo(() => {
    const byUser =
      typeof location === 'string' ? location.trim().toLowerCase() : ''
    if (byUser && gameLocationOptions.some((item) => item.key === byUser)) {
      return byUser
    }
    return gameLocationOptions[0]?.key ?? ''
  }, [location])
  const [gamesFilterLocation, setGamesFilterLocation] = useState(
    defaultGamesFilterLocation,
  )
  const [isGamesFilterLocationHydrated, setIsGamesFilterLocationHydrated] =
    useState(false)
  const registerApiLocation = isFilteredGamesView
    ? gamesFilterLocation
    : location
  const createGameSeasons = useMemo(() => {
    const locationKey =
      typeof createGameLocation === 'string'
        ? createGameLocation.trim().toLowerCase()
        : ''
    if (!locationKey) {
      return []
    }
    return Array.isArray(seasonsByLocation[locationKey])
      ? seasonsByLocation[locationKey]
      : []
  }, [createGameLocation, seasonsByLocation])
  const editGameSeasons = useMemo(() => {
    const locationKey =
      typeof editingGame?.location === 'string'
        ? editingGame.location.trim().toLowerCase()
        : ''
    if (!locationKey) {
      return []
    }
    return Array.isArray(seasonsByLocation[locationKey])
      ? seasonsByLocation[locationKey]
      : []
  }, [editingGame?.location, seasonsByLocation])
  const isCreateGameSeasonsLoading = useMemo(() => {
    const locationKey =
      typeof createGameLocation === 'string'
        ? createGameLocation.trim().toLowerCase()
        : ''
    return Boolean(locationKey && seasonsLoadingByLocation[locationKey])
  }, [createGameLocation, seasonsLoadingByLocation])
  const isEditGameSeasonsLoading = useMemo(() => {
    const locationKey =
      typeof editingGame?.location === 'string'
        ? editingGame.location.trim().toLowerCase()
        : ''
    return Boolean(locationKey && seasonsLoadingByLocation[locationKey])
  }, [editingGame?.location, seasonsLoadingByLocation])

  useEffect(() => {
    setGames(safeInitialGames)
    setPersistedGames(safeInitialGames)
    setHasMoreGames(Boolean(initialHasMore))
    setSelectedGameId((prev) => {
      if (prev && safeInitialGames.some((game) => game.id === prev)) {
        return prev
      }
      return safeInitialGames[0]?.id ?? null
    })
  }, [initialHasMore, safeInitialGames])

  useEffect(() => {
    if (!defaultGamesFilterLocation) return
    setGamesFilterLocation((prev) =>
      prev && gameLocationOptions.some((item) => item.key === prev)
        ? prev
        : defaultGamesFilterLocation,
    )
  }, [defaultGamesFilterLocation])

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldShowLocationFilter) {
      setIsGamesFilterLocationHydrated(false)
      return
    }

    const savedLocationFromUnifiedKey = window.localStorage.getItem(
      GAMES_FILTER_LOCATION_STORAGE_KEY,
    )
    const legacyStorageKey = `cabinet_games_location_filter_${gamesView}`
    const savedLocationFromLegacyKey =
      window.localStorage.getItem(legacyStorageKey)
    const savedLocation =
      savedLocationFromUnifiedKey || savedLocationFromLegacyKey
    const isSavedLocationValid =
      typeof savedLocation === 'string' &&
      gameLocationOptions.some((item) => item.key === savedLocation)

    const nextLocation = isSavedLocationValid
      ? savedLocation
      : defaultGamesFilterLocation

    if (nextLocation) {
      setGamesFilterLocation((prev) =>
        prev === nextLocation ? prev : nextLocation,
      )
    }
    setIsGamesFilterLocationHydrated(true)
  }, [
    defaultGamesFilterLocation,
    gameLocationOptions,
    gamesView,
    shouldShowLocationFilter,
  ])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !shouldShowLocationFilter ||
      !gamesFilterLocation ||
      !isGamesFilterLocationHydrated
    ) {
      return
    }

    const isCurrentLocationValid = gameLocationOptions.some(
      (item) => item.key === gamesFilterLocation,
    )
    if (!isCurrentLocationValid) {
      return
    }

    window.localStorage.setItem(
      GAMES_FILTER_LOCATION_STORAGE_KEY,
      gamesFilterLocation,
    )
  }, [
    gameLocationOptions,
    gamesFilterLocation,
    isGamesFilterLocationHydrated,
    shouldShowLocationFilter,
  ])

  useEffect(() => {
    setFeedback(null)
  }, [selectedGameId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const savedModeFromUnifiedKey = window.localStorage.getItem(
      GAMES_DISPLAY_MODE_STORAGE_KEY,
    )
    const legacyStorageKey = `cabinet_games_display_mode_${gamesView}`
    const savedModeFromLegacyKey = window.localStorage.getItem(legacyStorageKey)
    const savedMode = savedModeFromUnifiedKey || savedModeFromLegacyKey

    if (savedMode === 'list' || savedMode === 'cards') {
      setGamesDisplayMode(savedMode)
    }
  }, [gamesView])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      GAMES_DISPLAY_MODE_STORAGE_KEY,
      gamesDisplayMode,
    )
  }, [gamesDisplayMode])

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  )
  const statusModalGame = useMemo(
    () => games.find((game) => game.id === statusModalGameId) ?? null,
    [games, statusModalGameId],
  )
  const statusModalActions = useMemo(() => {
    if (!statusModalGame) {
      return []
    }

    const normalizedStatus = String(statusModalGame.status || '').toLowerCase()
    const canCloseGame = isGameConducted(statusModalGame)

    if (normalizedStatus === 'active') {
      return [
        {
          id: 'check_game',
          label: 'Проверить игру',
          description:
            'Проверит игру на ошибки перед запуском и покажет, что исправить.',
          variant: 'secondary',
          tone: 'cyan',
        },
        {
          id: 'start_game',
          label: 'СТАРТ ИГРЫ',
          description:
            'Перед запуском выполнится проверка игры. При ошибках запуск будет заблокирован.',
          variant: 'primary',
          tone: 'success',
          disabled: Boolean(statusValidationResult?.hasErrors),
        },
        {
          id: 'cancel_game',
          label: 'Отменить',
          description:
            'Пометит игру отменённой. Команды не смогут продолжить участие.',
          variant: 'secondary',
          tone: 'danger',
        },
      ]
    }

    if (normalizedStatus === 'started') {
      return [
        {
          id: 'stop_game',
          label: 'СТОП ИГРЫ',
          description:
            'Завершит игру, зафиксирует результат и оповестит всех участников.',
          variant: 'primary',
          tone: 'danger',
        },
      ]
    }

    if (normalizedStatus === 'finished') {
      return [
        {
          id: 'restart_game',
          label: 'Перезапустить',
          description:
            'Вернёт игру в статус «Активна», чтобы можно было снова запустить.',
          variant: 'primary',
          tone: 'success',
        },
        {
          id: 'cancel_game',
          label: 'Отменить',
          description: 'Переведёт завершённую игру в отменённые.',
          variant: 'secondary',
          tone: 'danger',
        },
        {
          id: 'close_game',
          label: 'Закрыть',
          description:
            'Закроет игру окончательно. Редактирование после этого недоступно.',
          variant: 'secondary',
          tone: 'neutral',
          disabled: !canCloseGame,
        },
      ]
    }

    if (normalizedStatus === 'canceled') {
      return [
        {
          id: 'activate_game',
          label: 'Активировать',
          description: 'Вернёт отменённую игру в статус «Активна».',
          variant: 'primary',
          tone: 'success',
        },
      ]
    }

    if (normalizedStatus === 'closed') {
      return [
        {
          id: 'reopen_game',
          label: 'Открыть игру',
          description:
            'Откроет игру: если есть snapshots результата — вернёт в «Завершена», иначе в «Активна».',
          variant: 'primary',
          tone: 'success',
        },
      ]
    }

    return []
  }, [statusModalGame, statusValidationResult?.hasErrors])
  const selectedGameApiLocation =
    selectedGame?.location ||
    (shouldShowLocationFilter ? gamesFilterLocation : location)

  useEffect(() => {
    setExpandedTaskIds([])
    if (!isEditModalOpen) {
      setEditingGame(null)
    }
    setIsStatusModalOpen(false)
    setStatusModalGameId('')
    setStatusValidationResult(null)
    setTeamsModalState({
      isLoading: false,
      error: null,
      gameTeams: [],
      availableTeams: [],
    })
    setSelectedTeamToAdd('')
    setRemovingTeamIds([])
    setSelectedModeratorToAdd('')
    setIsResultsModalOpen(false)
  }, [isEditModalOpen, selectedGameId])

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    const rawGameId = router.query?.gameId
    const requestedGameId = Array.isArray(rawGameId) ? rawGameId[0] : rawGameId

    if (!requestedGameId || typeof requestedGameId !== 'string') {
      return
    }

    const targetGame = games.find((game) => game?.id === requestedGameId)
    if (!targetGame) {
      return
    }

    setSelectedGameId(targetGame.id)
    setIsDescriptionModalOpen(true)
    setIsEditModalOpen(false)
    setIsTeamsModalOpen(false)

    const nextQuery = { ...router.query }
    delete nextQuery.gameId

    router
      .replace(
        {
          pathname: router.pathname,
          query: nextQuery,
        },
        undefined,
        { shallow: true },
      )
      .catch(() => {})
  }, [games, router])

  const sortGamesForCurrentView = useCallback(
    (items) => {
      if (!Array.isArray(items)) {
        return []
      }

      if (gamesView === 'upcoming') {
        return [...items].sort((first, second) => {
          const firstTime = first?.dateStart
            ? new Date(first.dateStart).getTime()
            : Number.POSITIVE_INFINITY
          const secondTime = second?.dateStart
            ? new Date(second.dateStart).getTime()
            : Number.POSITIVE_INFINITY

          if (firstTime !== secondTime) {
            return firstTime - secondTime
          }

          return String(first?.id || '').localeCompare(
            String(second?.id || ''),
            'ru',
          )
        })
      }

      if (gamesView === 'past') {
        return [...items].sort((first, second) => {
          const firstTime = first?.dateStart
            ? new Date(first.dateStart).getTime()
            : Number.NEGATIVE_INFINITY
          const secondTime = second?.dateStart
            ? new Date(second.dateStart).getTime()
            : Number.NEGATIVE_INFINITY

          if (firstTime !== secondTime) {
            return secondTime - firstTime
          }

          return String(second?.id || '').localeCompare(
            String(first?.id || ''),
            'ru',
          )
        })
      }

      return [...items].sort((first, second) => {
        const firstTime = first?.updatedAt
          ? new Date(first.updatedAt).getTime()
          : 0
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
    },
    [gamesView],
  )

  const loadSeasonsForLocation = useCallback(async (locationKey) => {
    const normalizedLocation =
      typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''
    if (!normalizedLocation) {
      return []
    }

    setSeasonsLoadingByLocation((prev) => ({
      ...prev,
      [normalizedLocation]: true,
    }))
    try {
      const params = new URLSearchParams({ location: normalizedLocation })
      const { json } = await requestApiJson(
        `/api/cabinet/seasons?${params.toString()}`,
        {
          fallbackMessage: 'Не удалось загрузить сезоны',
        },
      )

      const seasons = Array.isArray(json?.data) ? json.data : []
      const normalizedSeasons = seasons
        .map((season) => ({
          id: typeof season?.id === 'string' ? season.id : '',
          name: typeof season?.name === 'string' ? season.name : '',
          location:
            typeof season?.location === 'string'
              ? season.location.trim().toLowerCase()
              : normalizedLocation,
        }))
        .filter((season) => season.id && season.name)

      setSeasonsByLocation((prev) => ({
        ...prev,
        [normalizedLocation]: normalizedSeasons,
      }))
      return normalizedSeasons
    } finally {
      setSeasonsLoadingByLocation((prev) => ({
        ...prev,
        [normalizedLocation]: false,
      }))
    }
  }, [])

  const handleCreateSeason = useCallback(
    async ({ locationKey, onCreated }) => {
      const normalizedLocation =
        typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''
      if (!normalizedLocation) {
        setFeedback({
          type: 'error',
          message: 'Сначала выберите город',
        })
        return null
      }

      const seasonNameRaw =
        typeof window !== 'undefined'
          ? window.prompt('Введите название нового сезона')
          : ''
      const seasonName =
        typeof seasonNameRaw === 'string'
          ? seasonNameRaw.trim().replace(/\s+/g, ' ')
          : ''
      if (!seasonName) {
        return null
      }

      setCreatingSeasonByLocation((prev) => ({
        ...prev,
        [normalizedLocation]: true,
      }))
      try {
        const { json } = await requestApiJson('/api/cabinet/seasons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: normalizedLocation,
            name: seasonName,
          }),
          fallbackMessage: 'Не удалось создать сезон',
        })

        const season = json?.data
        if (!season?.id || !season?.name) {
          throw new Error('Сервер вернул некорректный сезон')
        }

        const normalizedSeason = {
          id: season.id,
          name: season.name,
          location: normalizedLocation,
        }

        setSeasonsByLocation((prev) => {
          const existing = Array.isArray(prev[normalizedLocation])
            ? prev[normalizedLocation]
            : []
          const withoutDuplicate = existing.filter(
            (item) => item.id !== normalizedSeason.id,
          )
          const next = [...withoutDuplicate, normalizedSeason].sort((a, b) =>
            a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }),
          )
          return {
            ...prev,
            [normalizedLocation]: next,
          }
        })

        if (typeof onCreated === 'function') {
          onCreated(normalizedSeason)
        }

        setFeedback({
          type: 'success',
          message: `Сезон «${normalizedSeason.name}» создан`,
        })

        return normalizedSeason
      } finally {
        setCreatingSeasonByLocation((prev) => ({
          ...prev,
          [normalizedLocation]: false,
        }))
      }
    },
    [setFeedback],
  )

  useEffect(() => {
    const normalizedLocation =
      typeof createGameLocation === 'string'
        ? createGameLocation.trim().toLowerCase()
        : ''
    if (!normalizedLocation) {
      return
    }

    if (
      !seasonsByLocation[normalizedLocation] &&
      !seasonsLoadingByLocation[normalizedLocation]
    ) {
      loadSeasonsForLocation(normalizedLocation).catch((error) => {
        console.error('Failed to load seasons for create game location', error)
      })
    }
  }, [
    createGameLocation,
    loadSeasonsForLocation,
    seasonsByLocation,
    seasonsLoadingByLocation,
  ])

  useEffect(() => {
    const normalizedLocation =
      typeof editingGame?.location === 'string'
        ? editingGame.location.trim().toLowerCase()
        : ''
    if (!normalizedLocation || !isEditModalOpen) {
      return
    }

    if (
      !seasonsByLocation[normalizedLocation] &&
      !seasonsLoadingByLocation[normalizedLocation]
    ) {
      loadSeasonsForLocation(normalizedLocation).catch((error) => {
        console.error('Failed to load seasons for edit game location', error)
      })
    }
  }, [
    editingGame?.location,
    isEditModalOpen,
    loadSeasonsForLocation,
    seasonsByLocation,
    seasonsLoadingByLocation,
  ])

  const fetchGamesPage = useCallback(
    async ({ offset, replace, locationValue }) => {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(GAMES_PAGE_SIZE),
        view: gamesView,
      })
      if (userRole) {
        params.set('rolePreview', userRole)
      }
      if (locationValue) {
        params.set('location', locationValue)
      }

      const { json } = await requestApiJson(
        `/api/cabinet/games-list?${params.toString()}`,
        {
          fallbackMessage: 'Не удалось загрузить список игр',
        },
      )

      const nextGames = Array.isArray(json?.data) ? json.data : []
      const nextHasMore = Boolean(json?.meta?.hasMore)
      const sorted = sortGamesForCurrentView(nextGames)

      if (replace) {
        setGames(sorted)
        setPersistedGames(sorted)
        setSelectedGameId((prev) =>
          prev && sorted.some((game) => game.id === prev)
            ? prev
            : (sorted[0]?.id ?? null),
        )
      } else if (sorted.length > 0) {
        setGames((prev) => sortGamesForCurrentView([...prev, ...sorted]))
        setPersistedGames((prev) =>
          sortGamesForCurrentView([...prev, ...sorted]),
        )
      }

      setHasMoreGames(nextHasMore)
    },
    [gamesView, sortGamesForCurrentView, userRole],
  )

  useEffect(() => {
    if (!shouldShowLocationFilter) {
      setLocationFilterError(null)
      setIsLocationFilterLoading(false)
      return
    }

    if (!isGamesFilterLocationHydrated) {
      setIsLocationFilterLoading(false)
      return
    }

    if (!gamesFilterLocation) {
      setGames([])
      setPersistedGames([])
      setSelectedGameId(null)
      setHasMoreGames(false)
      setLocationFilterError('Выберите город для загрузки игр.')
      return
    }

    let cancelled = false

    const loadFirstPage = async () => {
      setIsLocationFilterLoading(true)
      setLocationFilterError(null)

      try {
        await fetchGamesPage({
          offset: 0,
          replace: true,
          locationValue: gamesFilterLocation,
        })
      } catch (error) {
        if (cancelled) {
          return
        }
        setGames([])
        setPersistedGames([])
        setSelectedGameId(null)
        setHasMoreGames(false)
        setLocationFilterError(
          extractErrorMessage(error) ||
            'Не удалось загрузить игры выбранного города.',
        )
      } finally {
        if (!cancelled) {
          setIsLocationFilterLoading(false)
        }
      }
    }

    loadFirstPage()

    return () => {
      cancelled = true
    }
  }, [
    fetchGamesPage,
    gamesFilterLocation,
    isGamesFilterLocationHydrated,
    shouldShowLocationFilter,
  ])

  const handleLoadMoreGames = useCallback(async () => {
    if (isLoadingMoreGames || !hasMoreGames) {
      return
    }

    setIsLoadingMoreGames(true)
    setFeedback(null)

    try {
      await fetchGamesPage({
        offset: games.length,
        replace: false,
        locationValue: shouldShowLocationFilter
          ? gamesFilterLocation
          : location,
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          extractErrorMessage(error) ||
          'Не удалось загрузить дополнительные игры',
      })
    } finally {
      setIsLoadingMoreGames(false)
    }
  }, [
    fetchGamesPage,
    games.length,
    gamesFilterLocation,
    hasMoreGames,
    isLoadingMoreGames,
    location,
    shouldShowLocationFilter,
  ])

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
    if (!registerApiLocation || !currentUserDbId) {
      setRegisterTeams([])
      setRegisterTeamId('')
      return
    }

    setIsRegisterTeamsLoading(true)

    try {
      const membershipsParams = new URLSearchParams({
        collection: 'teamsusers',
        userId: currentUserDbId,
        role: 'capitan',
        limit: '200',
      })

      const { response: membershipsResponse, json: membershipsJson } =
        await requestApiJson(
          `/api/${registerApiLocation}/custom?${membershipsParams.toString()}`,
          {
            fallbackMessage: 'Не удалось загрузить список команд',
            throwOnHttpError: false,
          },
        )

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
            'Не удалось загрузить список команд',
        )
      }

      const memberships = Array.isArray(membershipsJson?.data)
        ? membershipsJson.data
        : []

      const teamIds = Array.from(
        new Set(
          memberships
            .map((membership) => toStringId(membership?.teamId))
            .filter(
              (teamId) => typeof teamId === 'string' && teamId.length > 0,
            ),
        ),
      )

      if (teamIds.length === 0) {
        setRegisterTeams([])
        setRegisterTeamId('')
        return
      }

      const teamsParams = new URLSearchParams({
        location: registerApiLocation,
        teamIds: teamIds.join(','),
      })

      const { response: teamsResponse, json: teamsJson } = await requestApiJson(
        `/api/cabinet/teams?${teamsParams.toString()}`,
        {
          fallbackMessage: 'Не удалось загрузить данные команд',
          throwOnHttpError: false,
        },
      )

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
            'Не удалось загрузить данные команд',
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
  }, [currentUserDbId, registerApiLocation])

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

    if (!registerApiLocation) {
      setRegisterFeedback({
        type: 'error',
        message: 'Не удалось определить площадку выбранного города',
      })
      return
    }

    if (!currentUserDbId) {
      setRegisterFeedback({
        type: 'error',
        message: 'Не удалось определить пользователя. Перезайдите в кабинет.',
      })
      return
    }

    const selectedTeam = registerTeams.find(
      (team) => team.id === registerTeamId,
    )

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
      const { json: gameJson } = await requestApiJson(
        `/api/${registerApiLocation}/custom?collection=games&id=${encodeURIComponent(
          trimmedGameId,
        )}`,
        {
          fallbackMessage: 'Игра не найдена',
        },
      )

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

      const { response: existingResponse, json: existingJson } =
        await requestApiJson(
          `/api/${registerApiLocation}/custom?${existingParams.toString()}`,
          {
            fallbackMessage: 'Не удалось проверить регистрацию команды',
            throwOnHttpError: false,
          },
        )

      if (
        existingResponse.ok &&
        Array.isArray(existingJson?.data) &&
        existingJson.data.length > 0
      ) {
        throw new Error('Команда уже зарегистрирована на эту игру')
      }

      await requestApiJson(
        `/api/${registerApiLocation}/custom?collection=gamesteams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              teamId: registerTeamId,
              gameId: trimmedGameId,
            },
          }),
          fallbackMessage: 'Не удалось зарегистрироваться на игру',
        },
      )

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
        }),
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
        }),
      )
    } catch (error) {
      console.error('Failed to register team to game', error)
      setRegisterFeedback({
        type: 'error',
        message:
          extractErrorMessage(error) || 'Не удалось зарегистрироваться на игру',
      })
    } finally {
      setIsRegisterSubmitting(false)
    }
  }, [
    currentUserDbId,
    registerApiLocation,
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
    const defaultLocation = location || gameLocationOptions[0]?.key || ''
    setCreateGameFeedback(null)
    setNewGameName('')
    setNewGameIsRated(true)
    setCreateGameLocation(defaultLocation)
    setCreateGameSeasonId('')
    setCreateGameMode(CREATE_GAME_MODE_EMPTY)
    setCloneSourceGameId('')
    setCreateGameCloneOptions(DEFAULT_CREATE_GAME_CLONE_OPTIONS)
    setIsCreateGameModalOpen(true)
  }, [location])

  const handleCloseCreateGameModal = useCallback(() => {
    if (isCreatingGame) {
      return
    }

    setIsCreateGameModalOpen(false)
    setNewGameName('')
    setNewGameIsRated(true)
    setCreateGameLocation(location || gameLocationOptions[0]?.key || '')
    setCreateGameSeasonId('')
    setCreateGameMode(CREATE_GAME_MODE_EMPTY)
    setCloneSourceGameId('')
    setCloneSourceGames([])
    setIsCloneSourceGamesLoading(false)
    setCreateGameCloneOptions(DEFAULT_CREATE_GAME_CLONE_OPTIONS)
    setCreateGameFeedback(null)
  }, [isCreatingGame, location])

  const handleChangeCreateGameCloneOption = useCallback(
    (optionKey, checked) => {
      if (!(optionKey in DEFAULT_CREATE_GAME_CLONE_OPTIONS)) {
        return
      }

      setCreateGameCloneOptions((prev) => ({
        ...prev,
        [optionKey]: Boolean(checked),
      }))
    },
    [],
  )

  const handleCreateGameLocationChange = useCallback((nextLocation) => {
    setCreateGameLocation(nextLocation)
    setCreateGameSeasonId('')
  }, [])

  const handleCreateSeasonForCreateGame = useCallback(async () => {
    const normalizedLocation =
      typeof createGameLocation === 'string'
        ? createGameLocation.trim().toLowerCase()
        : ''
    if (!normalizedLocation) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Сначала выберите город для игры',
      })
      return
    }

    try {
      const season = await handleCreateSeason({
        locationKey: normalizedLocation,
        onCreated: (createdSeason) => {
          setCreateGameSeasonId(createdSeason.id)
        },
      })
      if (season?.id) {
        setCreateGameFeedback(null)
      }
    } catch (error) {
      setCreateGameFeedback({
        type: 'error',
        message: extractErrorMessage(error) || 'Не удалось создать сезон',
      })
    }
  }, [createGameLocation, handleCreateSeason])

  const createGameCloneSourceOptions = useMemo(() => {
    const byId = new Map()

    cloneSourceGames.forEach((game) => {
      if (!game?.id || byId.has(game.id)) {
        return
      }

      const regionRaw =
        game.location && LOCATIONS[game.location]?.townRu
          ? LOCATIONS[game.location].townRu
          : game.location || 'Неизвестный регион'
      const regionLabel =
        typeof regionRaw === 'string' && regionRaw.length > 0
          ? `${regionRaw.charAt(0).toUpperCase()}${regionRaw.slice(1)}`
          : 'Неизвестный регион'
      const gameDateRaw =
        game.dateStart || game.createdAt || game.updatedAt || null
      const gameDate = gameDateRaw ? new Date(gameDateRaw) : null
      const dateLabel =
        gameDate && !Number.isNaN(gameDate.getTime())
          ? gameDate.toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : '--.--.----'
      const gameName = game.name || 'Без названия'

      byId.set(game.id, {
        id: game.id,
        name: game.name || 'Без названия',
        sortDate:
          gameDate && !Number.isNaN(gameDate.getTime())
            ? gameDate.getTime()
            : 0,
        label: `${dateLabel} "${gameName}" - ${regionLabel}`,
        location: game.location || '',
      })
    })

    return Array.from(byId.values())
      .sort((a, b) => {
        if (b.sortDate !== a.sortDate) {
          return b.sortDate - a.sortDate
        }

        return a.label.localeCompare(b.label, 'ru')
      })
      .map(({ sortDate, ...rest }) => rest)
  }, [cloneSourceGames])

  useEffect(() => {
    if (!isCreateGameModalOpen || !canEditAllGames) {
      return
    }

    let cancelled = false

    const loadCloneSourceGames = async () => {
      setIsCloneSourceGamesLoading(true)

      try {
        const PAGE_LIMIT = 100
        const MAX_ITEMS = 2000
        let offset = 0
        let hasMore = true
        const collected = []

        while (hasMore && collected.length < MAX_ITEMS) {
          const params = new URLSearchParams({
            offset: String(offset),
            limit: String(PAGE_LIMIT),
            view: 'all',
            location: 'all',
          })
          if (userRole) {
            params.set('rolePreview', userRole)
          }

          const { json } = await requestApiJson(
            `/api/cabinet/games-list?${params.toString()}`,
            {
              fallbackMessage:
                'Не удалось загрузить список игр для клонирования',
            },
          )

          const pageItems = Array.isArray(json?.data) ? json.data : []
          collected.push(...pageItems)

          hasMore = Boolean(json?.meta?.hasMore) && pageItems.length > 0
          offset += pageItems.length
        }

        if (cancelled) {
          return
        }

        setCloneSourceGames(collected)
      } catch (error) {
        if (cancelled) {
          return
        }

        setCloneSourceGames([])
        setCreateGameFeedback({
          type: 'error',
          message:
            extractErrorMessage(error) ||
            'Не удалось загрузить список игр для клонирования',
        })
      } finally {
        if (!cancelled) {
          setIsCloneSourceGamesLoading(false)
        }
      }
    }

    loadCloneSourceGames()

    return () => {
      cancelled = true
    }
  }, [canEditAllGames, isCreateGameModalOpen, userRole])

  useEffect(() => {
    if (createGameMode !== CREATE_GAME_MODE_CLONE) {
      return
    }

    if (!cloneSourceGameId) {
      return
    }

    const sourceGame = createGameCloneSourceOptions.find(
      (game) => game.id === cloneSourceGameId,
    )

    if (!sourceGame) {
      return
    }

    setNewGameName(sourceGame.name || '')
  }, [cloneSourceGameId, createGameCloneSourceOptions, createGameMode])

  const isCreateGameActionDisabled = useMemo(() => {
    if (isCreatingGame) {
      return true
    }

    if (createGameMode === CREATE_GAME_MODE_CLONE) {
      if (!cloneSourceGameId) {
        return true
      }

      const hasAnyCloneOption = Object.values(createGameCloneOptions).some(
        Boolean,
      )
      if (!hasAnyCloneOption) {
        return true
      }

      return newGameName.trim().length === 0
    }

    return newGameName.trim().length === 0
  }, [
    cloneSourceGameId,
    createGameCloneOptions,
    createGameMode,
    isCreatingGame,
    newGameName,
  ])

  const handleCreateGame = useCallback(async () => {
    const trimmedName = newGameName.trim()
    const isCloneMode = createGameMode === CREATE_GAME_MODE_CLONE

    if (!trimmedName) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Введите название игры',
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

    if (isCloneMode && !cloneSourceGameId) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Выберите игру-источник для клонирования',
      })
      return
    }

    if (isCloneMode && !Object.values(createGameCloneOptions).some(Boolean)) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Выберите хотя бы один блок для клонирования',
      })
      return
    }

    const normalizedCreateLocation =
      typeof createGameLocation === 'string'
        ? createGameLocation.trim().toLowerCase()
        : ''
    if (!normalizedCreateLocation) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Выберите город для новой игры',
      })
      return
    }

    if (Boolean(newGameIsRated) && !createGameSeasonId) {
      setCreateGameFeedback({
        type: 'error',
        message: 'Для рейтинговой игры выберите сезон или создайте новый',
      })
      return
    }

    setIsCreatingGame(true)
    setCreateGameFeedback(null)

    try {
      const baseDraft = {
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
        isRated: Boolean(newGameIsRated),
        seasonId: '',
        seasonName: '',
        hidden: true,
        showCreator: true,
        showTasks: false,
        hideResult: false,
        prices: [],
        finances: [],
        tasks: [],
        moderators: [],
      }

      if (isCloneMode) {
        const cloneSourceMeta = createGameCloneSourceOptions.find(
          (game) => game.id === cloneSourceGameId,
        )
        const cloneSourceApiLocation =
          cloneSourceMeta?.location || normalizedCreateLocation

        const { json: sourceJson } = await requestApiJson(
          `/api/${cloneSourceApiLocation}/custom?collection=games&id=${encodeURIComponent(
            cloneSourceGameId,
          )}`,
          {
            fallbackMessage: 'Не удалось загрузить игру-источник',
          },
        )

        const normalizedSource = normalizeGameForCabinet(sourceJson?.data)
        if (!normalizedSource) {
          throw new Error('Не удалось подготовить данные игры-источника')
        }

        if (createGameCloneOptions.basic) {
          baseDraft.description = normalizedSource.description || ''
          baseDraft.image = normalizedSource.image || null
        }

        baseDraft.name = trimmedName

        if (createGameCloneOptions.rules) {
          baseDraft.type = normalizedSource.type || 'classic'
          baseDraft.taskDuration = Number(normalizedSource.taskDuration) || 0
          baseDraft.cluesDuration = Number(normalizedSource.cluesDuration) || 0
          baseDraft.clueEarlyAccessMode =
            normalizedSource.clueEarlyAccessMode || 'time'
          baseDraft.clueEarlyPenalty =
            Number(normalizedSource.clueEarlyPenalty) || 0
          baseDraft.breakDuration = Number(normalizedSource.breakDuration) || 0
          baseDraft.taskFailurePenalty =
            Number(normalizedSource.taskFailurePenalty) || 0
          baseDraft.manyCodesPenalty = Array.isArray(
            normalizedSource.manyCodesPenalty,
          )
            ? [...normalizedSource.manyCodesPenalty]
            : [0, 0]
          baseDraft.individualStart = Boolean(normalizedSource.individualStart)
        }

        if (createGameCloneOptions.captainRules) {
          baseDraft.allowCaptainForceClue = Boolean(
            normalizedSource.allowCaptainForceClue,
          )
          baseDraft.allowCaptainFailTask = Boolean(
            normalizedSource.allowCaptainFailTask,
          )
          baseDraft.allowCaptainFinishBreak = Boolean(
            normalizedSource.allowCaptainFinishBreak,
          )
        }

        if (createGameCloneOptions.tasks) {
          baseDraft.tasks = Array.isArray(normalizedSource.tasks)
            ? JSON.parse(JSON.stringify(normalizedSource.tasks))
            : []
        }

        if (createGameCloneOptions.locations) {
          baseDraft.startingPlace = normalizedSource.startingPlace || ''
          baseDraft.finishingPlace = normalizedSource.finishingPlace || ''
        }

        if (createGameCloneOptions.moderators) {
          baseDraft.moderators = Array.isArray(normalizedSource.moderators)
            ? normalizedSource.moderators
                .map((moderator) =>
                  typeof moderator === 'string'
                    ? moderator
                    : moderator?.id || null,
                )
                .filter(Boolean)
            : []
        }

        if (createGameCloneOptions.publication) {
          baseDraft.hidden = Boolean(normalizedSource.hidden)
          baseDraft.showCreator = Boolean(normalizedSource.showCreator)
          baseDraft.showTasks = Boolean(normalizedSource.showTasks)
          baseDraft.hideResult = Boolean(normalizedSource.hideResult)
        }

        if (createGameCloneOptions.prices) {
          baseDraft.prices = Array.isArray(normalizedSource.prices)
            ? JSON.parse(JSON.stringify(normalizedSource.prices))
            : []
        }
      }

      const selectedSeason =
        createGameSeasons.find((season) => season.id === createGameSeasonId) ||
        null
      baseDraft.seasonId = Boolean(baseDraft.isRated)
        ? selectedSeason?.id || ''
        : ''
      baseDraft.seasonName = Boolean(baseDraft.isRated)
        ? selectedSeason?.name || ''
        : ''

      if (Boolean(baseDraft.isRated) && !baseDraft.seasonId) {
        setCreateGameFeedback({
          type: 'error',
          message: 'Для рейтинговой игры выберите сезон или создайте новый',
        })
        return
      }

      const payload = {
        ...buildUpdatePayload({
          ...baseDraft,
          name: trimmedName,
        }),
        location: normalizedCreateLocation,
        creatorTelegramId: currentUserTelegramIdNumber,
      }

      const { json } = await requestApiJson(
        `/api/${normalizedCreateLocation}/custom?collection=games`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payload }),
          fallbackMessage: 'Не удалось создать игру',
        },
      )

      const createdGame = normalizeGameForCabinet({
        ...json.data,
        teamsCount: 0,
      })

      if (!createdGame) {
        throw new Error('Не удалось обработать данные созданной игры')
      }

      setGames((prev) =>
        sortGamesForCurrentView([
          createdGame,
          ...prev.filter((game) => game.id !== createdGame.id),
        ]),
      )
      setPersistedGames((prev) =>
        sortGamesForCurrentView([
          createdGame,
          ...prev.filter((game) => game.id !== createdGame.id),
        ]),
      )
      setSelectedGameId(createdGame.id)

      setFeedback({
        type: 'success',
        message: `Игра «${createdGame.name || 'Без названия'}» создана`,
      })

      setIsCreateGameModalOpen(false)
      setCreateGameMode(CREATE_GAME_MODE_EMPTY)
      setCloneSourceGameId('')
      setCreateGameCloneOptions(DEFAULT_CREATE_GAME_CLONE_OPTIONS)
      setEditingGame(cloneGameDraft(createdGame))
      setIsEditModalOpen(true)
    } catch (error) {
      console.error('Failed to create game', error)
      setCreateGameFeedback({
        type: 'error',
        message: extractErrorMessage(error) || 'Не удалось создать игру',
      })
    } finally {
      setIsCreatingGame(false)
    }
  }, [
    buildUpdatePayload,
    canEditAllGames,
    cloneSourceGameId,
    createGameCloneOptions,
    createGameCloneSourceOptions,
    createGameLocation,
    createGameSeasonId,
    createGameSeasons,
    createGameMode,
    currentUserTelegramIdNumber,
    location,
    newGameName,
    newGameIsRated,
    setFeedback,
    setGames,
    setPersistedGames,
    setSelectedGameId,
    sortGamesForCurrentView,
  ])

  const availableModerators = useMemo(
    () =>
      Array.isArray(initialAvailableModerators)
        ? initialAvailableModerators
        : [],
    [initialAvailableModerators],
  )

  const availableModeratorsMap = useMemo(
    () =>
      new Map(
        availableModerators.map((moderator) => [moderator.id, moderator]),
      ),
    [availableModerators],
  )

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
      }),
    [],
  )

  const upcomingGames = useMemo(
    () =>
      games.filter((game) => {
        const status = (game?.status ?? '').toString().toLowerCase()
        return (
          status !== 'finished' && status !== 'closed' && status !== 'canceled'
        )
      }),
    [games],
  )

  const pastGamesBase = useMemo(
    () =>
      games.filter((game) => {
        const status = (game?.status ?? '').toString().toLowerCase()
        const startDate =
          game?.dateStart !== null && game?.dateStart !== undefined
            ? new Date(game.dateStart)
            : null
        const hasPastStartDate =
          startDate instanceof Date &&
          !Number.isNaN(startDate.getTime()) &&
          startDate.getTime() < Date.now()

        if (status === 'finished' || status === 'closed') {
          return true
        }
        if ((status === 'active' || status === 'started') && hasPastStartDate) {
          return true
        }
        if (status === 'canceled') {
          return showCanceledGames
        }
        return false
      }),
    [games, showCanceledGames],
  )

  const pastGames = useMemo(
    () =>
      pastGamesBase.filter((game) => {
        if (pastGamesSeasonFilter === PAST_GAMES_SEASON_FILTER_ALL) {
          return true
        }

        if (pastGamesSeasonFilter === PAST_GAMES_SEASON_FILTER_NONRATED) {
          return !Boolean(game?.isRated)
        }

        if (pastGamesSeasonFilter === PAST_GAMES_SEASON_FILTER_OFFSEASON) {
          return (
            Boolean(game?.isRated) &&
            !(typeof game?.seasonId === 'string' && game.seasonId.trim())
          )
        }

        if (pastGamesSeasonFilter.startsWith('season:')) {
          const seasonId = pastGamesSeasonFilter.slice('season:'.length)
          return (
            Boolean(game?.isRated) &&
            typeof game?.seasonId === 'string' &&
            game.seasonId === seasonId
          )
        }

        return true
      }),
    [pastGamesBase, pastGamesSeasonFilter],
  )

  const pastGamesSeasonOptions = useMemo(() => {
    const seasonsMap = new Map()

    pastGamesBase.forEach((game) => {
      if (!Boolean(game?.isRated)) {
        return
      }

      const seasonId =
        typeof game?.seasonId === 'string' ? game.seasonId.trim() : ''
      const seasonName =
        typeof game?.seasonName === 'string' ? game.seasonName.trim() : ''
      if (!seasonId || !seasonName || seasonsMap.has(seasonId)) {
        return
      }
      seasonsMap.set(seasonId, seasonName)
    })

    const seasons = Array.from(seasonsMap.entries())
      .map(([id, name]) => ({ value: `season:${id}`, label: name }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, 'ru', { sensitivity: 'base' }),
      )

    return [
      { value: PAST_GAMES_SEASON_FILTER_ALL, label: 'Все' },
      ...seasons,
      { value: PAST_GAMES_SEASON_FILTER_OFFSEASON, label: 'Вне сезона' },
      { value: PAST_GAMES_SEASON_FILTER_NONRATED, label: 'Не рейтинговые' },
    ]
  }, [pastGamesBase])

  useEffect(() => {
    if (
      pastGamesSeasonOptions.some(
        (option) => option.value === pastGamesSeasonFilter,
      )
    ) {
      return
    }
    setPastGamesSeasonFilter(PAST_GAMES_SEASON_FILTER_ALL)
  }, [pastGamesSeasonFilter, pastGamesSeasonOptions])
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
        (selectedGame.tasks ?? []).some((task) => task.id === taskId),
      ),
    )
  }, [selectedGame])

  const persistedSelectedGame = useMemo(
    () => persistedGames.find((game) => game.id === selectedGameId) ?? null,
    [persistedGames, selectedGameId],
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
    if (!editingGame || !persistedSelectedGame) {
      return false
    }

    return (
      serializeGameForComparison(editingGame) !==
      serializeGameForComparison(persistedSelectedGame)
    )
  }, [editingGame, persistedSelectedGame])

  const canEditSelectedGame = useMemo(() => {
    const gameForPermissions =
      isEditModalOpen && editingGame ? editingGame : selectedGame

    if (!gameForPermissions) {
      return false
    }

    if (isClosedStatus(gameForPermissions.status)) {
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

      const creatorId = String(gameForPermissions.creatorTelegramId || '')
      if (!creatorId) {
        return false
      }

      return creatorId === currentUserIdString
    }

    return false
  }, [
    canEditAllGames,
    canEditOwnGames,
    currentUserDbId,
    currentUserIdString,
    editingGame,
    isEditModalOpen,
    isGameModerator,
    selectedGame,
  ])

  const canViewRestrictedGameInfo = canEditSelectedGame

  const canManageTeams = canViewRestrictedGameInfo

  const canManageGameStatus = useCallback(
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

      const moderators = Array.isArray(game?.moderators) ? game.moderators : []

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
    [canEditAllGames, canEditOwnGames, currentUserDbId, currentUserIdString],
  )

  const canManageGame = useCallback(
    (game) => {
      if (!game || isClosedStatus(game.status)) {
        return false
      }

      return canManageGameStatus(game)
    },
    [canManageGameStatus],
  )

  const updateSelectedGame = useCallback(
    (updater) => {
      if (!canEditSelectedGame || !editingGame) return

      setEditingGame((prevGame) => {
        if (!prevGame) {
          return prevGame
        }

        const patch =
          typeof updater === 'function' ? updater(prevGame) : updater
        const nextGame = { ...prevGame, ...patch }
        if (Boolean(nextGame.isRated ?? true)) {
          nextGame.hidden = false
        } else {
          nextGame.seasonId = ''
          nextGame.seasonName = ''
        }
        return nextGame
      })
    },
    [canEditSelectedGame, editingGame],
  )

  const handleCreateSeasonForEditGame = useCallback(async () => {
    const gameForEdit = editingGame ?? selectedGame
    const normalizedLocation =
      typeof gameForEdit?.location === 'string'
        ? gameForEdit.location.trim().toLowerCase()
        : ''
    if (!normalizedLocation) {
      setFeedback({
        type: 'error',
        message: 'Не удалось определить город игры',
      })
      return
    }

    try {
      await handleCreateSeason({
        locationKey: normalizedLocation,
        onCreated: (season) => {
          updateSelectedGame({
            seasonId: season.id,
            seasonName: season.name,
          })
        },
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error) || 'Не удалось создать сезон',
      })
    }
  }, [
    editingGame,
    handleCreateSeason,
    selectedGame,
    setFeedback,
    updateSelectedGame,
  ])

  const handleResetChanges = useCallback(() => {
    if (!persistedSelectedGame) return

    setEditingGame(cloneGameDraft(persistedSelectedGame))
    setFeedback(null)
  }, [persistedSelectedGame])

  const handleSaveChanges = useCallback(async () => {
    const gameToSave = editingGame ?? selectedGame
    const gameApiLocation =
      gameToSave?.location ||
      (shouldShowLocationFilter ? gamesFilterLocation : location)

    if (!gameToSave || !gameApiLocation || !canEditSelectedGame) return

    if (Boolean(gameToSave.isRated ?? true) && !gameToSave.seasonId) {
      setFeedback({
        type: 'error',
        message: 'Для рейтинговой игры выберите сезон или создайте новый',
      })
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const { json } = await requestApiJson(
        `/api/${gameApiLocation}/games/${gameToSave.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: buildUpdatePayload(gameToSave) }),
          fallbackMessage: 'Не удалось сохранить игру',
        },
      )

      const normalizedGame = normalizeGameForCabinet({
        ...json.data,
        teamsCount: gameToSave.teamsCount,
      })

      setGames((prevGames) =>
        prevGames.map((game) =>
          game.id === normalizedGame.id ? normalizedGame : game,
        ),
      )
      setPersistedGames((prevGames) =>
        prevGames.map((game) =>
          game.id === normalizedGame.id ? normalizedGame : game,
        ),
      )
      setFeedback({ type: 'success', message: 'Изменения сохранены' })
      setEditingGame(null)
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
  }, [
    canEditSelectedGame,
    editingGame,
    gamesFilterLocation,
    location,
    selectedGame,
    shouldShowLocationFilter,
  ])

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
                [field]:
                  field === 'price' ? Math.max(0, Number(value) || 0) : value,
              }
            : price,
        ),
      }))
    },
    [canEditSelectedGame, updateSelectedGame],
  )

  const handleRemovePrice = useCallback(
    (priceId) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        prices: (game.prices ?? []).filter((price) => price.id !== priceId),
      }))
    },
    [canEditSelectedGame, updateSelectedGame],
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
            return {
              ...entry,
              date: value ? new Date(value).toISOString() : null,
            }
          }

          if (field === 'type') {
            return {
              ...entry,
              type: value === 'expense' ? 'expense' : 'income',
            }
          }

          return { ...entry, [field]: value }
        }),
      }))
    },
    [canEditSelectedGame, updateSelectedGame],
  )

  const handleRemoveFinance = useCallback(
    (financeId) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        finances: (game.finances ?? []).filter(
          (entry) => entry.id !== financeId,
        ),
      }))
    },
    [canEditSelectedGame, updateSelectedGame],
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
    [canEditSelectedGame, updateSelectedGame],
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
    [canEditSelectedGame, updateSelectedGame],
  )

  const handleTaskFieldChange = useCallback(
    (taskId, field, value) => {
      updateTask(taskId, { [field]: value })
    },
    [updateTask],
  )

  const handleTaskNumberChange = useCallback(
    (taskId, field, value) => {
      const numeric = Number(value)
      updateTask(taskId, { [field]: Number.isFinite(numeric) ? numeric : 0 })
    },
    [updateTask],
  )

  const handleTaskOptionalNumberChange = useCallback(
    (taskId, field, value) => {
      updateTask(taskId, { [field]: toNullableNumber(value) })
    },
    [updateTask],
  )

  const handleTaskCheckboxChange = useCallback(
    (taskId, field, checked) => {
      updateTask(taskId, { [field]: Boolean(checked) })
    },
    [updateTask],
  )

  const handleTaskCoordinateChange = useCallback(
    (taskId, field, value) => {
      const numericValue = toNullableNumber(value)
      updateTask(taskId, (task) => ({
        coordinates: {
          ...(task.coordinates ?? {
            latitude: null,
            longitude: null,
            radius: null,
          }),
          [field]: numericValue,
        },
      }))
    },
    [updateTask],
  )

  const handleAddTaskCode = useCallback(
    (taskId) => {
      updateTask(taskId, (task) => ({ codes: [...(task.codes ?? []), ''] }))
    },
    [updateTask],
  )

  const handleTaskCodeChange = useCallback(
    (taskId, index, value) => {
      updateTask(taskId, (task) => {
        const nextCodes = [...(task.codes ?? [])]
        nextCodes[index] = value
        return { codes: nextCodes }
      })
    },
    [updateTask],
  )

  const handleRemoveTaskCode = useCallback(
    (taskId, index) => {
      updateTask(taskId, (task) => ({
        codes: (task.codes ?? []).filter((_, codeIndex) => codeIndex !== index),
      }))
    },
    [updateTask],
  )

  const handleAddTaskImage = useCallback(
    (taskId) => {
      updateTask(taskId, (task) => ({ images: [...(task.images ?? []), ''] }))
    },
    [updateTask],
  )

  const handleTaskImageChange = useCallback(
    (taskId, index, value) => {
      updateTask(taskId, (task) => {
        const nextImages = [...(task.images ?? [])]
        nextImages[index] = value
        return { images: nextImages }
      })
    },
    [updateTask],
  )

  const handleRemoveTaskImage = useCallback(
    (taskId, index) => {
      updateTask(taskId, (task) => ({
        images: (task.images ?? []).filter(
          (_, imageIndex) => imageIndex !== index,
        ),
      }))
    },
    [updateTask],
  )

  const handleAddClue = useCallback(
    (taskId) => {
      const newClue = createClue()
      updateTask(taskId, (task) => ({
        clues: [...(task.clues ?? []), newClue],
      }))
    },
    [updateTask],
  )

  const handleTaskClueChange = useCallback(
    (taskId, clueId, field, value) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).map((clue) =>
          clue.id === clueId ? { ...clue, [field]: value } : clue,
        ),
      }))
    },
    [updateTask],
  )

  const handleRemoveClue = useCallback(
    (taskId, clueId) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).filter((clue) => clue.id !== clueId),
      }))
    },
    [updateTask],
  )

  const handleAddClueImage = useCallback(
    (taskId, clueId) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).map((clue) =>
          clue.id === clueId
            ? { ...clue, images: [...(clue.images ?? []), ''] }
            : clue,
        ),
      }))
    },
    [updateTask],
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
    [updateTask],
  )

  const handleRemoveClueImage = useCallback(
    (taskId, clueId, index) => {
      updateTask(taskId, (task) => ({
        clues: (task.clues ?? []).map((clue) =>
          clue.id === clueId
            ? {
                ...clue,
                images: (clue.images ?? []).filter(
                  (_, imageIndex) => imageIndex !== index,
                ),
              }
            : clue,
        ),
      }))
    },
    [updateTask],
  )

  const handleAddSubTask = useCallback(
    (taskId) => {
      const newSubTask = createSubTask()
      updateTask(taskId, (task) => ({
        subTasks: [...(task.subTasks ?? []), newSubTask],
      }))
    },
    [updateTask],
  )

  const handleSubTaskChange = useCallback(
    (taskId, subTaskId, field, value) => {
      updateTask(taskId, (task) => ({
        subTasks: (task.subTasks ?? []).map((subTask) =>
          subTask.id === subTaskId ? { ...subTask, [field]: value } : subTask,
        ),
      }))
    },
    [updateTask],
  )

  const handleRemoveSubTask = useCallback(
    (taskId, subTaskId) => {
      updateTask(taskId, (task) => ({
        subTasks: (task.subTasks ?? []).filter(
          (subTask) => subTask.id !== subTaskId,
        ),
      }))
    },
    [updateTask],
  )

  const handleAddPenaltyCode = useCallback(
    (taskId) => {
      const newPenalty = createPenaltyCode()
      updateTask(taskId, (task) => ({
        penaltyCodes: [...(task.penaltyCodes ?? []), newPenalty],
      }))
    },
    [updateTask],
  )

  const handlePenaltyCodeChange = useCallback(
    (taskId, penaltyId, field, value) => {
      updateTask(taskId, (task) => ({
        penaltyCodes: (task.penaltyCodes ?? []).map((penalty) =>
          penalty.id === penaltyId ? { ...penalty, [field]: value } : penalty,
        ),
      }))
    },
    [updateTask],
  )

  const handleRemovePenaltyCode = useCallback(
    (taskId, penaltyId) => {
      updateTask(taskId, (task) => ({
        penaltyCodes: (task.penaltyCodes ?? []).filter(
          (penalty) => penalty.id !== penaltyId,
        ),
      }))
    },
    [updateTask],
  )

  const handleAddBonusCode = useCallback(
    (taskId) => {
      const newBonus = createBonusCode()
      updateTask(taskId, (task) => ({
        bonusCodes: [...(task.bonusCodes ?? []), newBonus],
      }))
    },
    [updateTask],
  )

  const handleBonusCodeChange = useCallback(
    (taskId, bonusId, field, value) => {
      updateTask(taskId, (task) => ({
        bonusCodes: (task.bonusCodes ?? []).map((bonus) =>
          bonus.id === bonusId ? { ...bonus, [field]: value } : bonus,
        ),
      }))
    },
    [updateTask],
  )

  const handleRemoveBonusCode = useCallback(
    (taskId, bonusId) => {
      updateTask(taskId, (task) => ({
        bonusCodes: (task.bonusCodes ?? []).filter(
          (bonus) => bonus.id !== bonusId,
        ),
      }))
    },
    [updateTask],
  )

  const toggleTaskExpansion = useCallback((taskId) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
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
    if (!selectedGame || !selectedGameApiLocation) {
      setTeamsModalState({
        isLoading: false,
        error: selectedGameApiLocation
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
      const teamsParams = new URLSearchParams({
        location: selectedGameApiLocation,
      })
      const [gameTeamsResponse, teamsResponse] = await Promise.all([
        fetch(
          `/api/cabinet/games/${encodeURIComponent(
            selectedGame.id,
          )}/teams?${teamsParams.toString()}`,
        ),
        fetch(
          `/api/${selectedGameApiLocation}/custom?collection=teams&limit=200&sort=name_lowered`,
        ),
      ])

      const gameTeamsJson = await gameTeamsResponse.json()
      if (!gameTeamsResponse.ok || gameTeamsJson?.success === false) {
        throw new Error(
          extractErrorMessage(gameTeamsJson?.error) ||
            'Не удалось загрузить команды игры',
        )
      }

      const teamsJson = await teamsResponse.json()
      if (!teamsResponse.ok || teamsJson?.success === false) {
        throw new Error(
          extractErrorMessage(teamsJson?.error) ||
            'Не удалось загрузить список команд',
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
        const detailedParams = new URLSearchParams({
          location: selectedGameApiLocation,
        })
        allTeamIds.forEach((id) => detailedParams.append('teamIds', id))

        try {
          const { response: detailedResponse, json: detailedJson } =
            await requestApiJson(
              `/api/cabinet/teams?${detailedParams.toString()}`,
              {
                fallbackMessage:
                  'Не удалось загрузить детальную информацию о командах',
                throwOnHttpError: false,
              },
            )

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
              detailedJson,
            )
          }
        } catch (detailsError) {
          console.error(
            'Failed to load detailed team info for modal',
            detailsError,
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
            teamImage: teamInfo?.image || '',
            open: Boolean(teamInfo?.open),
            updatedAt: teamInfo?.updatedAt || null,
            membersCount,
            rating: teamInfo?.rating ?? null,
            teamDetails: teamInfo ?? null,
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
        (team) => team.id && !existingTeamIds.has(team.id),
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
            : availableTeams[0].id,
        )
      } else {
        setSelectedTeamToAdd('')
      }
    } catch (error) {
      console.error('Failed to load teams for modal', error)
      setTeamsModalState({
        isLoading: false,
        error:
          extractErrorMessage(error) ||
          'Не удалось загрузить данные команд игры',
        gameTeams: [],
        availableTeams: [],
      })
      setSelectedTeamToAdd('')
    }
  }, [selectedGame, selectedGameApiLocation])

  const handleAddTeamToGame = useCallback(async () => {
    if (!selectedGame || !selectedGameApiLocation || !selectedTeamToAdd) {
      return
    }

    setIsAddingTeam(true)
    setTeamsModalState((prev) => ({ ...prev, error: null }))

    try {
      await requestApiJson(`/api/${selectedGameApiLocation}/gamesteams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            teamId: selectedTeamToAdd,
            gameId: selectedGame.id,
          },
        }),
        fallbackMessage: 'Не удалось добавить команду',
      })

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
  }, [
    loadTeamsModalData,
    selectedGame,
    selectedGameApiLocation,
    selectedTeamToAdd,
  ])

  const handleRemoveTeamFromGame = useCallback(
    async (gameTeamId) => {
      if (!gameTeamId || !selectedGameApiLocation) {
        return
      }

      setRemovingTeamIds((prev) =>
        prev.includes(gameTeamId) ? prev : [...prev, gameTeamId],
      )
      setTeamsModalState((prev) => ({ ...prev, error: null }))

      try {
        await requestApiJson(
          `/api/${selectedGameApiLocation}/gamesteams/${gameTeamId}`,
          {
            method: 'DELETE',
            fallbackMessage: 'Не удалось удалить команду',
          },
        )

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
    [loadTeamsModalData, selectedGameApiLocation],
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
    setIsResultsModalOpen(false)
    setIsDescriptionModalOpen(true)
  }, [])

  const handleEditGameFromList = useCallback(
    (game) => {
      if (!game || !canManageGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      setEditingGame(cloneGameDraft(game))
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(true)
    },
    [canManageGame],
  )

  const handleOpenStatusModal = useCallback(
    (gameCandidate = null) => {
      const game = gameCandidate || selectedGame
      if (!game || !canManageGameStatus(game)) {
        return
      }

      setStatusModalGameId(game.id)
      setStatusValidationResult(null)
      setIsStatusModalOpen(true)
    },
    [canManageGameStatus, selectedGame],
  )

  const handleCloseStatusModal = useCallback(() => {
    if (isStatusChanging) {
      return
    }

    setIsStatusModalOpen(false)
    setStatusValidationResult(null)
  }, [isStatusChanging])

  const handleStatusAction = useCallback(
    async (actionId) => {
      if (!statusModalGame || !canManageGameStatus(statusModalGame)) {
        return
      }

      if (!actionId) {
        return
      }

      if (typeof window !== 'undefined' && actionId === 'start_game') {
        const shouldStart = window.confirm(
          'Вы уверены, что хотите запустить игру? Игроки получат уведомление о старте.',
        )
        if (!shouldStart) {
          return
        }
      }

      if (typeof window !== 'undefined' && actionId === 'stop_game') {
        const shouldStop = window.confirm(
          'Вы уверены, что хотите остановить игру? Коды больше не будут приниматься, игроки получат уведомление.',
        )
        if (!shouldStop) {
          return
        }
      }

      if (typeof window !== 'undefined' && actionId === 'restart_game') {
        const shouldRestart = window.confirm(
          'Перезапуск вернёт игру в статус «Активна». Продолжить?',
        )
        if (!shouldRestart) {
          return
        }
      }

      const gameApiLocation =
        statusModalGame.location ||
        (shouldShowLocationFilter ? gamesFilterLocation : location)

      if (!gameApiLocation) {
        setFeedback({
          type: 'error',
          message: 'Не удалось определить локацию игры для смены статуса.',
        })
        return
      }

      setIsStatusChanging(true)
      setFeedback(null)

      try {
        const runGameValidation = async () => {
          const { json } = await requestApiJson(
            `/api/${gameApiLocation}/games/check/${statusModalGame.id}`,
            {
              fallbackMessage: 'Не удалось выполнить проверку игры',
            },
          )

          const errors = Array.isArray(json?.data?.errors)
            ? json.data.errors
            : []
          const hasErrors = Boolean(json?.data?.hasErrors) || errors.length > 0

          return { hasErrors, errors }
        }

        if (actionId === 'check_game') {
          const validation = await runGameValidation()
          setStatusValidationResult({
            hasErrors: validation.hasErrors,
            errors: validation.errors,
          })
          setToastEvent({
            id: `game-check-${Date.now()}`,
            type: validation.hasErrors ? 'error' : 'success',
            message: validation.hasErrors
              ? `Обнаружены ошибки: ${validation.errors.length}`
              : 'Проверка завершена: ошибок не найдено',
          })
          return
        }

        setStatusValidationResult(null)
        let successMessage = 'Статус игры обновлён'

        if (actionId === 'start_game') {
          const validation = await runGameValidation()
          setStatusValidationResult({
            hasErrors: validation.hasErrors,
            errors: validation.errors,
          })

          if (validation.hasErrors) {
            setFeedback({
              type: 'error',
              message:
                'Запуск игры заблокирован: сначала исправьте ошибки проверки.',
            })
            setToastEvent({
              id: `game-start-validation-${Date.now()}`,
              type: 'error',
              message: `Запуск заблокирован: обнаружены ошибки (${validation.errors.length})`,
            })
            return
          }

          await requestApiJson(
            `/api/${gameApiLocation}/games/start/${statusModalGame.id}`,
            {
              fallbackMessage: 'Не удалось обновить статус игры',
            },
          )
          successMessage = 'Игра запущена'
        } else if (actionId === 'stop_game') {
          await requestApiJson(
            `/api/${gameApiLocation}/games/stop/${statusModalGame.id}`,
            {
              fallbackMessage: 'Не удалось обновить статус игры',
            },
          )
          successMessage = 'Игра остановлена'
        } else {
          let nextStatus = null

          if (actionId === 'restart_game' || actionId === 'activate_game') {
            nextStatus = 'active'
          } else if (actionId === 'cancel_game') {
            nextStatus = 'canceled'
          } else if (actionId === 'close_game') {
            if (!isGameConducted(statusModalGame)) {
              setFeedback({
                type: 'error',
                message: 'Нельзя закрыть игру, которая не была проведена.',
              })
              setToastEvent({
                id: `game-status-update-validation-${Date.now()}`,
                type: 'error',
                message: 'Нельзя закрыть игру, которая не была проведена.',
              })
              return
            }
            nextStatus = 'closed'
          } else if (actionId === 'reopen_game') {
            nextStatus = 'reopen'
            successMessage = 'Игра открыта'
          }

          if (!nextStatus) {
            return
          }

          await requestApiJson(
            `/api/${gameApiLocation}/games/${statusModalGame.id}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: { status: nextStatus } }),
              fallbackMessage: 'Не удалось обновить статус игры',
            },
          )
        }

        await fetchGamesPage({
          offset: 0,
          replace: true,
          locationValue: shouldShowLocationFilter
            ? gamesFilterLocation
            : location,
        })

        setIsStatusModalOpen(false)
        setFeedback({ type: 'success', message: successMessage })
        setToastEvent({
          id: `game-status-updated-${Date.now()}`,
          type: 'success',
          message: successMessage,
        })
      } catch (error) {
        const message = error?.message || 'Не удалось обновить статус игры'
        setFeedback({ type: 'error', message })
        setToastEvent({
          id: `game-status-update-error-${Date.now()}`,
          type: 'error',
          message,
        })
      } finally {
        setIsStatusChanging(false)
      }
    },
    [
      canManageGameStatus,
      fetchGamesPage,
      gamesFilterLocation,
      location,
      shouldShowLocationFilter,
      statusModalGame,
    ],
  )

  const handleManageTeamsFromList = useCallback(
    (game) => {
      if (!game || !canManageGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      setIsResultsModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsTeamsModalOpen(true)
    },
    [canManageGame],
  )

  const canViewResultsForGame = useCallback((game) => {
    if (!game || Boolean(game.hideResult)) {
      return false
    }

    if (!Boolean(game.isResultGenerated)) {
      return false
    }

    const status =
      typeof game.status === 'string' ? game.status.toLowerCase() : ''
    return status === 'finished' || status === 'closed'
  }, [])

  const canGenerateResults = useMemo(() => {
    if (!canEditSelectedGame || !selectedGame) {
      return false
    }

    const status =
      typeof selectedGame.status === 'string'
        ? selectedGame.status.toLowerCase()
        : ''

    return status === 'finished' || status === 'closed'
  }, [canEditSelectedGame, selectedGame])

  const loadGameResults = useCallback(
    async (game) => {
      if (!game?.id) {
        return
      }

      const cached = resultsCacheByGameId[game.id]
      if (cached) {
        setResultsModalState({
          isLoading: false,
          error: null,
          ...cached,
        })
        return
      }

      const locationForApi =
        game.location ||
        (shouldShowLocationFilter ? gamesFilterLocation : location) ||
        ''

      setResultsModalState({
        isLoading: true,
        error: null,
        gameId: game.id,
        gameName: game.name || 'Без названия',
        rows: [],
        teamsCount: 0,
        participantsCount: 0,
        computed: null,
        interactiveResultsUrl: null,
      })

      try {
        const params = new URLSearchParams()
        if (locationForApi) {
          params.set('location', locationForApi)
        }

        const { json } = await requestApiJson(
          `/api/cabinet/games/${encodeURIComponent(game.id)}/result?${params.toString()}`,
          {
            fallbackMessage: 'Не удалось загрузить результаты игры',
          },
        )

        const nextData = {
          gameId: json?.data?.gameId || game.id,
          gameName: json?.data?.gameName || game.name || 'Без названия',
          rows: Array.isArray(json?.data?.rows) ? json.data.rows : [],
          teamsCount: Number(json?.data?.teamsCount) || 0,
          participantsCount: Number(json?.data?.participantsCount) || 0,
          computed:
            json?.data?.computed && typeof json.data.computed === 'object'
              ? json.data.computed
              : null,
          interactiveResultsUrl:
            typeof json?.data?.interactiveResultsUrl === 'string' &&
            json.data.interactiveResultsUrl.trim().length > 0
              ? json.data.interactiveResultsUrl.trim()
              : null,
        }

        setResultsCacheByGameId((prev) => ({
          ...prev,
          [game.id]: nextData,
        }))

        setResultsModalState({
          isLoading: false,
          error: null,
          ...nextData,
        })
      } catch (error) {
        setResultsModalState({
          isLoading: false,
          error: error?.message || 'Не удалось загрузить результаты игры',
          gameId: game.id,
          gameName: game.name || 'Без названия',
          rows: [],
          teamsCount: 0,
          participantsCount: 0,
          computed: null,
          interactiveResultsUrl: null,
        })
      }
    },
    [
      gamesFilterLocation,
      location,
      resultsCacheByGameId,
      shouldShowLocationFilter,
    ],
  )

  const handleOpenResultsFromGame = useCallback(
    (game) => {
      if (!game || !canViewResultsForGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(false)
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(true)
      loadGameResults(game)
    },
    [canViewResultsForGame, loadGameResults],
  )

  const handleCloseResultsModal = useCallback(() => {
    setIsResultsModalOpen(false)
  }, [])

  const handleGenerateResults = useCallback(async () => {
    if (!selectedGame || !canGenerateResults || isGeneratingResults) {
      return
    }

    const locationForApi =
      selectedGame.location ||
      (shouldShowLocationFilter ? gamesFilterLocation : location) ||
      ''

    setIsGeneratingResults(true)
    setFeedback(null)

    try {
      const { json } = await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(selectedGame.id)}/result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: locationForApi }),
          fallbackMessage: 'Не удалось сформировать результаты',
        },
      )

      const nextData = {
        gameId: json?.data?.gameId || selectedGame.id,
        gameName: json?.data?.gameName || selectedGame.name || 'Без названия',
        rows: Array.isArray(json?.data?.rows) ? json.data.rows : [],
        teamsCount: Number(json?.data?.teamsCount) || 0,
        participantsCount: Number(json?.data?.participantsCount) || 0,
        computed:
          json?.data?.computed && typeof json.data.computed === 'object'
            ? json.data.computed
            : null,
        interactiveResultsUrl:
          typeof json?.data?.interactiveResultsUrl === 'string' &&
          json.data.interactiveResultsUrl.trim().length > 0
            ? json.data.interactiveResultsUrl.trim()
            : null,
      }

      setResultsCacheByGameId((prev) => ({
        ...prev,
        [selectedGame.id]: nextData,
      }))

      setGames((prev) =>
        prev.map((gameItem) =>
          gameItem.id === selectedGame.id
            ? { ...gameItem, isResultGenerated: true }
            : gameItem,
        ),
      )
      setPersistedGames((prev) =>
        prev.map((gameItem) =>
          gameItem.id === selectedGame.id
            ? { ...gameItem, isResultGenerated: true }
            : gameItem,
        ),
      )

      setResultsModalState({
        isLoading: false,
        error: null,
        ...nextData,
      })

      setFeedback({ type: 'success', message: 'Результаты игры сформированы' })
      setToastEvent({
        id: `generate-results-success-${Date.now()}`,
        type: 'success',
        message: 'Результаты игры сформированы',
      })
    } catch (error) {
      const message = error?.message || 'Не удалось сформировать результаты'
      setFeedback({
        type: 'error',
        message,
      })
      setToastEvent({
        id: `generate-results-error-${Date.now()}`,
        type: 'error',
        message,
      })
    } finally {
      setIsGeneratingResults(false)
    }
  }, [
    canGenerateResults,
    gamesFilterLocation,
    isGeneratingResults,
    location,
    selectedGame,
    shouldShowLocationFilter,
  ])

  const handleOpenEditModal = useCallback(() => {
    if (!canEditSelectedGame) {
      return
    }

    setEditingGame(cloneGameDraft(selectedGame))
    setIsResultsModalOpen(false)
    setIsDescriptionModalOpen(false)
    setIsEditModalOpen(true)
  }, [canEditSelectedGame, selectedGame])

  const handleCloseEditModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setEditingGame(null)
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
  }, [
    canEditSelectedGame,
    handleCloseEditModal,
    handleSaveChanges,
    isDirty,
    isSaving,
  ])

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
  }, [
    availableModeratorsMap,
    canEditSelectedGame,
    selectedGame,
    selectedModeratorToAdd,
    updateSelectedGame,
  ])

  const handleRemoveModerator = useCallback(
    (moderatorId) => {
      if (!canEditSelectedGame || !moderatorId) {
        return
      }

      updateSelectedGame((game) => ({
        moderators: (Array.isArray(game.moderators)
          ? game.moderators
          : []
        ).filter((moderator) => {
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
    [canEditSelectedGame, updateSelectedGame],
  )

  const renderGameListItem = useCallback(
    (game) => {
      const startDateLabel = game.dateStart
        ? new Date(game.dateStart).toLocaleString('ru-RU', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : 'Дата не задана'

      const canManageThisGame = canManageGame(game)
      const canManageStatusThisGame = canManageGameStatus(game)
      const canViewThisGameResults = canViewResultsForGame(game)
      const visibleStatus = normalizeVisibleStatus(
        game.status,
        canSeeClosedStatus,
      )
      const userTeamPlace = Number(game.userTeamPlace)
      const hasUserTeamPlace =
        Number.isFinite(userTeamPlace) && userTeamPlace > 0
      const hasSeason =
        typeof game?.seasonId === 'string' && game.seasonId.trim().length > 0
      const seasonLabel =
        typeof game?.seasonName === 'string' ? game.seasonName.trim() : ''
      const seasonBadgeLabel =
        hasSeason && seasonLabel ? seasonLabel : 'Вне сезона'
      const isHiddenGame = Boolean(game?.hidden)

      return (
        <li key={game.id}>
          <SelectableCard
            role="button"
            tabIndex={0}
            onClick={() => handleSelectGameCard(game)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleSelectGameCard(game)
              }
            }}
            isActive={false}
            className="relative p-0 overflow-hidden cursor-pointer"
            aria-pressed={false}
            aria-label={`Открыть описание игры «${game.name || 'Без названия'}»`}
            title={game.name || 'Без названия'}
          >
            <div className="flex items-start min-w-0">
              <div className="relative hidden w-[156px] shrink-0 rounded-lg overflow-hidden bg-slate-100 sm:block dark:border-slate-700 dark:bg-slate-900">
                <GameCardImage
                  src={game.image}
                  alt={game.name ? `Обложка игры ${game.name}` : 'Обложка игры'}
                  className="block w-full h-auto"
                  placeholderClassName="flex w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 py-6 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400"
                />
              </div>
              <div
                className="min-w-0 flex-1 p-0 sm:absolute sm:inset-y-0 sm:left-[168px] sm:right-0 sm:overflow-hidden sm:p-4"
              >
                <div className="flex items-start flex-1 w-full min-w-0 gap-3">
                  <div className="relative w-24 overflow-hidden border shrink-0 rounded-xl border-slate-200 bg-slate-100 sm:hidden dark:border-slate-700 dark:bg-slate-900">
                    <GameCardImage
                      src={game.image}
                      alt={
                        game.name ? `Обложка игры ${game.name}` : 'Обложка игры'
                      }
                      className="block w-full h-auto"
                      placeholderClassName="flex w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(visibleStatus)}`}
                    >
                      {getGameStatusLabel(visibleStatus)}
                    </span>
                    {game?.isRated === true && (
                      <span className="mb-2 ml-2 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                        {seasonBadgeLabel}
                      </span>
                    )}
                    {isHiddenGame && (
                      <span className="mb-2 ml-2 inline-flex items-center rounded-full border border-rose-300/70 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-200">
                        Скрыта
                      </span>
                    )}
                    <p className="text-sm font-semibold aq-line-clamp-2 text-primary dark:text-slate-100">
                      {game.name || 'Без названия'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className="text-slate-500">{startDateLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {getNounTeams(game.teamsCount)}
                    </p>
                  </div>
                </div>
                {(hasUserTeamPlace ||
                  canManageThisGame ||
                  canManageStatusThisGame ||
                  canViewThisGameResults) && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {(canManageThisGame || canManageStatusThisGame) && (
                        <>
                          {canManageThisGame && (
                            <CardActionIconButton
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEditGameFromList(game)
                              }}
                              label="Редактировать игру"
                            >
                              <EditCardIcon />
                            </CardActionIconButton>
                          )}
                          {canManageStatusThisGame && (
                            <CardActionIconButton
                              onClick={(event) => {
                                event.stopPropagation()
                                handleOpenStatusModal(game)
                              }}
                              label="Сменить статус игры"
                            >
                              <StatusCardIcon />
                            </CardActionIconButton>
                          )}
                          {canManageThisGame && (
                            <CardActionIconButton
                              onClick={(event) => {
                                event.stopPropagation()
                                handleManageTeamsFromList(game)
                              }}
                              label="Управление командами"
                            >
                              <TeamCardIcon />
                            </CardActionIconButton>
                          )}
                        </>
                      )}
                      {hasUserTeamPlace && (
                        <span className="pointer-events-none inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200">
                          Место: {userTeamPlace}
                        </span>
                      )}
                    </div>
                    {canViewThisGameResults && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleOpenResultsFromGame(game)
                        }}
                        className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/80 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/14 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/24"
                      >
                        Результаты
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SelectableCard>
        </li>
      )
    },
    [
      canManageGame,
      canManageGameStatus,
      canSeeClosedStatus,
      canViewResultsForGame,
      getNounTeams,
      handleEditGameFromList,
      handleManageTeamsFromList,
      handleOpenResultsFromGame,
      handleOpenStatusModal,
      handleSelectGameCard,
      selectedGameId,
    ],
  )

  const renderGameTileItem = useCallback(
    (game) => {
      const startDateLabel = game.dateStart
        ? new Date(game.dateStart).toLocaleString('ru-RU', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : 'Дата не задана'

      const canManageThisGame = canManageGame(game)
      const canManageStatusThisGame = canManageGameStatus(game)
      const canViewThisGameResults = canViewResultsForGame(game)
      const visibleStatus = normalizeVisibleStatus(
        game.status,
        canSeeClosedStatus,
      )
      const userTeamPlace = Number(game.userTeamPlace)
      const hasUserTeamPlace =
        Number.isFinite(userTeamPlace) && userTeamPlace > 0
      const hasSeason =
        typeof game?.seasonId === 'string' && game.seasonId.trim().length > 0
      const seasonLabel =
        typeof game?.seasonName === 'string' ? game.seasonName.trim() : ''
      const seasonBadgeLabel =
        hasSeason && seasonLabel ? seasonLabel : 'Вне сезона'
      const isHiddenGame = Boolean(game?.hidden)

      return (
        <li key={game.id}>
          <SelectableCard
            role="button"
            tabIndex={0}
            onClick={() => handleSelectGameCard(game)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleSelectGameCard(game)
              }
            }}
            isActive={false}
            className="relative p-0 overflow-hidden cursor-pointer"
            aria-pressed={false}
            aria-label={`Открыть описание игры «${game.name || 'Без названия'}»`}
            title={game.name || 'Без названия'}
          >
            <div className="relative w-full overflow-hidden border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
              <GameCardImage
                src={game.image}
                alt={game.name ? `Обложка игры ${game.name}` : 'Обложка игры'}
                className="block w-full h-auto"
                placeholderClassName="flex min-h-[180px] w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400"
              />
            </div>
            <div className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(visibleStatus)}`}
                >
                  {getGameStatusLabel(visibleStatus)}
                </span>
                {game?.isRated === true && (
                  <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                    {seasonBadgeLabel}
                  </span>
                )}
                {isHiddenGame && (
                  <span className="inline-flex items-center rounded-full border border-rose-300/70 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-200">
                    Скрыта
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold aq-line-clamp-2 text-primary dark:text-slate-100">
                {game.name || 'Без названия'}
              </p>
              <p className="text-xs text-slate-500">{startDateLabel}</p>
              <p className="text-xs text-slate-400">
                {getNounTeams(game.teamsCount)}
              </p>
              {(canViewThisGameResults ||
                hasUserTeamPlace ||
                canManageThisGame ||
                canManageStatusThisGame) && (
                <div className="flex items-end justify-between gap-2 mt-3">
                  <div className="flex flex-col items-start gap-2">
                    {canViewThisGameResults && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleOpenResultsFromGame(game)
                        }}
                        className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/70 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/22"
                      >
                        Результаты
                      </button>
                    )}
                    {hasUserTeamPlace && (
                      <span className="pointer-events-none inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200">
                        Место: {userTeamPlace}
                      </span>
                    )}
                  </div>
                  {(canManageThisGame || canManageStatusThisGame) && (
                    <div className="flex items-center self-end gap-2 pointer-events-auto">
                      {canManageThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleEditGameFromList(game)
                          }}
                          label="Редактировать игру"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <EditCardIcon />
                        </CardActionIconButton>
                      )}
                      {canManageStatusThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenStatusModal(game)
                          }}
                          label="Сменить статус игры"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <StatusCardIcon />
                        </CardActionIconButton>
                      )}
                      {canManageThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleManageTeamsFromList(game)
                          }}
                          label="Управление командами"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <TeamCardIcon />
                        </CardActionIconButton>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SelectableCard>
        </li>
      )
    },
    [
      canManageGame,
      canManageGameStatus,
      canSeeClosedStatus,
      canViewResultsForGame,
      getNounTeams,
      handleEditGameFromList,
      handleManageTeamsFromList,
      handleOpenResultsFromGame,
      handleOpenStatusModal,
      handleSelectGameCard,
      selectedGameId,
    ],
  )

  const modalGame = isEditModalOpen && editingGame ? editingGame : selectedGame

  const gameTypeLabel = useMemo(() => {
    if (!modalGame) {
      return '—'
    }

    const option = GAME_TYPE_OPTIONS.find(
      (item) => item.value === modalGame.type,
    )
    return option?.label ?? '—'
  }, [modalGame])

  const plannedStartLabel = useMemo(() => {
    if (!modalGame?.dateStart) {
      return 'Дата не назначена'
    }

    try {
      return new Date(modalGame.dateStart).toLocaleString('ru-RU', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    } catch (error) {
      return 'Дата не назначена'
    }
  }, [modalGame])

  const taskDurationLabel = useMemo(() => {
    if (!modalGame) {
      return '—'
    }

    const minutes = toMinutes(modalGame.taskDuration)
    return minutes > 0 ? `${minutes} мин` : 'Не задано'
  }, [modalGame])

  const cluesDurationLabel = useMemo(() => {
    if (!modalGame) {
      return '—'
    }

    const minutes = toMinutes(modalGame.cluesDuration)
    return minutes > 0 ? `${minutes} мин` : 'Подсказки отключены'
  }, [modalGame])

  const selectedGameModerators = useMemo(() => {
    if (!modalGame) {
      return []
    }

    return (modalGame.moderators ?? []).filter(Boolean)
  }, [modalGame])

  const availableModeratorsForSelect = useMemo(() => {
    if (!modalGame) {
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
        .filter(Boolean),
    )

    return availableModerators.filter(
      (moderator) => !existingIds.has(moderator.id),
    )
  }, [availableModerators, modalGame, selectedGameModerators])

  const clueModeDetails = useMemo(() => {
    if (!modalGame) {
      return { modeLabel: '—', valueLabel: '—' }
    }

    const option = CLUE_EARLY_MODE_OPTIONS.find(
      (item) => item.value === modalGame.clueEarlyAccessMode,
    )
    const minutes = toMinutes(modalGame.clueEarlyPenalty)

    if (modalGame.clueEarlyAccessMode === 'penalty') {
      return {
        modeLabel: option?.label ?? '—',
        valueLabel:
          minutes > 0 ? `Штраф ${minutes} мин` : 'Штраф не применяется',
      }
    }

    return {
      modeLabel: option?.label ?? '—',
      valueLabel:
        minutes > 0
          ? `После подсказки добавляется ${minutes} мин ожидания`
          : 'Без дополнительного времени',
    }
  }, [modalGame])

  const canViewGameResults = useMemo(
    () => canViewResultsForGame(selectedGame),
    [canViewResultsForGame, selectedGame],
  )

  const breakDurationLabel = useMemo(() => {
    if (!modalGame) {
      return '—'
    }

    const minutes = toMinutes(modalGame.breakDuration)
    return minutes > 0 ? `${minutes} мин` : 'Без перерывов'
  }, [modalGame])

  const taskFailurePenaltyLabel = useMemo(() => {
    if (!modalGame) {
      return '—'
    }

    if (modalGame.type === 'photo') {
      const value = Number(modalGame.taskFailurePenalty) || 0
      return value > 0 ? `${value} баллов` : 'Штраф отсутствует'
    }

    const minutes = toMinutes(modalGame.taskFailurePenalty)
    return minutes > 0 ? `${minutes} мин` : 'Штраф отсутствует'
  }, [modalGame])

  const manyCodesLimitLabel = useMemo(() => {
    if (!modalGame || modalGame.type === 'photo') {
      return null
    }

    const limit = Number(modalGame.manyCodesPenalty?.[0]) || 0
    return limit > 0 ? `${limit} попыток` : 'Лимит не задан'
  }, [modalGame])

  const manyCodesPenaltyLabel = useMemo(() => {
    if (!modalGame || modalGame.type === 'photo') {
      return null
    }

    const seconds = Number(modalGame.manyCodesPenalty?.[1]) || 0
    const minutes = toMinutes(seconds)
    return minutes > 0 ? `${minutes} мин` : 'Без штрафа'
  }, [modalGame])

  const financesSummary = useMemo(() => {
    if (!modalGame?.finances) {
      return { income: 0, expense: 0, balance: 0 }
    }

    const { income, expense } = modalGame.finances.reduce(
      (acc, entry) => {
        if (entry.type === 'expense') {
          acc.expense += Number(entry.sum) || 0
        } else {
          acc.income += Number(entry.sum) || 0
        }
        return acc
      },
      { income: 0, expense: 0 },
    )

    return { income, expense, balance: income - expense }
  }, [modalGame])

  const balanceClass =
    financesSummary.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
  const isCardsDisplay = gamesDisplayMode === 'cards'
  const pageTitle = isUpcomingView
    ? 'Предстоящие игры'
    : isPastView
      ? 'Прошедшие игры'
      : 'Игры'
  const pageDescription =
    isUpcomingView || isPastView
      ? 'Выберите игру из списка и откройте детали.'
      : 'Редактируйте сценарии, управляйте статусами и готовьте квесты к запуску.'

  return (
    <>
      <Head>
        <title>ActQuest — Игры</title>
      </Head>
      <CabinetLayout
        title={pageTitle}
        description={pageDescription}
        activePage="games"
      >
        <FeedbackToast event={toastEvent} />
        <section className="grid gap-6 md:grid-cols-5">
          <div className="space-y-4 md:col-span-5 md:max-w-4xl">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenRegisterModal}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white transition cursor-pointer rounded-xl bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Зарегистрироваться на игру по id
              </button>
              {canEditAllGames && (
                <button
                  type="button"
                  onClick={handleOpenCreateGameModal}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition border rounded-xl border-primary text-primary hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-slate-400 dark:bg-slate-800/50 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Создать игру
                </button>
              )}
              <div className="inline-flex p-1 ml-auto border rounded-xl border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setGamesDisplayMode('list')}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    gamesDisplayMode === 'list'
                      ? 'bg-primary text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Список
                </button>
                <button
                  type="button"
                  onClick={() => setGamesDisplayMode('cards')}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    gamesDisplayMode === 'cards'
                      ? 'bg-primary text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Карточки
                </button>
              </div>
              <NeonCheckbox
                id="games-show-canceled"
                checked={showCanceledGames}
                onChange={(event) => setShowCanceledGames(event.target.checked)}
                className="px-3 py-2 border rounded-xl border-slate-200 dark:border-slate-700"
                label="Отменённые"
                labelClassName="text-xs font-semibold text-slate-600 dark:text-slate-300"
              />
            </div>
            {shouldShowLocationFilter && (
              <div className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80">
                <label
                  htmlFor="games-city-filter"
                  className="text-xs font-semibold tracking-wide uppercase text-slate-500"
                >
                  Город для списка игр
                </label>
                <select
                  id="games-city-filter"
                  value={gamesFilterLocation}
                  onChange={(event) =>
                    setGamesFilterLocation(event.target.value)
                  }
                  className="w-full px-3 py-2 mt-2 text-sm border cursor-pointer rounded-xl border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700"
                >
                  {gameLocationOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {isPastView && (
                  <>
                    <label
                      htmlFor="games-past-season-filter"
                      className="block mt-4 text-xs font-semibold tracking-wide uppercase text-slate-500"
                    >
                      Сезон
                    </label>
                    <select
                      id="games-past-season-filter"
                      value={pastGamesSeasonFilter}
                      onChange={(event) =>
                        setPastGamesSeasonFilter(event.target.value)
                      }
                      className="w-full px-3 py-2 mt-2 text-sm border cursor-pointer rounded-xl border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700"
                    >
                      {pastGamesSeasonOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {locationFilterError && (
                  <p className="mt-2 text-xs text-rose-500">
                    {locationFilterError}
                  </p>
                )}
              </div>
            )}
            {!shouldShowLocationFilter && (
              <div className="flex items-start gap-3 p-4 border shadow-sm bg-violet-50 border-violet-100 rounded-2xl dark:bg-violet-500/10 dark:border-violet-500/40">
                <span
                  className="flex items-center justify-center font-semibold bg-white rounded-full shadow-sm h-9 w-9 shrink-0 text-violet-600 dark:bg-violet-500/40 dark:text-violet-100"
                  aria-hidden="true"
                >
                  i
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-violet-900 dark:text-violet-50">
                    Ваши игры
                  </p>
                  <p className="text-xs leading-5 text-violet-700 dark:text-violet-200">
                    Выберите игру, чтобы открыть ключевые настройки, управлять
                    составами и следить за финансами.
                  </p>
                </div>
              </div>
            )}

            {selectedGame && !location && (
              <NoticeBanner tone="warning" variant="neon">
                Не удалось определить площадку пользователя. Сохранение
                изменений недоступно.
              </NoticeBanner>
            )}

            {isLocationFilterLoading && shouldShowLocationFilter ? (
              <div className="p-6 text-sm text-center bg-white border shadow-sm text-slate-500 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 rounded-2xl">
                Загружаем игры выбранного города...
              </div>
            ) : games.length > 0 ? (
              <div className="space-y-6">
                {!isPastView && upcomingGames.length > 0 && (
                  <div>
                    <h3 className="px-1 text-xs font-semibold tracking-wide uppercase text-slate-500">
                      Активные и запланированные
                    </h3>
                    <ul
                      className={
                        isCardsDisplay
                          ? 'mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
                          : 'mt-2 space-y-3'
                      }
                    >
                      {upcomingGames.map((game) =>
                        isCardsDisplay
                          ? renderGameTileItem(game)
                          : renderGameListItem(game),
                      )}
                    </ul>
                  </div>
                )}
                {!isUpcomingView && pastGames.length > 0 && (
                  <div>
                    <h3 className="px-1 text-xs font-semibold tracking-wide uppercase text-slate-500">
                      {showCanceledGames
                        ? 'Завершённые и отменённые'
                        : 'Завершённые'}
                    </h3>
                    <ul
                      className={
                        isCardsDisplay
                          ? 'mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
                          : 'mt-2 space-y-3'
                      }
                    >
                      {pastGames.map((game) =>
                        isCardsDisplay
                          ? renderGameTileItem(game)
                          : renderGameListItem(game),
                      )}
                    </ul>
                  </div>
                )}
                {((isUpcomingView && upcomingGames.length === 0) ||
                  (isPastView && pastGames.length === 0)) && (
                  <div className="p-6 text-sm text-center bg-white border shadow-sm text-slate-500 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 rounded-2xl">
                    {isUpcomingView
                      ? 'Предстоящих игр пока нет.'
                      : 'Прошедших игр пока нет.'}
                  </div>
                )}
                {hasMoreGames && (
                  <button
                    type="button"
                    onClick={handleLoadMoreGames}
                    disabled={isLoadingMoreGames}
                    className={`w-full rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isLoadingMoreGames
                        ? 'cursor-wait border-slate-300 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                        : 'cursor-pointer border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/10'
                    }`}
                  >
                    {isLoadingMoreGames ? 'Загружаем…' : 'Загрузить ещё'}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 text-sm text-center bg-white border shadow-sm text-slate-500 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 rounded-2xl">
                Для выбранного города пока нет игр. Создайте сценарий в
                телеграм-боте, чтобы он появился здесь.
              </div>
            )}
          </div>

          {selectedGame && (
            <div className="md:col-span-5">
              <div className="space-y-6">
                <GameModals
                  selectedGame={selectedGame}
                  editGame={editingGame}
                  isEditModalOpen={isEditModalOpen}
                  handleCloseEditModal={handleCloseEditModal}
                  canEditSelectedGame={canEditSelectedGame}
                  isSaving={isSaving}
                  location={selectedGameApiLocation}
                  isDirty={isDirty}
                  handleModalPrimaryAction={handleModalPrimaryAction}
                  handleResetChanges={handleResetChanges}
                  updateSelectedGame={updateSelectedGame}
                  GAME_TYPE_OPTIONS={GAME_TYPE_OPTIONS}
                  CLUE_EARLY_MODE_OPTIONS={CLUE_EARLY_MODE_OPTIONS}
                  handleOpenStatusModal={handleOpenStatusModal}
                  toMinutes={toMinutes}
                  toSeconds={toSeconds}
                  handleAddTask={handleAddTask}
                  handleRemoveTask={handleRemoveTask}
                  handleTaskFieldChange={handleTaskFieldChange}
                  handleTaskNumberChange={handleTaskNumberChange}
                  handleTaskOptionalNumberChange={
                    handleTaskOptionalNumberChange
                  }
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
                  canGenerateResults={canGenerateResults}
                  isGeneratingResults={isGeneratingResults}
                  handleGenerateResults={handleGenerateResults}
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
                  currentUserId={currentUserDbId}
                  isCreateGameModalOpen={isCreateGameModalOpen}
                  handleCloseCreateGameModal={handleCloseCreateGameModal}
                  isCreatingGame={isCreatingGame}
                  handleCreateGame={handleCreateGame}
                  newGameName={newGameName}
                  setNewGameName={setNewGameName}
                  newGameIsRated={newGameIsRated}
                  setNewGameIsRated={setNewGameIsRated}
                  createGameMode={createGameMode}
                  setCreateGameMode={setCreateGameMode}
                  cloneSourceGameId={cloneSourceGameId}
                  setCloneSourceGameId={setCloneSourceGameId}
                  createGameCloneSourceOptions={createGameCloneSourceOptions}
                  isCloneSourceGamesLoading={isCloneSourceGamesLoading}
                  createGameLocation={createGameLocation}
                  setCreateGameLocation={handleCreateGameLocationChange}
                  createGameSeasonId={createGameSeasonId}
                  setCreateGameSeasonId={setCreateGameSeasonId}
                  createGameSeasons={createGameSeasons}
                  isCreateGameSeasonsLoading={isCreateGameSeasonsLoading}
                  isCreateGameSeasonCreating={Boolean(
                    createGameLocation &&
                    creatingSeasonByLocation[
                      String(createGameLocation).trim().toLowerCase()
                    ],
                  )}
                  handleCreateSeasonForCreateGame={
                    handleCreateSeasonForCreateGame
                  }
                  createGameLocationOptions={gameLocationOptions}
                  createGameCloneOptions={createGameCloneOptions}
                  handleChangeCreateGameCloneOption={
                    handleChangeCreateGameCloneOption
                  }
                  isCreateGameActionDisabled={isCreateGameActionDisabled}
                  createGameFeedback={createGameFeedback}
                  isDescriptionModalOpen={isDescriptionModalOpen}
                  handleCloseDescriptionModal={handleCloseDescriptionModal}
                  gameTypeLabel={gameTypeLabel}
                  plannedStartLabel={plannedStartLabel}
                  canViewRestrictedGameInfo={canViewRestrictedGameInfo}
                  canViewGameResults={canViewGameResults}
                  handleOpenResultsModal={() =>
                    handleOpenResultsFromGame(selectedGame)
                  }
                  selectedGameModerators={selectedGameModerators}
                  availableModeratorsForSelect={availableModeratorsForSelect}
                  availableModeratorsMap={availableModeratorsMap}
                  selectedModeratorToAdd={selectedModeratorToAdd}
                  setSelectedModeratorToAdd={setSelectedModeratorToAdd}
                  handleAddModerator={handleAddModerator}
                  handleRemoveModerator={handleRemoveModerator}
                  editGameSeasons={editGameSeasons}
                  isEditGameSeasonsLoading={isEditGameSeasonsLoading}
                  isEditGameSeasonCreating={Boolean(
                    editingGame?.location &&
                    creatingSeasonByLocation[
                      String(editingGame.location).trim().toLowerCase()
                    ],
                  )}
                  handleCreateSeasonForEditGame={handleCreateSeasonForEditGame}
                  taskDurationLabel={taskDurationLabel}
                  cluesDurationLabel={cluesDurationLabel}
                  clueModeDetails={clueModeDetails}
                  breakDurationLabel={breakDurationLabel}
                  taskFailurePenaltyLabel={taskFailurePenaltyLabel}
                  manyCodesLimitLabel={manyCodesLimitLabel}
                  manyCodesPenaltyLabel={manyCodesPenaltyLabel}
                  isResultsModalOpen={isResultsModalOpen}
                  handleCloseResultsModal={handleCloseResultsModal}
                  resultsModalState={resultsModalState}
                />
                <GameStatusModal
                  isOpen={isStatusModalOpen}
                  onClose={handleCloseStatusModal}
                  gameName={statusModalGame?.name || ''}
                  currentStatusLabel={getGameStatusLabel(
                    statusModalGame?.status || '',
                  )}
                  actions={statusModalActions}
                  onAction={handleStatusAction}
                  validationResult={statusValidationResult}
                  isSaving={isStatusChanging}
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
      location: PropTypes.string,
      seasonId: PropTypes.string,
      seasonName: PropTypes.string,
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
      isRated: PropTypes.bool,
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
        }),
      ),
      teamsCount: PropTypes.number,
      userTeamPlace: PropTypes.number,
      isResultGenerated: PropTypes.bool,
      tasksStats: PropTypes.shape({
        total: PropTypes.number,
        bonus: PropTypes.number,
        canceled: PropTypes.number,
      }),
      updatedAt: PropTypes.string,
      createdAt: PropTypes.string,
      moderators: PropTypes.arrayOf(moderatorShape),
    }),
  ),
  initialHasMore: PropTypes.bool,
  initialLocation: PropTypes.string,
  session: PropTypes.object,
  availableModerators: PropTypes.arrayOf(moderatorShape),
}

GamesPage.defaultProps = {
  initialGames: [],
  initialHasMore: false,
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
  const currentUserId =
    session?.user?._id === null || session?.user?._id === undefined
      ? null
      : String(session.user._id)
  const currentUserTelegramId = Number.isFinite(numericTelegramId)
    ? numericTelegramId
    : null
  let initialGames = []
  let initialHasMore = false
  let availableGameModerators = []

  if (location) {
    try {
      const db = await dbConnectGlobal()

      if (db) {
        const UsersModel = db.model('Users')
        const gamesResult = await fetchGamesForCabinet({
          db,
          location,
          userRole,
          creatorTelegramId,
          currentUserId,
          currentUserTelegramId,
          offset: 0,
          limit: GAMES_PAGE_SIZE,
          view: 'all',
        })
        initialGames = gamesResult.games
        initialHasMore = gamesResult.hasMore

        const moderatorsDocs = await UsersModel.find({ role: 'moder' })
          .sort({ name: 1, username: 1 })
          .select({ _id: 1, name: 1, username: 1, telegramId: 1 })
          .lean()

        availableGameModerators = moderatorsDocs
          .map((moderator) => {
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
          })
          .filter(Boolean)
      }
    } catch (error) {
      console.error('Failed to load games for cabinet', error)
    }
  }

  return {
    props: {
      session,
      initialGames,
      initialHasMore,
      initialLocation: location,
      availableModerators: availableGameModerators,
    },
  }
}

export default GamesPage
