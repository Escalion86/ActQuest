'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import SelectableCard from '@components/cabinet/SelectableCard'
import CardActionIconButton, {
  AgentCardIcon,
  ChatCardIcon,
  EditCardIcon,
  FinanceCardIcon,
  GameControlCardIcon,
  HistoryCardIcon,
  StatusCardIcon,
  TargetCardIcon,
  TeamCardIcon,
} from '@components/cabinet/CardActionIconButton'
import FeedbackToast from '@components/FeedbackToast'
import NoticeBanner from '@components/NoticeBanner'
import GameModals from '@components/modals/GameModals'
import GameStatusModal from '@components/modals/GameStatusModal'
import GamePushBroadcastModal from '@components/modals/GamePushBroadcastModal'
import extractErrorMessage from '@helpers/extractErrorMessage'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import { toStringId } from '@helpers/idAndDate'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import {
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionMode,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'
import requestApiJson from '@helpers/requestApiJson'
import { resolveGameEntryHrefFromGame } from '@helpers/resolveGameEntryHref'
import {
  getDuplicateCodeKindsLabel,
  getTaskDuplicateCodeConflicts,
} from '@helpers/getTaskDuplicateCodeConflicts'
import { canManageCabinetGameFinances } from '@helpers/cabinetGameVisibility'
import buildGameFinancesSummary from '@helpers/gameFinancesSummary'
import {
  applyGameDraftPatch,
  areGameDraftsEqual,
} from '@helpers/gameDraftDirtyState'
import useMergedSession from '@helpers/useMergedSession'
import { getNounTeams } from '@helpers/getNoun'
import {
  buildDefaultPrequel,
  normalizePrequelConfig,
  normalizePrequelStoryEffect,
} from '@helpers/normalizePrequel'
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

const STARTED_GAME_CARD_CLASS_NAME =
  'aq-started-game-card border-emerald-400/80 bg-gradient-to-br from-emerald-100 via-lime-50 to-emerald-100 shadow-[0_14px_34px_rgba(22,163,74,0.16),inset_0_1px_0_rgba(255,255,255,0.68)] hover:border-emerald-500 hover:bg-gradient-to-br hover:from-emerald-100 hover:via-lime-50 hover:to-emerald-100 dark:border-[#17e6ae]/45 dark:bg-[linear-gradient(135deg,rgba(14,92,49,0.44),rgba(4,24,16,0.985))] dark:shadow-[0_18px_42px_rgba(23,230,174,0.18),inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:bg-[linear-gradient(135deg,rgba(16,106,56,0.48),rgba(5,30,19,0.99))]'

const STARTED_GAME_IMAGE_FRAME_CLASS_NAME =
  'border-emerald-300/70 bg-gradient-to-br from-emerald-100 via-lime-50 to-emerald-100 dark:border-[#17e6ae]/30 dark:from-emerald-950/80 dark:via-emerald-950/55 dark:to-slate-950'

const STARTED_GAME_HERO_CLASS_NAME =
  'bg-gradient-to-br from-emerald-100 via-lime-50 to-emerald-100 dark:from-emerald-950/85 dark:via-emerald-950/55 dark:to-slate-950'

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

const STORY_GAME_TYPE_OPTION = { value: 'story', label: 'Сюжетный квест' }
const ALL_GAME_TYPE_OPTIONS = [...GAME_TYPE_OPTIONS, STORY_GAME_TYPE_OPTION]

const getGameTypeOptionsForRole = (role) =>
  role === 'dev' ? ALL_GAME_TYPE_OPTIONS : GAME_TYPE_OPTIONS

const CLUE_EARLY_MODE_OPTIONS = [
  { value: 'time', label: 'Добавить время до следующей подсказки' },
  { value: 'penalty', label: 'Штраф организатора за подсказку' },
]

const GAMES_PAGE_SIZE = 10
const GAMES_FILTER_LOCATION_STORAGE_KEY = 'cabinet_games_location_filter'
const GAMES_DISPLAY_MODE_STORAGE_KEY = 'cabinet_games_display_mode'
const CABINET_GAMES_LIST_API_BASE = '/api/cabinet/games-list'
const CABINET_TEAMS_API_BASE = '/api/cabinet/teams'
const CABINET_SEASONS_API_BASE = '/api/cabinet/seasons'
const CABINET_USER_DETAILS_API_BASE = '/api/cabinet/user-details'
const CABINET_GAMES_API_BASE = '/api/cabinet/games'
const PAST_GAMES_SEASON_FILTER_ALL = 'all'
const PAST_GAMES_SEASON_FILTER_OFFSEASON = 'offseason'
const PAST_GAMES_SEASON_FILTER_NONRATED = 'nonrated'
const GAMES_TYPE_FILTER_ALL = 'all'
const GAME_TYPE_FILTER_OPTIONS = [
  { value: GAMES_TYPE_FILTER_ALL, label: 'Все типы' },
  { value: 'classic', label: 'Автоквест' },
  { value: 'photo', label: 'Фотоквест' },
  { value: 'story', label: 'Сюжет' },
]
const getGenerateResultsButtonLabel = (game, isGenerating = false) => {
  if (isGenerating) return 'Формируем…'
  return Boolean(game?.isResultGenerated)
    ? 'Сформировать результаты заново'
    : 'Сформировать результаты'
}
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

const normalizeGamesViewValue = (value) =>
  value === 'upcoming' || value === 'past' ? value : 'all'

const buildCabinetGamesQueryKey = ({ gamesView, userRole, locationValue }) => [
  'cabinet-games',
  {
    view: normalizeGamesViewValue(gamesView),
    role: userRole || '',
    location: locationValue || '',
  },
]

const fetchCabinetGamesPage = async ({
  pageParam = 0,
  gamesView,
  locationValue,
}) => {
  const params = new URLSearchParams({
    offset: String(pageParam),
    limit: String(GAMES_PAGE_SIZE),
    view: normalizeGamesViewValue(gamesView),
  })
  if (locationValue) {
    params.set('location', locationValue)
  }

  const { json } = await requestApiJson(
    `${CABINET_GAMES_LIST_API_BASE}?${params.toString()}`,
    {
      fallbackMessage: 'Не удалось загрузить список игр',
    },
  )

  return {
    games: Array.isArray(json?.data)
      ? json.data.filter((game) => game !== null && game !== undefined)
      : [],
    hasMore: Boolean(json?.meta?.hasMore),
  }
}

const mapCabinetGamesQueryData = (queryData, mapper) => {
  if (!queryData || !Array.isArray(queryData.pages)) {
    return queryData
  }

  return {
    ...queryData,
    pages: queryData.pages.map((page) => ({
      ...page,
      games: Array.isArray(page?.games) ? page.games.map(mapper) : [],
    })),
  }
}

const buildGameResultsQueryKey = ({ gameId, locationValue }) => [
  'game-results',
  {
    gameId: gameId || '',
    location: locationValue || '',
  },
]

const removeGameResultsQueries = (queryClient, gameId) => {
  const normalizedGameId = String(gameId || '').trim()
  if (!normalizedGameId) {
    return
  }

  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey?.[0] === 'game-results' &&
      query.queryKey?.[1]?.gameId === normalizedGameId,
  })
}

const fetchGameResultsData = async ({
  game,
  locationForApi,
  userParticipationTeamIds,
  viewerCanManageResults,
}) => {
  const params = new URLSearchParams()
  if (locationForApi) {
    params.set('location', locationForApi)
  }

  const { json } = await requestApiJson(
    `${CABINET_GAMES_API_BASE}/${encodeURIComponent(game.id)}/result?${params.toString()}`,
    {
      fallbackMessage: 'Не удалось загрузить результаты игры',
    },
  )

  return {
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
    userParticipationTeamIds,
    viewerCanManageResults,
  }
}

const safeLocalStorageGet = (key, fallback = null) => {
  if (typeof window === 'undefined') return fallback
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

const safeLocalStorageSet = (key, value) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore localStorage write errors on restricted browsers
  }
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

const createFinanceEntry = (patch = {}) => {
  const now = new Date()

  return {
    id: `finance-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'income',
    sum: 0,
    date: now.toISOString(),
    description: '',
    ...(patch && typeof patch === 'object' ? patch : {}),
  }
}

const createClue = (preferredId = null) => ({
  id:
    typeof preferredId === 'string' && preferredId.trim()
      ? preferredId.trim()
      : `clue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  clue: '',
  clueRich: '',
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
  image: '',
})

const createBonusCode = () => ({
  id: `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  code: '',
  bonus: 0,
  description: '',
  image: '',
})

const gameLocationOptions = Object.entries(LOCATIONS)
  .filter(([, value]) => !value?.hidden)
  .map(([key, value]) => ({
    key,
    label: value?.townRu
      ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
      : key.toUpperCase(),
  }))

const resolveLocationLabelByKey = (locationKey) => {
  const normalized =
    typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''
  if (!normalized) {
    return 'выбранного города'
  }
  const townRu = LOCATIONS?.[normalized]?.townRu
  if (!townRu || typeof townRu !== 'string') {
    return normalized
  }
  return townRu
}

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

const toValidTimestamp = (value, fallback) => {
  if (!value) {
    return fallback
  }
  const numeric = new Date(value).getTime()
  return Number.isFinite(numeric) ? numeric : fallback
}

const resolvePastSortTimestamp = (game) =>
  toValidTimestamp(
    game?.dateStartFact || game?.dateStart || game?.dateEndFact,
    Number.NEGATIVE_INFINITY,
  )

const normalizeVisibleStatus = (status, canSeeClosedStatus) => {
  if (isClosedStatus(status) && !canSeeClosedStatus) {
    return 'finished'
  }
  return status
}

const getStatusActionLabel = (status) => {
  const normalizedStatus = String(status || '').toLowerCase()

  if (normalizedStatus === 'active') {
    return 'Статус игры: активна'
  }

  if (normalizedStatus === 'started') {
    return 'Статус игры: в процессе'
  }

  if (normalizedStatus === 'finished') {
    return 'Статус игры: завершена'
  }

  if (normalizedStatus === 'closed') {
    return 'Статус игры: закрыта'
  }

  return 'Сменить статус игры'
}

const createTask = () => ({
  id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  mongoId: null,
  title: '',
  task: '',
  howToSolve: '',
  taskRich: '',
  taskMedia: [],
  taskBonusForComplite: 0,
  clues: [],
  subTasks: [],
  images: [],
  codes: [],
  codePhotos: [],
  coordinates: { latitude: null, longitude: null, radius: null },
  penaltyCodes: [],
  bonusCodes: [],
  numCodesToCompliteTask: null,
  postMessage: '',
  postMessageRich: '',
  postMessageMedia: [],
  canceled: false,
  isBonusTask: false,
  agentUserIds: [],
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

const getEmptyCodePositions = (codes) =>
  (Array.isArray(codes) ? codes : []).reduce((positions, code, index) => {
    if (typeof code !== 'string' || code.trim() === '') {
      positions.push(index + 1)
    }
    return positions
  }, [])

const sanitizeCodePhotosArray = (values = [], codesLength = 0) =>
  sanitizeStringArray(values).slice(0, Math.max(0, Number(codesLength) || 0))

const decodeHtmlEntities = (value) =>
  String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')

const normalizeMediaFieldString = (value) =>
  decodeHtmlEntities(typeof value === 'string' ? value : '').trim()

const stripHtmlToPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const hasMeaningfulRichMarkup = (value) =>
  /<(?!\/?(p|br|div|span)\b)[^>]+>/i.test(String(value || ''))

const isActiveGameStatus = (status) =>
  (typeof status === 'string' ? status.toLowerCase() : String(status)) ===
  'active'

const isGameInProgressStatus = (status) =>
  (typeof status === 'string' ? status.toLowerCase() : String(status)) ===
  'started'

const canBroadcastByGameStatus = (status) => {
  const normalized =
    typeof status === 'string' ? status.toLowerCase() : String(status)
  return normalized !== 'canceled' && normalized !== 'closed'
}

const canJoinGameByStatus = (status) =>
  (typeof status === 'string' ? status.toLowerCase() : String(status)) ===
  'active'

const getUserParticipationTeams = (game) =>
  (Array.isArray(game?.userParticipationTeams)
    ? game.userParticipationTeams
    : []
  )
    .map((entry) => {
      const teamId =
        entry?.teamId === null || entry?.teamId === undefined
          ? ''
          : String(entry.teamId).trim()

      if (!teamId) {
        return null
      }

      return {
        teamId,
        gameTeamId:
          entry?.gameTeamId === null || entry?.gameTeamId === undefined
            ? ''
            : String(entry.gameTeamId).trim(),
        teamName:
          typeof entry?.teamName === 'string' ? entry.teamName.trim() : '',
        isCaptain: Boolean(entry?.isCaptain),
        prequelProgress:
          entry?.prequelProgress && typeof entry.prequelProgress === 'object'
            ? entry.prequelProgress
            : null,
      }
    })
    .filter(Boolean)

const isCurrentUserGameAgent = (game, currentUserId) => {
  const normalizedUserId =
    currentUserId === null || currentUserId === undefined
      ? ''
      : String(currentUserId).trim()
  if (!normalizedUserId) {
    return false
  }

  return (Array.isArray(game?.agents) ? game.agents : []).some((agent) => {
    const agentUserId = String(agent?.userId || agent?.id || agent || '').trim()
    return agentUserId === normalizedUserId && agent?.active !== false
  })
}

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())

const cloneGameDraft = (game) => {
  if (!game || typeof game !== 'object') {
    return null
  }

  return JSON.parse(JSON.stringify(game))
}

const buildUpdatePayload = (game) => {
  const isPhotoGame = game?.type === 'photo'
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
    const normalizedCodes = sanitizeStringArray(task.codes)
    const normalizedCodePhotos = sanitizeCodePhotosArray(
      task.codePhotos,
      normalizedCodes.length,
    )
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
      task:
        typeof task.task === 'string' && task.task.trim() !== ''
          ? task.task
          : stripHtmlToPlainText(task.taskRich),
      howToSolve: typeof task.howToSolve === 'string' ? task.howToSolve : '',
      taskRich: typeof task.taskRich === 'string' ? task.taskRich : '',
      taskMedia: (Array.isArray(task.taskMedia) ? task.taskMedia : [])
        .map((media, index) => ({
          id:
            typeof media?.id === 'string' && media.id.trim() !== ''
              ? media.id.trim()
              : `task-media-${index}`,
          type:
            media?.type === 'audio'
              ? 'audio'
              : media?.type === 'video'
                ? 'video'
                : 'image',
          url: normalizeMediaFieldString(media?.url),
          mime: normalizeMediaFieldString(media?.mime),
          size: Number(media?.size) || 0,
          duration: Number(media?.duration) || 0,
          path: normalizeMediaFieldString(media?.path),
          title: normalizeMediaFieldString(media?.title),
        }))
        .filter((media) => media.url !== ''),
      taskBonusForComplite: isPhotoGame
        ? Number(task.taskBonusForComplite) || 0
        : 0,
      clues: (task.clues ?? []).map((clue) => {
        const clueRich = typeof clue.clueRich === 'string' ? clue.clueRich : ''
        const cluePlain =
          typeof clue.clue === 'string' && clue.clue.trim() !== ''
            ? clue.clue
            : stripHtmlToPlainText(clueRich)

        const normalizedClue = {
          clue: cluePlain,
          clueRich,
          images: sanitizeStringArray(clue.images),
        }

        if (clue.mongoId) {
          normalizedClue._id = clue.mongoId
        }

        return normalizedClue
      }),
      subTasks: isPhotoGame
        ? (task.subTasks ?? []).map((subTask) => {
            const normalizedSubTask = {
              name: typeof subTask.name === 'string' ? subTask.name : '',
              task: typeof subTask.task === 'string' ? subTask.task : '',
              bonus: Number(subTask.bonus) || 0,
            }

            if (subTask.mongoId) {
              normalizedSubTask._id = subTask.mongoId
            }

            return normalizedSubTask
          })
        : [],
      images: sanitizeStringArray(task.images),
      codes: normalizedCodes,
      codePhotos: normalizedCodePhotos,
      coordinates: hasCoordinatesValue
        ? normalizedCoordinates
        : { latitude: null, longitude: null, radius: null },
      penaltyCodes: (task.penaltyCodes ?? []).map((penalty) => {
        const normalizedPenalty = {
          code: typeof penalty.code === 'string' ? penalty.code : '',
          penalty: Number(penalty.penalty) || 0,
          description:
            typeof penalty.description === 'string' ? penalty.description : '',
          image: normalizeMediaFieldString(penalty.image),
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
          image: normalizeMediaFieldString(bonus.image),
        }

        if (bonus.mongoId) {
          normalizedBonus._id = bonus.mongoId
        }

        return normalizedBonus
      }),
      numCodesToCompliteTask: toNullableNumber(task.numCodesToCompliteTask),
      postMessage:
        typeof task.postMessage === 'string' && task.postMessage.trim() !== ''
          ? task.postMessage
          : stripHtmlToPlainText(task.postMessageRich),
      postMessageRich:
        typeof task.postMessageRich === 'string' ? task.postMessageRich : '',
      postMessageMedia: (Array.isArray(task.postMessageMedia)
        ? task.postMessageMedia
        : []
      )
        .map((media, index) => ({
          id:
            typeof media?.id === 'string' && media.id.trim() !== ''
              ? media.id.trim()
              : `task-post-message-media-${index}`,
          type:
            media?.type === 'audio'
              ? 'audio'
              : media?.type === 'video'
                ? 'video'
                : 'image',
          url: normalizeMediaFieldString(media?.url),
          mime: normalizeMediaFieldString(media?.mime),
          size: Number(media?.size) || 0,
          duration: Number(media?.duration) || 0,
          path: normalizeMediaFieldString(media?.path),
          title: normalizeMediaFieldString(media?.title),
        }))
        .filter((media) => media.url !== ''),
      canceled: Boolean(task.canceled),
      isBonusTask: Boolean(task.isBonusTask),
      agentUserIds: sanitizeStringArray(task.agentUserIds),
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

  const agentsSet = new Set()
  ;(Array.isArray(game.agents) ? game.agents : []).forEach((agent) => {
    const userId =
      typeof agent === 'string'
        ? agent.trim()
        : typeof agent?.userId === 'string'
          ? agent.userId.trim()
          : typeof agent?.id === 'string'
            ? agent.id.trim()
            : ''
    if (userId) {
      agentsSet.add(userId)
    }
  })
  const agentIds = Array.from(agentsSet)
  const agentIdsSet = new Set(agentIds)
  const tasksWithAllowedAgents = tasks.map((task) => ({
    ...task,
    agentUserIds: sanitizeStringArray(task.agentUserIds).filter((userId) =>
      agentIdsSet.has(userId),
    ),
  }))

  const normalizedIsRated = Boolean(game.isRated ?? true)
  const normalizedPrequel = normalizePrequelConfig(game?.prequel)
  const taskDistributionMode = normalizeTaskDistributionMode(
    game.taskDistributionMode,
  )

  return {
    name: game.name,
    dateStart: game.dateStart ? new Date(game.dateStart).toISOString() : null,
    type: game.type,
    storyConfig:
      game.storyConfig && typeof game.storyConfig === 'object'
        ? {
            nodeLabel:
              typeof game.storyConfig.nodeLabel === 'string' &&
              game.storyConfig.nodeLabel.trim()
                ? game.storyConfig.nodeLabel.trim()
                : 'Локация',
            startMode:
              game.storyConfig.startMode === 'individual'
                ? 'individual'
                : 'common',
            hideTotalNodes: game.storyConfig.hideTotalNodes !== false,
            hideTotalItems: game.storyConfig.hideTotalItems !== false,
            showInventory: game.storyConfig.showInventory !== false,
            showScoreToTeam: Boolean(game.storyConfig.showScoreToTeam),
            showFinalHistoryToTeam: Boolean(
              game.storyConfig.showFinalHistoryToTeam,
            ),
          }
        : undefined,
    storyItems: Array.isArray(game.storyItems)
      ? JSON.parse(JSON.stringify(game.storyItems))
      : [],
    storyNodes: Array.isArray(game.storyNodes)
      ? JSON.parse(JSON.stringify(game.storyNodes))
      : [],
    storyEdges: Array.isArray(game.storyEdges)
      ? JSON.parse(JSON.stringify(game.storyEdges))
      : [],
    storyEndings: Array.isArray(game.storyEndings)
      ? JSON.parse(JSON.stringify(game.storyEndings))
      : [],
    description:
      typeof game.description === 'string'
        ? game.description
        : stripHtmlToPlainText(game.descriptionRich),
    descriptionRich:
      typeof game.descriptionRich === 'string' ? game.descriptionRich : '',
    descriptionMedia: (Array.isArray(game.descriptionMedia)
      ? game.descriptionMedia
      : []
    )
      .map((media, index) => ({
        id:
          typeof media?.id === 'string' && media.id.trim() !== ''
            ? media.id.trim()
            : `game-description-media-${index}`,
        type:
          media?.type === 'audio'
            ? 'audio'
            : media?.type === 'video'
              ? 'video'
              : 'image',
        url: typeof media?.url === 'string' ? media.url.trim() : '',
        mime: typeof media?.mime === 'string' ? media.mime.trim() : '',
        size: Number(media?.size) || 0,
        duration: Number(media?.duration) || 0,
        path: typeof media?.path === 'string' ? media.path.trim() : '',
        title: typeof media?.title === 'string' ? media.title.trim() : '',
      }))
      .filter((media) => media.url !== ''),
    prequel: {
      ...buildDefaultPrequel(),
      enabled: Boolean(normalizedPrequel.enabled),
      openAt: normalizedPrequel.openAt || null,
      description:
        typeof normalizedPrequel.description === 'string'
          ? normalizedPrequel.description
          : '',
      descriptionRich:
        typeof normalizedPrequel.descriptionRich === 'string'
          ? normalizedPrequel.descriptionRich
          : '',
      descriptionMedia: (Array.isArray(normalizedPrequel.descriptionMedia)
        ? normalizedPrequel.descriptionMedia
        : []
      )
        .map((media, index) => ({
          id:
            typeof media?.id === 'string' && media.id.trim() !== ''
              ? media.id.trim()
              : `prequel-description-media-${index}`,
          type:
            media?.type === 'audio'
              ? 'audio'
              : media?.type === 'video'
                ? 'video'
                : 'image',
          url: typeof media?.url === 'string' ? media.url.trim() : '',
          mime: typeof media?.mime === 'string' ? media.mime.trim() : '',
          size: Number(media?.size) || 0,
          duration: Number(media?.duration) || 0,
          path: typeof media?.path === 'string' ? media.path.trim() : '',
          title: typeof media?.title === 'string' ? media.title.trim() : '',
        }))
        .filter((media) => media.url !== ''),
      mode: normalizedPrequel.mode,
      bonusCodes: (Array.isArray(normalizedPrequel.bonusCodes)
        ? normalizedPrequel.bonusCodes
        : []
      ).map((item) => ({
        ...(item?.mongoId ? { _id: item.mongoId } : {}),
        ...(item?.id ? { id: item.id } : {}),
        code: typeof item?.code === 'string' ? item.code : '',
        value: Number(item?.value) || 0,
        description:
          typeof item?.description === 'string' ? item.description : '',
        image: normalizeMediaFieldString(item?.image),
        storyEffects: (Array.isArray(item?.storyEffects)
          ? item.storyEffects
          : []
        ).map(normalizePrequelStoryEffect),
      })),
      penaltyCodes: (Array.isArray(normalizedPrequel.penaltyCodes)
        ? normalizedPrequel.penaltyCodes
        : []
      ).map((item) => ({
        ...(item?.mongoId ? { _id: item.mongoId } : {}),
        ...(item?.id ? { id: item.id } : {}),
        code: typeof item?.code === 'string' ? item.code : '',
        value: Number(item?.value) || 0,
        description:
          typeof item?.description === 'string' ? item.description : '',
        image: normalizeMediaFieldString(item?.image),
        storyEffects: (Array.isArray(item?.storyEffects)
          ? item.storyEffects
          : []
        ).map(normalizePrequelStoryEffect),
      })),
      wrongAttemptsLimit: toNullableNumber(
        normalizedPrequel.wrongAttemptsLimit,
      ),
      wrongAttemptsPenalty: Number(normalizedPrequel.wrongAttemptsPenalty) || 0,
      wrongAttemptsStoryEffects: (Array.isArray(
        normalizedPrequel.wrongAttemptsStoryEffects,
      )
        ? normalizedPrequel.wrongAttemptsStoryEffects
        : []
      ).map(normalizePrequelStoryEffect),
    },
    image: game.image ? game.image : null,
    startingPlace: game.startingPlace ?? '',
    finishingPlace: game.finishingPlace ?? '',
    showFinishingPlace: Boolean(game.showFinishingPlace),
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
    taskDistributionMode,
    taskDistributionTemplate:
      taskDistributionMode === 'random'
        ? normalizeStoredTaskDistributionTemplate(
            game.taskDistributionTemplate,
            Array.isArray(game.tasks) ? game.tasks.length : 0,
          )
        : [],
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
    showEnterButton: Boolean(game.showEnterButton),
    showTasks: Boolean(game.showTasks),
    hideResult: Boolean(game.hideResult),
    registrationOpen: Boolean(game.registrationOpen ?? true),
    maxTeamPlayers: toNullableNumber(game.maxTeamPlayers),
    prices,
    finances,
    tasks: tasksWithAllowedAgents,
    moderators: Array.from(moderatorsSet),
    agents: agentIds.map((userId) => ({ userId, active: true })),
    agentNotifications: {
      onPreviousTask: Boolean(game.agentNotifications?.onPreviousTask ?? true),
      onCurrentTask: Boolean(game.agentNotifications?.onCurrentTask ?? true),
      onTaskCompleted: Boolean(
        game.agentNotifications?.onTaskCompleted ?? false,
      ),
      onAllTeamsPassed: Boolean(
        game.agentNotifications?.onAllTeamsPassed ?? true,
      ),
    },
    ...(typeof game.creatorUserId === 'string' && game.creatorUserId.trim()
      ? { creatorUserId: game.creatorUserId.trim() }
      : {}),
    ...(!game.creatorUserId && Number.isFinite(Number(game.creatorTelegramId))
      ? { creatorTelegramId: Number(game.creatorTelegramId) }
      : {}),
  }
}

const getTaskDescriptionText = (task) => {
  const taskText = typeof task?.task === 'string' ? task.task.trim() : ''
  if (taskText) {
    return taskText
  }
  return stripHtmlToPlainText(task?.taskRich)
}

const getClueText = (clue) => {
  const clueText = typeof clue?.clue === 'string' ? clue.clue.trim() : ''
  if (clueText) {
    return clueText
  }
  return stripHtmlToPlainText(clue?.clueRich)
}

const validateTaskEditorRequirements = (game) => {
  const issues = []
  const tasks = Array.isArray(game?.tasks) ? game.tasks : []
  const isPhotoGame = String(game?.type || '').toLowerCase() === 'photo'

  tasks.forEach((task, index) => {
    const taskId = typeof task?.id === 'string' ? task.id : null
    const taskLabel = `Задание ${index + 1}`
    const title = typeof task?.title === 'string' ? task.title.trim() : ''
    const description = getTaskDescriptionText(task)
    const hasTaskMedia =
      Array.isArray(task?.taskMedia) &&
      task.taskMedia.some((item) => {
        if (!item || typeof item !== 'object') {
          return false
        }
        const type = typeof item.type === 'string' ? item.type.trim() : ''
        const url = typeof item.url === 'string' ? item.url.trim() : ''
        const path = typeof item.path === 'string' ? item.path.trim() : ''
        return Boolean(type && (url || path))
      })
    const hasTaskDescription =
      description.trim() !== '' ||
      hasMeaningfulRichMarkup(task?.taskRich) ||
      hasTaskMedia
    const clues = Array.isArray(task?.clues) ? task.clues : []
    const hasFilledClue = clues.some(
      (clue) =>
        getClueText(clue).trim() !== '' ||
        hasMeaningfulRichMarkup(clue?.clueRich),
    )

    if (!title) {
      issues.push({
        taskId,
        message: `${taskLabel}: заполните обязательное поле «Название задания».`,
      })
    }

    if (!hasTaskDescription) {
      issues.push({
        taskId,
        message: `${taskLabel}: заполните обязательное поле «Описание задания».`,
      })
    }

    if (clues.length === 0) {
      issues.push({
        taskId,
        message: `${taskLabel}: добавьте хотя бы одну подсказку.`,
      })
    } else if (!hasFilledClue) {
      issues.push({
        taskId,
        message: `${taskLabel}: заполните текст хотя бы в одной подсказке.`,
      })
    }

    if (isPhotoGame) {
      return
    }

    const codes = sanitizeStringArray(task?.codes)
    const emptyCodePositions = getEmptyCodePositions(task?.codes)
    if (codes.length === 0) {
      issues.push({
        taskId,
        message: `${taskLabel}: добавьте хотя бы один основной код.`,
      })
    }

    if (emptyCodePositions.length > 0) {
      issues.push({
        taskId,
        isBlocking: true,
        message: `${taskLabel}: заполните пустые основные коды №${emptyCodePositions.join(', ')}.`,
      })
    }

    const requiredCodesCount = toNullableNumber(task?.numCodesToCompliteTask)
    if (
      requiredCodesCount !== null &&
      Number(requiredCodesCount) > Number(codes.length)
    ) {
      issues.push({
        taskId,
        message: `${taskLabel}: «Кодов для выполнения» (${requiredCodesCount}) не может быть больше количества основных кодов (${codes.length}).`,
      })
    }

    const duplicateCodeConflicts = getTaskDuplicateCodeConflicts(task)
    duplicateCodeConflicts.forEach((conflict) => {
      issues.push({
        taskId,
        isBlocking: true,
        message: `${taskLabel}: код «${conflict.code}» дублируется в ${getDuplicateCodeKindsLabel(conflict.kinds)}.`,
      })
    })
  })

  return issues
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
          src="/logo_title_light.png"
          alt="ActQuest"
          className="aq-logo-float h-auto w-[70%] max-w-[220px] opacity-90 dark:hidden"
          loading="lazy"
        />
        <img
          src="/logo_title.png"
          alt="ActQuest"
          className="aq-logo-float hidden h-auto w-[70%] max-w-[220px] opacity-90 dark:block"
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
  forcedView,
}) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeSession } = useMergedSession(initialSession)
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const userRole = activeSession?.user?.role ?? 'client'
  const currentUserDbId =
    activeSession?.user?.globalUserId ??
    activeSession?.user?.userId ??
    activeSession?.user?._id ??
    activeSession?.user?.id ??
    null
  const currentUserIdString =
    currentUserDbId === null || currentUserDbId === undefined
      ? null
      : String(currentUserDbId)
  const currentUserTelegramId = activeSession?.user?.telegramId ?? null
  const currentUserTelegramIdNumber =
    currentUserTelegramId === null || currentUserTelegramId === undefined
      ? null
      : Number(currentUserTelegramId)
  const canEditAllGames = userRole === 'admin' || userRole === 'dev'
  const canSeeClosedStatus = userRole === 'admin' || userRole === 'dev'
  const availableGameTypeOptions = useMemo(
    () => getGameTypeOptionsForRole(userRole),
    [userRole],
  )
  const canEditOwnGames = Boolean(
    currentUserIdString || currentUserTelegramIdNumber,
  )
  const safeInitialGames = Array.isArray(initialGames) ? initialGames : []
  const [games, setGames] = useState(safeInitialGames)
  const [, setPersistedGames] = useState(safeInitialGames)
  const [hasMoreGames, setHasMoreGames] = useState(Boolean(initialHasMore))
  const [isLoadingMoreGames, setIsLoadingMoreGames] = useState(false)
  const [selectedGameId, setSelectedGameId] = useState(
    safeInitialGames[0]?.id ?? null,
  )
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [statusModalGameId, setStatusModalGameId] = useState('')
  const [statusValidationResult, setStatusValidationResult] = useState(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)
  const [statusProgressMessage, setStatusProgressMessage] = useState('')
  const [editingGame, setEditingGame] = useState(null)
  const [editingBaselineGame, setEditingBaselineGame] = useState(null)
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
  const [startedGameLockedTaskCount, setStartedGameLockedTaskCount] =
    useState(0)
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false)
  const [isTeamsModalReadOnly, setIsTeamsModalReadOnly] = useState(false)
  const [teamsModalState, setTeamsModalState] = useState({
    isLoading: false,
    error: null,
    gameTeams: [],
    availableTeams: [],
  })
  const [selectedTeamToAdd, setSelectedTeamToAdd] = useState('')
  const [removingTeamIds, setRemovingTeamIds] = useState([])
  const [updatingOutOfCompetitionTeamIds, setUpdatingOutOfCompetitionTeamIds] =
    useState([])
  const [updatingPaidGameTeamIds, setUpdatingPaidGameTeamIds] = useState([])
  const [selectedModeratorToAdd, setSelectedModeratorToAdd] = useState('')
  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState('')
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false)
  const [isFinancesModalOpen, setIsFinancesModalOpen] = useState(false)
  const [isGameHistoryModalOpen, setIsGameHistoryModalOpen] = useState(false)
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false)
  const [resultsModalGame, setResultsModalGame] = useState(null)
  const [isTasksViewModalOpen, setIsTasksViewModalOpen] = useState(false)
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
    userParticipationTeamIds: [],
  })
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [registerGameId, setRegisterGameId] = useState('')
  const [isRegisterModalFromCard, setIsRegisterModalFromCard] = useState(false)
  const [registerModalGameName, setRegisterModalGameName] = useState('')
  const [registerTeamId, setRegisterTeamId] = useState('')
  const [registerTeams, setRegisterTeams] = useState([])
  const [isRegisterTeamsLoading, setIsRegisterTeamsLoading] = useState(false)
  const [registerFeedback, setRegisterFeedback] = useState(null)
  const [cancellingRegistrationGameIds, setCancellingRegistrationGameIds] =
    useState([])
  const [isPushBroadcastModalOpen, setIsPushBroadcastModalOpen] =
    useState(false)
  const [pushBroadcastGameId, setPushBroadcastGameId] = useState('')
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
  const [isLocationFilterLoading, setIsLocationFilterLoading] = useState(false)
  const [locationFilterError, setLocationFilterError] = useState(null)
  const [gamesDisplayMode, setGamesDisplayMode] = useState('list')
  const [showCanceledGames, setShowCanceledGames] = useState(false)
  const [pastGamesSeasonFilter, setPastGamesSeasonFilter] = useState(
    PAST_GAMES_SEASON_FILTER_ALL,
  )
  const [gamesTypeFilter, setGamesTypeFilter] = useState(GAMES_TYPE_FILTER_ALL)
  const [openedGamesFilterPanel, setOpenedGamesFilterPanel] = useState(null)
  const rawViewQueryFromRouter = searchParams?.get('view') ?? ''
  const rawViewQuery =
    typeof forcedView === 'string' && forcedView.trim().length > 0
      ? forcedView
      : rawViewQueryFromRouter
  const gamesView = normalizeGamesViewValue(rawViewQuery)
  const isUpcomingView = gamesView === 'upcoming'
  const isPastView = gamesView === 'past'
  const shouldShowLocationFilter =
    canEditAllGames && (isUpcomingView || isPastView)
  const canFilterCanceledGames = canEditAllGames
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

    const savedLocationFromUnifiedKey = safeLocalStorageGet(
      GAMES_FILTER_LOCATION_STORAGE_KEY,
    )
    const legacyStorageKey = `cabinet_games_location_filter_${gamesView}`
    const savedLocationFromLegacyKey = safeLocalStorageGet(legacyStorageKey)
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

    safeLocalStorageSet(GAMES_FILTER_LOCATION_STORAGE_KEY, gamesFilterLocation)
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

    const savedModeFromUnifiedKey = safeLocalStorageGet(
      GAMES_DISPLAY_MODE_STORAGE_KEY,
    )
    const legacyStorageKey = `cabinet_games_display_mode_${gamesView}`
    const savedModeFromLegacyKey = safeLocalStorageGet(legacyStorageKey)
    const savedMode = savedModeFromUnifiedKey || savedModeFromLegacyKey

    if (savedMode === 'list' || savedMode === 'cards') {
      setGamesDisplayMode(savedMode)
    }
  }, [gamesView])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    safeLocalStorageSet(GAMES_DISPLAY_MODE_STORAGE_KEY, gamesDisplayMode)
  }, [gamesDisplayMode])

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  )
  const activeEditGame = editingGame ?? selectedGame
  const registerModalGame = useMemo(
    () => games.find((game) => game.id === registerGameId) ?? null,
    [games, registerGameId],
  )
  const statusModalGame = useMemo(
    () => games.find((game) => game.id === statusModalGameId) ?? null,
    [games, statusModalGameId],
  )
  const pushBroadcastModalGame = useMemo(
    () => games.find((game) => game.id === pushBroadcastGameId) ?? null,
    [games, pushBroadcastGameId],
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
        ...(statusModalGame.taskDistributionMode === 'random'
          ? [
              {
                id: 'distribute_tasks',
                label: 'Распределить задания',
                description:
                  'Создаст индивидуальный маршрут заданий для каждой команды по общему или командному шаблону.',
                variant: 'secondary',
                tone: 'brand',
              },
            ]
          : []),
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
        {
          id: 'delete_game',
          label: 'Удалить игру',
          description: 'Полностью удалит игру. Действие необратимо.',
          variant: 'secondary',
          tone: 'danger',
        },
      ]
    }

    if (normalizedStatus === 'started') {
      return [
        {
          id: 'stop_game',
          label: 'СТОП ИГРА',
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
        {
          id: 'delete_game',
          label: 'Удалить игру',
          description: 'Полностью удалит игру. Действие необратимо.',
          variant: 'secondary',
          tone: 'danger',
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
        {
          id: 'delete_game',
          label: 'Удалить игру',
          description: 'Полностью удалит игру. Действие необратимо.',
          variant: 'secondary',
          tone: 'danger',
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
    if (!isEditModalOpen && !isTasksModalOpen) {
      setEditingGame(null)
      setEditingBaselineGame(null)
    }
    setIsStatusModalOpen(false)
    setIsGameHistoryModalOpen(false)
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
    setUpdatingOutOfCompetitionTeamIds([])
    setSelectedModeratorToAdd('')
  }, [isEditModalOpen, isTasksModalOpen, selectedGameId])

  const sortGamesForCurrentView = useCallback(
    (items) => {
      if (!Array.isArray(items)) {
        return []
      }

      const validItems = items.filter(
        (item) => item !== null && item !== undefined,
      )

      if (gamesView === 'upcoming') {
        return [...validItems].sort((first, second) => {
          const firstTime = toValidTimestamp(
            first?.dateStart,
            Number.POSITIVE_INFINITY,
          )
          const secondTime = toValidTimestamp(
            second?.dateStart,
            Number.POSITIVE_INFINITY,
          )

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
        return [...validItems].sort((first, second) => {
          const firstTime = resolvePastSortTimestamp(first)
          const secondTime = resolvePastSortTimestamp(second)

          if (firstTime !== secondTime) {
            return secondTime - firstTime
          }

          return String(second?.id || '').localeCompare(
            String(first?.id || ''),
            'ru',
          )
        })
      }

      return [...validItems].sort((first, second) => {
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

  const gamesQueryLocation = shouldShowLocationFilter
    ? gamesFilterLocation
    : location
  const isGamesQueryEnabled = shouldShowLocationFilter
    ? Boolean(isGamesFilterLocationHydrated && gamesFilterLocation)
    : true
  const gamesQuery = useInfiniteQuery({
    queryKey: buildCabinetGamesQueryKey({
      gamesView,
      userRole,
      locationValue: gamesQueryLocation,
    }),
    queryFn: ({ pageParam }) =>
      fetchCabinetGamesPage({
        pageParam,
        gamesView,
        userRole,
        locationValue: gamesQueryLocation,
      }),
    enabled: isGamesQueryEnabled,
    initialPageParam: 0,
    initialData:
      isGamesQueryEnabled &&
      safeInitialGames.length > 0 &&
      (!gamesQueryLocation || gamesQueryLocation === initialLocation)
        ? {
            pages: [
              {
                games: safeInitialGames,
                hasMore: Boolean(initialHasMore),
              },
            ],
            pageParams: [0],
          }
        : undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined
      return allPages.reduce(
        (total, page) =>
          total + (Array.isArray(page?.games) ? page.games.length : 0),
        0,
      )
    },
  })

  const applyPersistedGameUpdate = useCallback(
    (gameId, updater) => {
      const applyUpdate = (game) => {
        if (!game || game.id !== gameId) {
          return game
        }

        return typeof updater === 'function' ? updater(game) : updater
      }

      setGames((prev) => prev.map(applyUpdate))
      setPersistedGames((prev) => prev.map(applyUpdate))
      queryClient.setQueriesData({ queryKey: ['cabinet-games'] }, (queryData) =>
        mapCabinetGamesQueryData(queryData, applyUpdate),
      )
    },
    [queryClient],
  )

  const saveGameMutation = useMutation({
    mutationFn: async ({ game, fallbackMessage }) => {
      const { json } = await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(game.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: buildUpdatePayload(game) }),
          fallbackMessage: fallbackMessage || 'Не удалось сохранить игру',
        },
      )

      return normalizeGameForCabinet({
        ...json.data,
        teamsCount: game.teamsCount,
      })
    },
  })

  const isSaving = saveGameMutation.isPending

  const resetRegisterForm = useCallback((nextGameId = '') => {
    setRegisterGameId(nextGameId)
    setRegisterTeamId('')
    setRegisterFeedback(null)
  }, [])

  const registerTeamMutation = useMutation({
    mutationFn: async ({ gameId, teamId }) => {
      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(gameId)}/teams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId }),
          fallbackMessage: 'Не удалось зарегистрироваться на игру',
        },
      )

      return { gameId, teamId }
    },
    onMutate: () => {
      setRegisterFeedback(null)
    },
    onSuccess: ({ gameId, teamId }) => {
      const selectedTeam = registerTeams.find((team) => team.id === teamId)
      const teamName = selectedTeam?.name || 'без названия'

      applyPersistedGameUpdate(gameId, (game) => {
        const nextParticipationTeams = getUserParticipationTeams(game)
        const hasTeamAlready = nextParticipationTeams.some(
          (entry) => entry.teamId === teamId,
        )

        if (!hasTeamAlready) {
          nextParticipationTeams.push({
            teamId,
            teamName:
              typeof selectedTeam?.name === 'string'
                ? selectedTeam.name.trim()
                : '',
            isCaptain: true,
          })
        }

        return {
          ...game,
          teamsCount: (game.teamsCount ?? 0) + (hasTeamAlready ? 0 : 1),
          userParticipationTeams: nextParticipationTeams,
        }
      })

      const message = `Команда «${teamName}» зарегистрирована на игру`
      setRegisterFeedback({ type: 'success', message })
      setFeedback({ type: 'success', message })
      setIsRegisterModalOpen(false)
      setIsRegisterModalFromCard(false)
      setRegisterModalGameName('')
      setRegisterTeams([])
      setIsRegisterTeamsLoading(false)
      resetRegisterForm()
    },
    onError: (error) => {
      console.error('Failed to register team to game', error)
      setRegisterFeedback({
        type: 'error',
        message:
          extractErrorMessage(error) || 'Не удалось зарегистрироваться на игру',
      })
    },
  })

  const cancelRegistrationMutation = useMutation({
    mutationFn: async ({ game, captainParticipations }) => {
      const captainTeamIds = new Set(
        captainParticipations.map((entry) => entry.teamId).filter(Boolean),
      )
      const teamIdsToDelete = Array.from(captainTeamIds)

      if (teamIdsToDelete.length === 0) {
        throw new Error('Не найдены записи регистрации для удаления')
      }

      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(game.id)}/teams`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamIds: teamIdsToDelete }),
          fallbackMessage: 'Не удалось снять команду с игры',
        },
      )

      return {
        gameId: game.id,
        captainTeamIds,
        deletedCount: teamIdsToDelete.length,
      }
    },
    onMutate: ({ game }) => {
      setCancellingRegistrationGameIds((prev) =>
        prev.includes(game.id) ? prev : [...prev, game.id],
      )
    },
    onSuccess: ({ gameId, captainTeamIds, deletedCount }) => {
      applyPersistedGameUpdate(gameId, (gameItem) => {
        const nextParticipationTeams = getUserParticipationTeams(
          gameItem,
        ).filter((entry) => !captainTeamIds.has(entry.teamId))

        return {
          ...gameItem,
          teamsCount: Math.max(
            0,
            (Number(gameItem.teamsCount) || 0) - deletedCount,
          ),
          userParticipationTeams: nextParticipationTeams,
          userTeamPlace:
            nextParticipationTeams.length > 0 ? gameItem.userTeamPlace : null,
        }
      })

      setFeedback({
        type: 'success',
        message: 'Команда снята с игры',
      })
    },
    onError: (error) => {
      console.error('Failed to cancel game registration', error)
      setFeedback({
        type: 'error',
        message:
          extractErrorMessage(error) || 'Не удалось снять команду с игры',
      })
    },
    onSettled: (_data, _error, variables) => {
      const gameId = variables?.game?.id
      if (!gameId) {
        return
      }

      setCancellingRegistrationGameIds((prev) =>
        prev.filter((item) => item !== gameId),
      )
    },
  })

  const isRegisterSubmitting = registerTeamMutation.isPending

  useEffect(() => {
    if (!gamesQuery.data) {
      return
    }

    const nextGames = gamesQuery.data.pages.flatMap((page) =>
      Array.isArray(page?.games) ? page.games : [],
    )
    const sorted = sortGamesForCurrentView(nextGames)
    setGames(sorted)
    setPersistedGames(sorted)
    setHasMoreGames(Boolean(gamesQuery.hasNextPage))
    setSelectedGameId((prev) =>
      prev && sorted.some((game) => game.id === prev)
        ? prev
        : (sorted[0]?.id ?? null),
    )
  }, [gamesQuery.data, gamesQuery.hasNextPage, sortGamesForCurrentView])

  useEffect(() => {
    if (!gamesQuery.error) {
      setLocationFilterError(null)
      return
    }

    setGames([])
    setPersistedGames([])
    setSelectedGameId(null)
    setHasMoreGames(false)
    setLocationFilterError(
      extractErrorMessage(gamesQuery.error) ||
        (shouldShowLocationFilter
          ? 'Не удалось загрузить игры выбранного города.'
          : 'Не удалось загрузить список игр.'),
    )
  }, [gamesQuery.error, shouldShowLocationFilter])

  useEffect(() => {
    setIsLocationFilterLoading(
      Boolean(gamesQuery.isFetching && !gamesQuery.isFetchingNextPage),
    )
  }, [gamesQuery.isFetching, gamesQuery.isFetchingNextPage])

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
        `${CABINET_SEASONS_API_BASE}?${params.toString()}`,
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
        const { json } = await requestApiJson(CABINET_SEASONS_API_BASE, {
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

  const handleLoadMoreGames = useCallback(async () => {
    if (isLoadingMoreGames || !hasMoreGames) {
      return
    }

    setIsLoadingMoreGames(true)
    setFeedback(null)

    try {
      await gamesQuery.fetchNextPage()
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
  }, [gamesQuery, hasMoreGames, isLoadingMoreGames])

  const handleCloseRegisterModal = useCallback(() => {
    if (isRegisterSubmitting) {
      return
    }

    setIsRegisterModalOpen(false)
    setIsRegisterModalFromCard(false)
    setRegisterModalGameName('')
    setRegisterTeams([])
    setIsRegisterTeamsLoading(false)
    resetRegisterForm()
  }, [isRegisterSubmitting, resetRegisterForm])

  const loadRegisterTeams = useCallback(async () => {
    if (!currentUserDbId && !currentUserTelegramIdNumber) {
      setRegisterTeams([])
      setRegisterTeamId('')
      return
    }

    setIsRegisterTeamsLoading(true)

    try {
      const userDetailsParams = new URLSearchParams()
      if (currentUserDbId) {
        userDetailsParams.set('userId', currentUserDbId)
      } else if (Number.isFinite(currentUserTelegramIdNumber)) {
        userDetailsParams.set('telegramId', String(currentUserTelegramIdNumber))
      }

      const { response: userResponse, json: userJson } = await requestApiJson(
        `${CABINET_USER_DETAILS_API_BASE}?${userDetailsParams.toString()}`,
        {
          fallbackMessage: 'Не удалось загрузить список команд',
          throwOnHttpError: false,
        },
      )

      if (!userResponse.ok || userJson?.success === false) {
        if (
          userResponse.status === 404 ||
          userResponse.status === 204 ||
          userJson?.errorCode === 'not_found'
        ) {
          setRegisterTeams([])
          setRegisterTeamId('')
          return
        }

        throw new Error(
          extractErrorMessage(userJson?.error) ||
            'Не удалось загрузить список команд',
        )
      }

      const teamsList = (
        Array.isArray(userJson?.data?.teams) ? userJson.data.teams : []
      )
        .filter((team) => Boolean(team?.isCaptain))
        .map((team) => ({
          ...team,
          id: toStringId(team?.id),
          name: typeof team?.name === 'string' ? team.name : '',
          location:
            typeof team?.location === 'string'
              ? team.location.trim().toLowerCase()
              : '',
        }))
        .filter((team) => typeof team.id === 'string' && team.id.length > 0)

      const registerGameLocation =
        typeof registerModalGame?.location === 'string'
          ? registerModalGame.location.trim().toLowerCase()
          : ''
      const filteredTeamsList = registerGameLocation
        ? teamsList.filter((team) => team.location === registerGameLocation)
        : teamsList

      if (filteredTeamsList.length === 0) {
        setRegisterTeams([])
        setRegisterTeamId('')
        if (registerGameLocation) {
          const cityLabel = resolveLocationLabelByKey(registerGameLocation)
          setRegisterFeedback({
            type: 'error',
            message: `У вас нет команд, где вы капитан, для города «${cityLabel}».`,
          })
        }
        return
      }

      filteredTeamsList.sort((first, second) => {
        const firstName = (first?.name ?? '').toLowerCase()
        const secondName = (second?.name ?? '').toLowerCase()
        return firstName.localeCompare(secondName, 'ru')
      })

      setRegisterTeams(filteredTeamsList)

      if (filteredTeamsList.length === 1) {
        setRegisterTeamId(filteredTeamsList[0].id)
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
  }, [
    currentUserDbId,
    currentUserTelegramIdNumber,
    registerModalGame?.location,
  ])

  useEffect(() => {
    if (isRegisterModalOpen) {
      setRegisterTeamId('')
      setRegisterFeedback(null)
      loadRegisterTeams()
    }
  }, [isRegisterModalOpen, loadRegisterTeams])

  const handleSubmitRegister = useCallback(() => {
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

    registerTeamMutation.mutate({
      gameId: trimmedGameId,
      teamId: registerTeamId,
    })
  }, [
    currentUserDbId,
    registerGameId,
    registerTeamId,
    registerTeams,
    registerTeamMutation,
  ])

  const handleOpenRegisterModal = useCallback(() => {
    resetRegisterForm('')
    setIsRegisterModalFromCard(false)
    setRegisterModalGameName('')
    setIsRegisterModalOpen(true)
  }, [resetRegisterForm])

  const handleOpenRegisterModalForGame = useCallback(
    (game) => {
      if (!game?.id) {
        return
      }

      setSelectedGameId(game.id)
      setIsDescriptionModalOpen(false)
      resetRegisterForm(game.id)
      setIsRegisterModalFromCard(true)
      setRegisterModalGameName(game.name || 'Без названия')
      setIsRegisterModalOpen(true)
    },
    [resetRegisterForm],
  )

  const handleOpenPushBroadcastModal = useCallback((game) => {
    if (!game?.id) {
      return
    }

    setPushBroadcastGameId(game.id)
    setIsPushBroadcastModalOpen(true)
  }, [])

  const handleClosePushBroadcastModal = useCallback(() => {
    setIsPushBroadcastModalOpen(false)
    setPushBroadcastGameId('')
    void queryClient.invalidateQueries({ queryKey: ['cabinet-games'] })
  }, [queryClient])

  const isRegistrationCancellationInProgress = useCallback(
    (gameId) =>
      typeof gameId === 'string' &&
      cancellingRegistrationGameIds.includes(gameId),
    [cancellingRegistrationGameIds],
  )

  const handleCancelRegistrationFromGame = useCallback(
    async (game) => {
      if (!game?.id) {
        return
      }

      const captainParticipations = getUserParticipationTeams(game).filter(
        (entry) => entry.isCaptain,
      )

      if (captainParticipations.length === 0) {
        setFeedback({
          type: 'error',
          message:
            'Отмена регистрации доступна только капитану зарегистрированной команды.',
        })
        return
      }

      if (isRegistrationCancellationInProgress(game.id)) {
        return
      }

      const teamsLabel = captainParticipations
        .map((entry) => `«${entry.teamName || entry.teamId}»`)
        .join(', ')
      const confirmMessage =
        captainParticipations.length > 1
          ? `Снять команды ${teamsLabel} с игры «${game.name || 'Без названия'}»?`
          : `Снять команду ${teamsLabel} с игры «${game.name || 'Без названия'}»?`

      if (typeof window !== 'undefined') {
        const isConfirmed = window.confirm(confirmMessage)
        if (!isConfirmed) {
          return
        }
      }

      cancelRegistrationMutation.mutate({ game, captainParticipations })
    },
    [
      cancelRegistrationMutation,
      isRegistrationCancellationInProgress,
      setFeedback,
    ],
  )

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
      .map((item) => {
        const { sortDate: _sortDate, ...rest } = item
        return rest
      })
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
          const { json } = await requestApiJson(
            `${CABINET_GAMES_LIST_API_BASE}?${params.toString()}`,
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

  const createGameMutation = useMutation({
    mutationFn: async ({
      trimmedName,
      isCloneMode,
      normalizedCreateLocation,
    }) => {
      const baseDraft = {
        name: trimmedName,
        status: 'active',
        dateStart: null,
        type: 'classic',
        storyConfig: {
          nodeLabel: 'Локация',
          startMode: 'common',
          hideTotalNodes: true,
          hideTotalItems: true,
          showInventory: true,
          showScoreToTeam: false,
          showFinalHistoryToTeam: false,
        },
        storyItems: [],
        storyNodes: [],
        storyEdges: [],
        storyEndings: [],
        description: '',
        descriptionRich: '',
        descriptionMedia: [],
        prequel: buildDefaultPrequel(),
        image: null,
        startingPlace: '',
        finishingPlace: '',
        showFinishingPlace: false,
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
        isRated: false,
        seasonId: '',
        seasonName: '',
        hidden: true,
        showCreator: true,
        showTasks: false,
        hideResult: false,
        registrationOpen: true,
        maxTeamPlayers: null,
        prices: [],
        finances: [],
        tasks: [],
        taskDistributionMode: 'linear',
        taskDistributionTemplate: [],
        moderators: [],
        agents: [],
        agentNotifications: {
          onPreviousTask: true,
          onCurrentTask: true,
          onTaskCompleted: false,
          onAllTeamsPassed: true,
        },
      }

      if (isCloneMode) {
        const gameDetailsParams = new URLSearchParams({
          gameId: cloneSourceGameId,
          location: 'all',
        })

        const { json: sourceJson } = await requestApiJson(
          `/api/cabinet/game-details?${gameDetailsParams.toString()}`,
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
          baseDraft.descriptionRich = normalizedSource.descriptionRich || ''
          baseDraft.descriptionMedia = Array.isArray(
            normalizedSource.descriptionMedia,
          )
            ? normalizedSource.descriptionMedia
            : []
          baseDraft.prequel = normalizePrequelConfig(normalizedSource.prequel)
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
          baseDraft.maxTeamPlayers = toNullableNumber(
            normalizedSource.maxTeamPlayers,
          )
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
          baseDraft.storyConfig =
            normalizedSource.storyConfig &&
            typeof normalizedSource.storyConfig === 'object'
              ? JSON.parse(JSON.stringify(normalizedSource.storyConfig))
              : baseDraft.storyConfig
          baseDraft.storyItems = Array.isArray(normalizedSource.storyItems)
            ? JSON.parse(JSON.stringify(normalizedSource.storyItems))
            : []
          baseDraft.storyNodes = Array.isArray(normalizedSource.storyNodes)
            ? JSON.parse(JSON.stringify(normalizedSource.storyNodes))
            : []
          baseDraft.storyEdges = Array.isArray(normalizedSource.storyEdges)
            ? JSON.parse(JSON.stringify(normalizedSource.storyEdges))
            : []
          baseDraft.storyEndings = Array.isArray(normalizedSource.storyEndings)
            ? JSON.parse(JSON.stringify(normalizedSource.storyEndings))
            : []
          baseDraft.taskDistributionMode = normalizeTaskDistributionMode(
            normalizedSource.taskDistributionMode,
          )
          baseDraft.taskDistributionTemplate =
            baseDraft.taskDistributionMode === 'random'
              ? normalizeStoredTaskDistributionTemplate(
                  normalizedSource.taskDistributionTemplate,
                  Array.isArray(normalizedSource.tasks)
                    ? normalizedSource.tasks.length
                    : 0,
                )
              : []
        }

        if (createGameCloneOptions.locations) {
          baseDraft.startingPlace = normalizedSource.startingPlace || ''
          baseDraft.finishingPlace = normalizedSource.finishingPlace || ''
          baseDraft.showFinishingPlace = Boolean(
            normalizedSource.showFinishingPlace,
          )
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
          baseDraft.registrationOpen = Boolean(
            normalizedSource.registrationOpen ?? true,
          )
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
      // Новая игра всегда создается скрытой, даже при клонировании.
      baseDraft.hidden = true
      baseDraft.seasonId = Boolean(baseDraft.isRated)
        ? selectedSeason?.id || ''
        : ''
      baseDraft.seasonName = Boolean(baseDraft.isRated)
        ? selectedSeason?.name || ''
        : ''

      const payload = {
        ...buildUpdatePayload({
          ...baseDraft,
          name: trimmedName,
        }),
        location: normalizedCreateLocation,
        ...(currentUserDbId ? { creatorUserId: currentUserDbId } : {}),
      }

      const { json } = await requestApiJson(CABINET_GAMES_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
        fallbackMessage: 'Не удалось создать игру',
      })

      const createdGame = normalizeGameForCabinet({
        ...json.data,
        teamsCount: 0,
      })

      if (!createdGame) {
        throw new Error('Не удалось обработать данные созданной игры')
      }

      return createdGame
    },
    onMutate: () => {
      setCreateGameFeedback(null)
    },
    onSuccess: (createdGame) => {
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
      queryClient.invalidateQueries({ queryKey: ['cabinet-games'] })
      setSelectedGameId(createdGame.id)

      setFeedback({
        type: 'success',
        message: `Игра «${createdGame.name || 'Без названия'}» создана`,
      })

      setIsCreateGameModalOpen(false)
      setCreateGameMode(CREATE_GAME_MODE_EMPTY)
      setCloneSourceGameId('')
      setCreateGameCloneOptions(DEFAULT_CREATE_GAME_CLONE_OPTIONS)
      const createdDraft = cloneGameDraft(createdGame)
      setEditingGame(createdDraft)
      setEditingBaselineGame(cloneGameDraft(createdDraft))
      setIsEditModalOpen(true)
    },
    onError: (error) => {
      console.error('Failed to create game', error)
      setCreateGameFeedback({
        type: 'error',
        message: extractErrorMessage(error) || 'Не удалось создать игру',
      })
    },
  })

  const isCreatingGame = createGameMutation.isPending

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

    createGameMutation.mutate({
      trimmedName,
      isCloneMode,
      normalizedCreateLocation,
    })
  }, [
    canEditAllGames,
    cloneSourceGameId,
    createGameCloneOptions,
    createGameLocation,
    createGameMode,
    createGameMutation,
    newGameName,
  ])

  const moderatorsQuery = useQuery({
    queryKey: ['cabinet-moderator-users'],
    enabled: canEditAllGames && (isEditModalOpen || isTasksModalOpen),
    staleTime: 60_000,
    queryFn: async () => {
      const { json } = await requestApiJson(
        '/api/cabinet/admin/users-list?canBeGameModerator=1&limit=200&sortBy=registration_desc',
        { fallbackMessage: 'Не удалось загрузить список модераторов' },
      )
      return Array.isArray(json?.data) ? json.data : []
    },
  })

  const availableModerators = useMemo(() => {
    const users = Array.isArray(moderatorsQuery.data)
      ? moderatorsQuery.data
      : Array.isArray(initialAvailableModerators)
        ? initialAvailableModerators
        : []

    return users
      .map((user) => ({
        id: String(user?.id || user?._id || '').trim(),
        telegramId: String(user?.telegramId || '').trim(),
        name: typeof user?.name === 'string' ? user.name : '',
        username: typeof user?.username === 'string' ? user.username : '',
        role: typeof user?.role === 'string' ? user.role : 'client',
      }))
      .filter((user) => user.id)
  }, [initialAvailableModerators, moderatorsQuery.data])

  const availableModeratorsMap = useMemo(
    () =>
      new Map(
        availableModerators.map((moderator) => [moderator.id, moderator]),
      ),
    [availableModerators],
  )

  const agentsQuery = useQuery({
    queryKey: ['cabinet-agent-users'],
    enabled: canEditAllGames && (isEditModalOpen || isTasksModalOpen),
    staleTime: 60_000,
    queryFn: async () => {
      const { json } = await requestApiJson(
        '/api/cabinet/admin/users-list?canBeGameAgent=1&limit=200&sortBy=registration_desc',
        { fallbackMessage: 'Не удалось загрузить список агентов' },
      )
      return Array.isArray(json?.data) ? json.data : []
    },
  })

  const availableAgents = useMemo(() => {
    const users = Array.isArray(agentsQuery.data) ? agentsQuery.data : []
    return users
      .map((user) => ({
        id: String(user?.id || user?._id || '').trim(),
        userId: String(user?.id || user?._id || '').trim(),
        telegramId: String(user?.telegramId || '').trim(),
        name: typeof user?.name === 'string' ? user.name : '',
        username: typeof user?.username === 'string' ? user.username : '',
      }))
      .filter((user) => user.id)
  }, [agentsQuery.data])

  const availableAgentsMap = useMemo(
    () => new Map(availableAgents.map((agent) => [agent.id, agent])),
    [availableAgents],
  )

  const organizersQuery = useQuery({
    queryKey: ['cabinet-organizer-users'],
    enabled: canEditAllGames && (isEditModalOpen || isTasksModalOpen),
    staleTime: 60_000,
    queryFn: async () => {
      const { json } = await requestApiJson(
        '/api/cabinet/admin/users-list?limit=200&sortBy=registration_desc',
        { fallbackMessage: 'Не удалось загрузить список организаторов' },
      )
      return Array.isArray(json?.data) ? json.data : []
    },
  })

  const modalGame =
    (isEditModalOpen || isTasksModalOpen) && editingGame
      ? editingGame
      : selectedGame

  const selectedGameAgents = useMemo(() => {
    if (!modalGame) {
      return []
    }

    return (Array.isArray(modalGame.agents) ? modalGame.agents : [])
      .map((agent) => {
        const userId = String(agent?.userId || agent?.id || agent || '').trim()
        if (!userId) {
          return null
        }
        const fallback = availableAgentsMap.get(userId)
        return {
          id: userId,
          userId,
          active: agent?.active !== false,
          name: agent?.name || fallback?.name || '',
          username: agent?.username || fallback?.username || '',
          telegramId: agent?.telegramId || fallback?.telegramId || '',
        }
      })
      .filter(Boolean)
  }, [availableAgentsMap, modalGame])

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

  const filterGamesBySeason = useCallback(
    (sourceGames) =>
      sourceGames.filter((game) => {
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
    [pastGamesSeasonFilter],
  )

  const filterGamesByType = useCallback(
    (sourceGames) =>
      sourceGames.filter((game) => {
        if (gamesTypeFilter === GAMES_TYPE_FILTER_ALL) {
          return true
        }
        return (
          String(game?.type || 'classic')
            .trim()
            .toLowerCase() === gamesTypeFilter
        )
      }),
    [gamesTypeFilter],
  )

  const applyGamesFilters = useCallback(
    (sourceGames) => filterGamesByType(filterGamesBySeason(sourceGames)),
    [filterGamesBySeason, filterGamesByType],
  )

  const filteredUpcomingGames = useMemo(
    () => applyGamesFilters(upcomingGames),
    [applyGamesFilters, upcomingGames],
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
          return canFilterCanceledGames && showCanceledGames
        }
        return false
      }),
    [canFilterCanceledGames, games, showCanceledGames],
  )

  const pastGames = useMemo(
    () => applyGamesFilters(pastGamesBase),
    [applyGamesFilters, pastGamesBase],
  )

  const pastGamesSeasonOptions = useMemo(() => {
    const seasonsMap = new Map()

    const seasonSourceGames = isUpcomingView ? upcomingGames : pastGamesBase

    seasonSourceGames.forEach((game) => {
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
  }, [isUpcomingView, pastGamesBase, upcomingGames])
  const selectedGamesLocationOption = useMemo(
    () =>
      gameLocationOptions.find((item) => item.key === gamesFilterLocation) ??
      null,
    [gamesFilterLocation],
  )
  const selectedPastGamesSeasonOption = useMemo(
    () =>
      pastGamesSeasonOptions.find(
        (option) => option.value === pastGamesSeasonFilter,
      ) ?? null,
    [pastGamesSeasonFilter, pastGamesSeasonOptions],
  )
  const selectedGamesTypeOption = useMemo(
    () =>
      GAME_TYPE_FILTER_OPTIONS.find(
        (option) => option.value === gamesTypeFilter,
      ) ?? GAME_TYPE_FILTER_OPTIONS[0],
    [gamesTypeFilter],
  )
  const gamesCityFilterLabel =
    selectedGamesLocationOption?.label?.trim() || 'Город'
  const gamesSeasonFilterLabel =
    selectedPastGamesSeasonOption?.label?.trim() || 'Сезон'
  const gamesTypeFilterLabel =
    selectedGamesTypeOption?.label?.trim() || 'Тип игры'
  const isCityFilterPanelOpen = openedGamesFilterPanel === 'city'
  const isSeasonFilterPanelOpen = openedGamesFilterPanel === 'season'
  const isTypeFilterPanelOpen = openedGamesFilterPanel === 'type'

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
    if (!editingGame || !editingBaselineGame) {
      return false
    }
    return !areGameDraftsEqual(editingGame, editingBaselineGame)
  }, [editingBaselineGame, editingGame])

  const canEditSelectedGame = useMemo(() => {
    const gameForPermissions =
      isEditModalOpen && editingGame ? editingGame : selectedGame

    if (!gameForPermissions) {
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

      const creatorId = String(gameForPermissions.creatorUserId || '')
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
  const canViewCodePhotos = canEditSelectedGame

  const canViewRestrictedGameInfo = canEditSelectedGame

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

        const creatorId = game?.creatorUserId
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

  useEffect(() => {
    const requestedGameId = searchParams?.get('gameId')
    const requestedOpen = String(searchParams?.get('open') || '')
      .trim()
      .toLowerCase()

    if (!requestedGameId || typeof requestedGameId !== 'string') {
      return
    }

    const targetGame = games.find((game) => game?.id === requestedGameId)
    if (!targetGame) {
      return
    }

    if (requestedOpen === 'tasks' && canManageGame(targetGame)) {
      setSelectedGameId(targetGame.id)
      const draft = cloneGameDraft(targetGame)
      setEditingGame(draft)
      setEditingBaselineGame(cloneGameDraft(draft))
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(true)
      setIsTeamsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsResultsModalOpen(false)
    } else {
      setSelectedGameId(targetGame.id)
      setIsDescriptionModalOpen(true)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(false)
      setIsTeamsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsResultsModalOpen(false)
    }

    const nextQuery = new URLSearchParams(searchParams?.toString() || '')
    nextQuery.delete('gameId')
    nextQuery.delete('open')
    const nextUrl = nextQuery.toString()
      ? `${pathname}?${nextQuery.toString()}`
      : pathname
    router.replace(nextUrl, { scroll: false })
  }, [canManageGame, games, pathname, router, searchParams])

  const canOpenGameEditModal = useCallback(
    (game) => {
      if (!game) {
        return false
      }

      return canManageGameStatus(game)
    },
    [canManageGameStatus],
  )

  const updateSelectedGame = useCallback(
    (updater) => {
      if (!canEditSelectedGame || !editingGame) {
        return
      }

      setEditingGame((prevGame) => {
        if (!prevGame) {
          return prevGame
        }

        const patch =
          typeof updater === 'function' ? updater(prevGame) : updater
        const result = applyGameDraftPatch({
          prevGame,
          baselineGame: editingBaselineGame,
          patch,
        })
        return result.nextGame
      })
    },
    [canEditSelectedGame, editingBaselineGame, editingGame],
  )
  const isEditingPhotoGame = useMemo(() => {
    const type =
      typeof (editingGame?.type ?? selectedGame?.type) === 'string'
        ? String(editingGame?.type ?? selectedGame?.type)
            .trim()
            .toLowerCase()
        : ''
    return type === 'photo'
  }, [editingGame?.type, selectedGame?.type])

  const startedGameTaskOrderLockGameId = useMemo(() => {
    if (!activeEditGame) {
      return ''
    }
    if (
      String(activeEditGame.status || '')
        .trim()
        .toLowerCase() !== 'started'
    ) {
      return ''
    }

    const mongoId =
      typeof activeEditGame.mongoId === 'string' ? activeEditGame.mongoId : ''
    if (isObjectIdLike(mongoId)) {
      return mongoId
    }

    const gameId =
      typeof activeEditGame.id === 'string' ? activeEditGame.id : ''
    if (isObjectIdLike(gameId)) {
      return gameId
    }

    return ''
  }, [activeEditGame])

  useEffect(() => {
    if (!isEditModalOpen && !isTasksModalOpen) {
      setStartedGameLockedTaskCount(0)
      return
    }
    if (!startedGameTaskOrderLockGameId) {
      setStartedGameLockedTaskCount(0)
      return
    }

    let isCancelled = false

    const resolveLockedCountFromStatus = (statusData) => {
      const tasksCount =
        Number.isInteger(statusData?.tasksCount) && statusData.tasksCount > 0
          ? statusData.tasksCount
          : 0
      if (tasksCount <= 0) {
        return 0
      }

      const teams = Array.isArray(statusData?.teams) ? statusData.teams : []
      let maxLockedCount = 0

      teams.forEach((team) => {
        const rawActiveTaskIndex = Number(team?.activeTaskIndex)
        const activeTaskIndex = Number.isFinite(rawActiveTaskIndex)
          ? Math.max(0, Math.floor(rawActiveTaskIndex))
          : 0

        const completedCount = team?.isTeamFinished
          ? tasksCount
          : team?.isTeamOnBreak || team?.isActiveTaskFailed
            ? Math.min(tasksCount, activeTaskIndex + 1)
            : Math.min(tasksCount, activeTaskIndex)

        if (completedCount > maxLockedCount) {
          maxLockedCount = completedCount
        }
      })

      return maxLockedCount
    }

    ;(async () => {
      try {
        const { json } = await requestApiJson(
          `/api/cabinet/admin/game-status?gameId=${encodeURIComponent(
            startedGameTaskOrderLockGameId,
          )}`,
          { fallbackMessage: 'Не удалось получить прогресс команд' },
        )

        if (isCancelled) {
          return
        }

        const nextLockedCount = resolveLockedCountFromStatus(json?.data)
        setStartedGameLockedTaskCount(nextLockedCount)
      } catch {
        if (!isCancelled) {
          setStartedGameLockedTaskCount(0)
        }
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [isEditModalOpen, isTasksModalOpen, startedGameTaskOrderLockGameId])

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
    if (!editingBaselineGame) return

    setEditingGame(cloneGameDraft(editingBaselineGame))
    setFeedback(null)
  }, [editingBaselineGame])

  const handleSaveChanges = useCallback(async () => {
    const gameToSave = editingGame ?? selectedGame
    if (!gameToSave || !canEditSelectedGame) return

    const isGameStarted =
      String(gameToSave?.status || '')
        .trim()
        .toLowerCase() === 'started'
    if (isGameStarted) {
      const isConfirmed = window.confirm(
        'Игра уже запущена. Сохранение изменений может повлиять на прохождение. Продолжить?',
      )
      if (!isConfirmed) {
        return
      }
    }

    let validationWarningMessage = ''
    const validationIssues = validateTaskEditorRequirements(gameToSave)
    if (validationIssues.length > 0) {
      const issueTaskIds = validationIssues
        .map((issue) => issue.taskId)
        .filter(Boolean)
      if (issueTaskIds.length > 0) {
        setExpandedTaskIds((prev) =>
          Array.from(
            new Set([...(Array.isArray(prev) ? prev : []), ...issueTaskIds]),
          ),
        )
      }

      const firstIssue = validationIssues[0]?.message || 'Проверьте задания.'
      const totalIssues = validationIssues.length
      const feedbackMessage =
        totalIssues > 1
          ? `${firstIssue} Дополнительно ошибок: ${totalIssues - 1}.`
          : firstIssue

      validationWarningMessage = feedbackMessage
    }

    const blockingIssues = validationIssues.filter(
      (issue) => issue?.isBlocking === true,
    )
    if (blockingIssues.length > 0) {
      const firstBlockingMessage =
        blockingIssues[0]?.message || 'Проверьте уникальность кодов в заданиях.'
      const blockingMessage =
        blockingIssues.length > 1
          ? `${firstBlockingMessage} Дополнительно ошибок: ${blockingIssues.length - 1}.`
          : firstBlockingMessage

      setFeedback({ type: 'error', message: blockingMessage })
      return
    }

    if (normalizeTaskDistributionMode(gameToSave.taskDistributionMode) === 'random') {
      const tasksCount = Array.isArray(gameToSave.tasks)
        ? gameToSave.tasks.length
        : 0
      const distributionTemplate = normalizeStoredTaskDistributionTemplate(
        gameToSave.taskDistributionTemplate,
        tasksCount,
      )
      const distributionValidation = validateTaskDistributionTemplate(
        distributionTemplate,
        tasksCount,
      )

      if (!distributionValidation.valid) {
        setFeedback({
          type: 'error',
          message:
            distributionValidation.messages[0] ||
            'Проверьте шаблон распределения заданий.',
        })
        return
      }
    }

    setFeedback(null)

    try {
      const normalizedGame = await saveGameMutation.mutateAsync({
        game: gameToSave,
        fallbackMessage: 'Не удалось сохранить игру',
      })

      applyPersistedGameUpdate(normalizedGame.id, normalizedGame)
      if (validationWarningMessage) {
        setToastEvent({
          id: `game-save-validation-warning-${Date.now()}`,
          type: 'warning',
          message: `Сохранено с предупреждением: ${validationWarningMessage}`,
        })
      } else {
        setFeedback({ type: 'success', message: 'Изменения сохранены' })
      }
      setEditingGame(null)
      setEditingBaselineGame(null)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(false)
      setIsFinancesModalOpen(false)
    } catch (error) {
      console.error('Failed to update game', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить игру',
      })
    }
  }, [
    applyPersistedGameUpdate,
    canEditSelectedGame,
    editingGame,
    saveGameMutation,
    selectedGame,
  ])

  const handleSaveAndOpenTaskPreview = useCallback(
    async (taskIndex) => {
      const normalizedTaskIndex = Number.isFinite(Number(taskIndex))
        ? Math.max(0, Math.trunc(Number(taskIndex)))
        : 0
      const gameToPreview = editingGame ?? selectedGame

      if (!gameToPreview) {
        return
      }

      let gameForPreview = gameToPreview

      if (canEditSelectedGame && isDirty) {
        const validationIssues = validateTaskEditorRequirements(gameToPreview)
        const blockingIssues = validationIssues.filter(
          (issue) => issue?.isBlocking === true,
        )
        if (blockingIssues.length > 0) {
          const issueTaskIds = blockingIssues
            .map((issue) => issue.taskId)
            .filter(Boolean)
          if (issueTaskIds.length > 0) {
            setExpandedTaskIds((prev) =>
              Array.from(
                new Set([
                  ...(Array.isArray(prev) ? prev : []),
                  ...issueTaskIds,
                ]),
              ),
            )
          }

          const firstBlockingMessage =
            blockingIssues[0]?.message ||
            'Проверьте уникальность кодов в заданиях.'
          const blockingMessage =
            blockingIssues.length > 1
              ? `${firstBlockingMessage} Дополнительно ошибок: ${blockingIssues.length - 1}.`
              : firstBlockingMessage

          setFeedback({ type: 'error', message: blockingMessage })
          return
        }

        const isStartedGame =
          String(gameToPreview?.status || '')
            .trim()
            .toLowerCase() === 'started'
        if (isStartedGame) {
          const isConfirmed = window.confirm(
            'Игра уже запущена. Сохранение изменений может повлиять на прохождение. Продолжить?',
          )
          if (!isConfirmed) {
            return
          }
        }
        setFeedback(null)

        try {
          const normalizedGame = await saveGameMutation.mutateAsync({
            game: gameToPreview,
            fallbackMessage:
              'Не удалось сохранить задания перед предпросмотром',
          })

          applyPersistedGameUpdate(normalizedGame.id, normalizedGame)
          setEditingGame(cloneGameDraft(normalizedGame))
          setEditingBaselineGame(cloneGameDraft(normalizedGame))
          setFeedback({ type: 'success', message: 'Задания сохранены' })

          gameForPreview = normalizedGame
        } catch (error) {
          console.error('Failed to save game before task preview', error)
          setFeedback({
            type: 'error',
            message:
              error?.message ||
              'Не удалось сохранить задания перед предпросмотром',
          })
          return
        }
      }

      const previewGameId =
        typeof gameForPreview?.mongoId === 'string' &&
        isObjectIdLike(gameForPreview.mongoId)
          ? gameForPreview.mongoId
          : typeof gameForPreview?.id === 'string' &&
              isObjectIdLike(gameForPreview.id)
            ? gameForPreview.id
            : ''

      if (previewGameId) {
        router.push(
          `/cabinet/admin/task-preview?gameId=${encodeURIComponent(previewGameId)}&taskIndex=${encodeURIComponent(String(normalizedTaskIndex))}`,
        )
        return
      }

      if (typeof window === 'undefined') {
        return
      }

      const draftKey = `aq-task-preview-draft-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`
      const draftPayload = {
        game: {
          id: typeof gameForPreview?.id === 'string' ? gameForPreview.id : '',
          name:
            typeof gameForPreview?.name === 'string' ? gameForPreview.name : '',
          type: gameForPreview?.type === 'photo' ? 'photo' : 'classic',
          location:
            typeof gameForPreview?.location === 'string'
              ? gameForPreview.location
              : '',
          status:
            typeof gameForPreview?.status === 'string'
              ? gameForPreview.status
              : '',
          taskDuration: Number(gameForPreview?.taskDuration) || 3600,
          cluesDuration: Number(gameForPreview?.cluesDuration) || 1200,
          breakDuration: Number(gameForPreview?.breakDuration) || 0,
        },
        tasks: Array.isArray(gameForPreview?.tasks) ? gameForPreview.tasks : [],
      }

      safeLocalStorageSet(draftKey, JSON.stringify(draftPayload))
      router.push(
        `/cabinet/admin/task-preview?draftKey=${encodeURIComponent(draftKey)}&taskIndex=${encodeURIComponent(String(normalizedTaskIndex))}`,
      )
    },
    [
      canEditSelectedGame,
      editingGame,
      isDirty,
      applyPersistedGameUpdate,
      router,
      saveGameMutation,
      selectedGame,
      setFeedback,
      setEditingGame,
      setEditingBaselineGame,
    ],
  )

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

  const handleAddFinance = useCallback(
    (financePatch = {}) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        finances: [...(game.finances ?? []), createFinanceEntry(financePatch)],
      }))
    },
    [canEditSelectedGame, updateSelectedGame],
  )

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

  const handleReorderTask = useCallback(
    (fromIndex, toIndex) => {
      if (!canEditSelectedGame) {
        return
      }

      const from = Number(fromIndex)
      const to = Number(toIndex)
      if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) {
        return
      }

      const gameForUpdate = editingGame ?? selectedGame
      const tasksCount = Array.isArray(gameForUpdate?.tasks)
        ? gameForUpdate.tasks.length
        : 0
      if (tasksCount <= 1) {
        return
      }
      if (from < 0 || from >= tasksCount || to < 0 || to >= tasksCount) {
        return
      }

      const isStartedGame =
        String(gameForUpdate?.status || '')
          .trim()
          .toLowerCase() === 'started'
      if (isStartedGame) {
        const lockedCount = Math.max(0, Number(startedGameLockedTaskCount) || 0)
        if (from < lockedCount || to < lockedCount) {
          setFeedback({
            type: 'error',
            message:
              lockedCount === 1
                ? 'Первое задание уже пройдено и не может менять порядок.'
                : `Первые ${lockedCount} заданий уже пройдены и не могут менять порядок.`,
          })
          return
        }
      }

      updateSelectedGame((game) => {
        const tasks = Array.isArray(game?.tasks) ? [...game.tasks] : []
        if (
          tasks.length <= 1 ||
          from < 0 ||
          from >= tasks.length ||
          to < 0 ||
          to >= tasks.length
        ) {
          return { tasks }
        }
        const [movedTask] = tasks.splice(from, 1)
        if (!movedTask) {
          return { tasks }
        }
        tasks.splice(to, 0, movedTask)
        return { tasks }
      })
    },
    [
      canEditSelectedGame,
      editingGame,
      selectedGame,
      setFeedback,
      startedGameLockedTaskCount,
      updateSelectedGame,
    ],
  )

  const isTaskReorderLocked = useCallback(
    (taskIndex) => {
      const gameForEdit = editingGame ?? selectedGame
      const isStartedGame =
        String(gameForEdit?.status || '')
          .trim()
          .toLowerCase() === 'started'
      if (!isStartedGame) {
        return false
      }
      const index = Number(taskIndex)
      if (!Number.isInteger(index) || index < 0) {
        return false
      }
      return index < (Number(startedGameLockedTaskCount) || 0)
    },
    [editingGame, selectedGame, startedGameLockedTaskCount],
  )

  const handleTaskFieldChange = useCallback(
    (taskId, field, value) => {
      updateTask(taskId, { [field]: value })
    },
    [updateTask],
  )

  const handleTaskNumberChange = useCallback(
    (taskId, field, value) => {
      if (field === 'taskBonusForComplite' && !isEditingPhotoGame) {
        return
      }
      const numeric = Number(value)
      updateTask(taskId, { [field]: Number.isFinite(numeric) ? numeric : 0 })
    },
    [isEditingPhotoGame, updateTask],
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
      updateTask(taskId, (task) => ({
        codes: [...(task.codes ?? []), ''],
        codePhotos: [...(task.codePhotos ?? []), ''],
      }))
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

  const handleTaskCodePhotoChange = useCallback(
    (taskId, index, value) => {
      updateTask(taskId, (task) => {
        const nextPhotos = [...(task.codePhotos ?? [])]
        nextPhotos[index] = value
        return { codePhotos: nextPhotos }
      })
    },
    [updateTask],
  )

  const handleRemoveTaskCode = useCallback(
    (taskId, index) => {
      updateTask(taskId, (task) => ({
        codes: (task.codes ?? []).filter((_, codeIndex) => codeIndex !== index),
        codePhotos: (task.codePhotos ?? []).filter(
          (_, codeIndex) => codeIndex !== index,
        ),
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
    (taskId, preferredClueId = null) => {
      const newClue = createClue(preferredClueId)
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

  const handleReorderClue = useCallback(
    (taskId, sourceIndex, targetIndex) => {
      if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex)) {
        return
      }
      if (sourceIndex === targetIndex) {
        return
      }
      updateTask(taskId, (task) => {
        const clues = Array.isArray(task?.clues) ? [...task.clues] : []
        if (
          sourceIndex < 0 ||
          targetIndex < 0 ||
          sourceIndex >= clues.length ||
          targetIndex >= clues.length
        ) {
          return { clues }
        }
        const [moved] = clues.splice(sourceIndex, 1)
        clues.splice(targetIndex, 0, moved)
        return { clues }
      })
    },
    [updateTask],
  )

  const handleAddSubTask = useCallback(
    (taskId) => {
      if (!isEditingPhotoGame) {
        return
      }
      const newSubTask = createSubTask()
      updateTask(taskId, (task) => ({
        subTasks: [...(task.subTasks ?? []), newSubTask],
      }))
    },
    [isEditingPhotoGame, updateTask],
  )

  const handleSubTaskChange = useCallback(
    (taskId, subTaskId, field, value) => {
      if (!isEditingPhotoGame) {
        return
      }
      updateTask(taskId, (task) => ({
        subTasks: (task.subTasks ?? []).map((subTask) =>
          subTask.id === subTaskId ? { ...subTask, [field]: value } : subTask,
        ),
      }))
    },
    [isEditingPhotoGame, updateTask],
  )

  const handleRemoveSubTask = useCallback(
    (taskId, subTaskId) => {
      if (!isEditingPhotoGame) {
        return
      }
      updateTask(taskId, (task) => ({
        subTasks: (task.subTasks ?? []).filter(
          (subTask) => subTask.id !== subTaskId,
        ),
      }))
    },
    [isEditingPhotoGame, updateTask],
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

  const handleCloseTeamsModal = useCallback(() => {
    setIsTeamsModalOpen(false)
  }, [])

  const loadTeamsModalData = useCallback(async () => {
    if (!selectedGame) {
      setTeamsModalState({
        isLoading: false,
        error: 'Не выбрана игра для управления командами',
        gameTeams: [],
        availableTeams: [],
      })
      setSelectedTeamToAdd('')
      return
    }

    setTeamsModalState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const gameTeamsResponse = await fetch(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(selectedGame.id)}/teams`,
      )

      const gameTeamsJson = await gameTeamsResponse.json()
      if (!gameTeamsResponse.ok || gameTeamsJson?.success === false) {
        throw new Error(
          extractErrorMessage(gameTeamsJson?.error) ||
            'Не удалось загрузить команды игры',
        )
      }

      const gameTeamsEntries = Array.isArray(gameTeamsJson?.data?.entries)
        ? gameTeamsJson.data.entries
        : []
      const linkedTeams = Array.isArray(gameTeamsJson?.data?.teams)
        ? gameTeamsJson.data.teams
        : []
      const allTeamsData = Array.isArray(gameTeamsJson?.data?.allTeams)
        ? gameTeamsJson.data.allTeams
        : []

      const allTeamIds = allTeamsData
        .map((team) => {
          if (team?._id || team?.id) {
            try {
              return String(team._id || team.id)
            } catch {
              return ''
            }
          }

          return ''
        })
        .filter((id) => typeof id === 'string' && id.length > 0)

      let detailedTeamsMap = {}

      if (allTeamIds.length > 0) {
        const detailedParams = new URLSearchParams()
        allTeamIds.forEach((id) => detailedParams.append('teamIds', id))

        try {
          const { response: detailedResponse, json: detailedJson } =
            await requestApiJson(
              `${CABINET_TEAMS_API_BASE}?${detailedParams.toString()}`,
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
            outOfCompetition: Boolean(entry?.outOfCompetition),
            paidGame: Boolean(entry?.paidGame),
            totalPaid: Number.isFinite(Number(entry?.totalPaid))
              ? Number(entry.totalPaid)
              : 0,
            timeAddings: Array.isArray(entry?.timeAddings)
              ? entry.timeAddings
              : [],
            hasPrequelAdjustments: Boolean(entry?.hasPrequelAdjustments),
            prequelAdjustments: Array.isArray(entry?.prequelAdjustments)
              ? entry.prequelAdjustments
              : [],
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
        const rawId = team?._id || team?.id
        if (rawId) {
          const id = String(rawId)
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
            members: Array.isArray(detailedTeam?.members)
              ? detailedTeam.members
              : [],
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
          prev && availableTeams.some((team) => team.id === prev) ? prev : '',
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
  }, [selectedGame])

  const addTeamToGameMutation = useMutation({
    mutationFn: async ({ gameId, teamId }) => {
      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(gameId)}/teams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId }),
          fallbackMessage: 'Не удалось добавить команду',
        },
      )

      return { gameId }
    },
    onMutate: () => {
      setTeamsModalState((prev) => ({ ...prev, error: null }))
    },
    onSuccess: async ({ gameId }) => {
      removeGameResultsQueries(queryClient, gameId)
      await loadTeamsModalData()
    },
    onError: (error) => {
      console.error('Failed to add team to game', error)
      setTeamsModalState((prev) => ({
        ...prev,
        error: extractErrorMessage(error) || 'Не удалось добавить команду',
      }))
    },
  })

  const removeTeamFromGameMutation = useMutation({
    mutationFn: async ({ gameId, gameTeamId, teamId }) => {
      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(gameId)}/teams`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamIds: [teamId] }),
          fallbackMessage: 'Не удалось удалить команду',
        },
      )

      return { gameId, gameTeamId }
    },
    onMutate: ({ gameTeamId }) => {
      setRemovingTeamIds((prev) =>
        prev.includes(gameTeamId) ? prev : [...prev, gameTeamId],
      )
      setTeamsModalState((prev) => ({ ...prev, error: null }))
    },
    onSuccess: async ({ gameId }) => {
      removeGameResultsQueries(queryClient, gameId)
      await loadTeamsModalData()
    },
    onError: (error) => {
      console.error('Failed to remove team from game', error)
      setTeamsModalState((prev) => ({
        ...prev,
        error: extractErrorMessage(error) || 'Не удалось удалить команду',
      }))
    },
    onSettled: (_data, _error, variables) => {
      const gameTeamId = variables?.gameTeamId
      if (!gameTeamId) {
        return
      }
      setRemovingTeamIds((prev) => prev.filter((id) => id !== gameTeamId))
    },
  })

  const toggleTeamOutOfCompetitionMutation = useMutation({
    mutationFn: async ({ gameId, gameTeamId, outOfCompetition }) => {
      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(gameId)}/teams`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameTeamId,
            outOfCompetition: Boolean(outOfCompetition),
          }),
          fallbackMessage: 'Не удалось обновить флаг «Вне зачёта»',
        },
      )

      return { gameId, gameTeamId }
    },
    onMutate: ({ gameTeamId }) => {
      setUpdatingOutOfCompetitionTeamIds((prev) =>
        prev.includes(gameTeamId) ? prev : [...prev, gameTeamId],
      )
      setTeamsModalState((prev) => ({ ...prev, error: null }))
    },
    onSuccess: async ({ gameId }) => {
      removeGameResultsQueries(queryClient, gameId)
      await loadTeamsModalData()
    },
    onError: (error) => {
      console.error('Failed to toggle out-of-competition state', error)
      setTeamsModalState((prev) => ({
        ...prev,
        error:
          extractErrorMessage(error) || 'Не удалось обновить флаг «Вне зачёта»',
      }))
    },
    onSettled: (_data, _error, variables) => {
      const gameTeamId = variables?.gameTeamId
      if (!gameTeamId) {
        return
      }
      setUpdatingOutOfCompetitionTeamIds((prev) =>
        prev.filter((id) => id !== gameTeamId),
      )
    },
  })

  const toggleTeamPaidGameMutation = useMutation({
    mutationFn: async ({ gameId, gameTeamId, paidGame }) => {
      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(gameId)}/teams`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_paid_game',
            gameTeamId,
            paidGame: Boolean(paidGame),
          }),
          fallbackMessage: 'Не удалось обновить флаг оплаты игры',
        },
      )

      return { gameId, gameTeamId }
    },
    onMutate: ({ gameTeamId }) => {
      setUpdatingPaidGameTeamIds((prev) =>
        prev.includes(gameTeamId) ? prev : [...prev, gameTeamId],
      )
      setTeamsModalState((prev) => ({ ...prev, error: null }))
    },
    onSuccess: async ({ gameId }) => {
      removeGameResultsQueries(queryClient, gameId)
      await loadTeamsModalData()
    },
    onError: (error) => {
      console.error('Failed to toggle paid game state', error)
      setTeamsModalState((prev) => ({
        ...prev,
        error:
          extractErrorMessage(error) || 'Не удалось обновить флаг оплаты игры',
      }))
    },
    onSettled: (_data, _error, variables) => {
      const gameTeamId = variables?.gameTeamId
      if (!gameTeamId) {
        return
      }
      setUpdatingPaidGameTeamIds((prev) =>
        prev.filter((id) => id !== gameTeamId),
      )
    },
  })

  const isAddingTeam = addTeamToGameMutation.isPending

  const handleAddTeamToGame = useCallback(() => {
    if (!selectedGame || !selectedTeamToAdd) {
      return
    }

    addTeamToGameMutation.mutate({
      gameId: selectedGame.id,
      teamId: selectedTeamToAdd,
    })
  }, [addTeamToGameMutation, selectedGame, selectedTeamToAdd])

  const handleRemoveTeamFromGame = useCallback(
    (gameTeamId) => {
      if (!gameTeamId || !selectedGame) {
        return
      }

      const gameTeamEntry = teamsModalState.gameTeams.find(
        (entry) => entry.id === gameTeamId,
      )
      if (!gameTeamEntry?.teamId) {
        setTeamsModalState((prev) => ({
          ...prev,
          error: 'Не удалось определить команду для удаления',
        }))
        return
      }

      removeTeamFromGameMutation.mutate({
        gameId: selectedGame.id,
        gameTeamId,
        teamId: gameTeamEntry.teamId,
      })
    },
    [removeTeamFromGameMutation, selectedGame, teamsModalState.gameTeams],
  )

  const handleToggleTeamOutOfCompetition = useCallback(
    ({ gameTeamId, outOfCompetition }) => {
      if (!selectedGame || !gameTeamId) {
        return
      }

      toggleTeamOutOfCompetitionMutation.mutate({
        gameId: selectedGame.id,
        gameTeamId,
        outOfCompetition,
      })
    },
    [selectedGame, toggleTeamOutOfCompetitionMutation],
  )

  const handleToggleTeamPaidGame = useCallback(
    ({ gameTeamId, paidGame }) => {
      if (!selectedGame || !gameTeamId) {
        return
      }

      toggleTeamPaidGameMutation.mutate({
        gameId: selectedGame.id,
        gameTeamId,
        paidGame,
      })
    },
    [selectedGame, toggleTeamPaidGameMutation],
  )

  useEffect(() => {
    if (isTeamsModalOpen) {
      loadTeamsModalData()
    }
  }, [isTeamsModalOpen, loadTeamsModalData])

  const prepareGameDraftForModal = useCallback((game) => {
    if (!game) {
      return
    }

    const draft = cloneGameDraft(game)
    draft.taskDistributionMode = normalizeTaskDistributionMode(
      game.taskDistributionMode,
    )
    draft.taskDistributionTemplate = normalizeStoredTaskDistributionTemplate(
      game.taskDistributionTemplate,
      Array.isArray(game.tasks) ? game.tasks.length : 0,
    )
    setEditingGame(draft)
    setEditingBaselineGame(cloneGameDraft(draft))
  }, [])

  const handleSelectGameCard = useCallback((game) => {
    if (!game) {
      return
    }

    setSelectedGameId(game.id)
    setIsTeamsModalOpen(false)
    setIsEditModalOpen(false)
    setIsFinancesModalOpen(false)
    setIsGameHistoryModalOpen(false)
    setIsTasksModalOpen(false)
    setIsResultsModalOpen(false)
    setIsTasksViewModalOpen(false)
    setIsDescriptionModalOpen(true)
  }, [])

  const handleEditGameFromList = useCallback(
    (game) => {
      if (!game || !canOpenGameEditModal(game)) {
        return
      }

      setSelectedGameId(game.id)
      prepareGameDraftForModal(game)
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsFinancesModalOpen(false)
      setIsGameHistoryModalOpen(false)
      setIsTasksModalOpen(false)
      setIsEditModalOpen(true)
    },
    [canOpenGameEditModal, prepareGameDraftForModal],
  )

  const handleEditTasksFromList = useCallback(
    (game) => {
      if (!game || !canManageGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      prepareGameDraftForModal(game)
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsFinancesModalOpen(false)
      setIsGameHistoryModalOpen(false)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(true)
    },
    [canManageGame, prepareGameDraftForModal],
  )

  const handleOpenFinancesModal = useCallback(
    (game) => {
      if (
        !game ||
        !canManageCabinetGameFinances({
          canManageGameStatus: canManageGameStatus(game),
        })
      ) {
        return
      }

      setSelectedGameId(game.id)
      prepareGameDraftForModal(game)
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(false)
      setIsGameHistoryModalOpen(false)
      setIsFinancesModalOpen(true)
    },
    [canManageGameStatus, prepareGameDraftForModal],
  )

  const handleOpenGameHistoryModal = useCallback(
    (game) => {
      if (!game || !canManageGameStatus(game)) {
        return
      }

      setSelectedGameId(game.id)
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(false)
      setIsFinancesModalOpen(false)
      setIsGameHistoryModalOpen(true)
    },
    [canManageGameStatus],
  )

  const handleOpenStatusModal = useCallback(
    (gameCandidate = null) => {
      const game = gameCandidate || selectedGame
      if (!game || !canEditAllGames || !canManageGameStatus(game)) {
        return
      }

      setStatusModalGameId(game.id)
      setStatusValidationResult(null)
      setIsStatusModalOpen(true)
    },
    [canEditAllGames, canManageGameStatus, selectedGame],
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
      if (
        !statusModalGame ||
        !canEditAllGames ||
        !canManageGameStatus(statusModalGame)
      ) {
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

      if (typeof window !== 'undefined' && actionId === 'delete_game') {
        const shouldDelete = window.confirm(
          'Удалить игру без возможности восстановления? Это действие необратимо.',
        )
        if (!shouldDelete) {
          return
        }
      }

      setIsStatusChanging(true)
      setFeedback(null)
      setStatusProgressMessage('')

      try {
        const runGameValidation = async () => {
          const { json } = await requestApiJson(
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}/check`,
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
          setStatusProgressMessage('Проверяем игру…')
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

        if (actionId === 'distribute_tasks') {
          setStatusProgressMessage('Распределяем задания по командам…')
          const { json } = await requestApiJson(
            '/api/cabinet/admin/task-distribution',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gameId: statusModalGame.id }),
              fallbackMessage: 'Не удалось распределить задания',
            },
          )
          const teamsUpdated = Number(json?.data?.teamsUpdated) || 0
          await queryClient.invalidateQueries({ queryKey: ['cabinet-games'] })
          await gamesQuery.refetch()
          setStatusProgressMessage('')
          setFeedback({
            type: 'success',
            message: `Задания распределены. Команд обновлено: ${teamsUpdated}`,
          })
          setToastEvent({
            id: `task-distribution-${Date.now()}`,
            type: 'success',
            message: 'Задания распределены',
          })
          return
        }

        if (actionId === 'start_game') {
          setStatusProgressMessage('Проверяем игру перед запуском…')
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

          setStatusProgressMessage(
            'Запускаем игру, рассылаем уведомления игрокам…',
          )
          await requestApiJson(
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}/start`,
            {
              fallbackMessage: 'Не удалось обновить статус игры',
            },
          )
          successMessage = 'Игра запущена'
        } else if (actionId === 'stop_game') {
          setStatusProgressMessage('Останавливаем игру, формируем результаты…')
          await requestApiJson(
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}/stop`,
            {
              fallbackMessage: 'Не удалось обновить статус игры',
            },
          )
          successMessage = 'Игра остановлена'
        } else if (actionId === 'delete_game') {
          setStatusProgressMessage('Удаляем игру…')
          await requestApiJson(
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}`,
            {
              method: 'DELETE',
              fallbackMessage: 'Не удалось удалить игру',
            },
          )
          successMessage = 'Игра удалена'
        } else {
          let nextStatus = null
          let clearTimeAddingsOnReset = true
          let prequelResetMode = 'clear'

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

          if (typeof window !== 'undefined' && actionId === 'restart_game') {
            try {
              const { json } = await requestApiJson(
                `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
                  statusModalGame.id,
                )}/teams`,
                {
                  fallbackMessage:
                    'Не удалось проверить ручные корректировки команд',
                },
              )
              const gameTeams = Array.isArray(json?.data?.entries)
                ? json.data.entries
                : []
              const hasManualAdjustments = gameTeams.some((gameTeam) =>
                (Array.isArray(gameTeam?.timeAddings)
                  ? gameTeam.timeAddings
                  : []
                ).some((adding) => {
                  const source = String(adding?.source || '')
                    .trim()
                    .toLowerCase()
                  return (
                    source === 'manual_team_adjustment' ||
                    (!source &&
                      !adding?.taskId &&
                      (adding?.taskIndex === null ||
                        adding?.taskIndex === undefined ||
                        adding?.taskIndex === ''))
                  )
                }),
              )
              const hasResolvedPrequel = gameTeams.some((gameTeam) =>
                Boolean(gameTeam?.hasPrequelAdjustments),
              )

              if (hasManualAdjustments) {
                clearTimeAddingsOnReset = window.confirm(
                  'В игре есть ручные корректировки (Бонусы/Штрафы). Очистить их при перезапуске?',
                )
              }

              if (hasResolvedPrequel) {
                const shouldKeepPrequel = window.confirm(
                  'Хотя бы одна команда уже решила приквел. Нажмите "ОК", чтобы сохранить корректировочные данные приквела при перезапуске, или "Отмена", чтобы удалить их.',
                )
                prequelResetMode = shouldKeepPrequel ? 'keep' : 'clear'
              }
            } catch (adjustmentsCheckError) {
              console.error(
                'Failed to check manual adjustments before restart',
                adjustmentsCheckError,
              )
              const shouldContinue = window.confirm(
                'Не удалось проверить ручные корректировки команд. Продолжить перезапуск с очисткой корректировок?',
              )
              if (!shouldContinue) {
                return
              }
              clearTimeAddingsOnReset = true
              prequelResetMode = 'clear'
            }
          }

          await requestApiJson(
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: {
                  status: nextStatus,
                  ...(actionId === 'restart_game'
                    ? { clearTimeAddingsOnReset, prequelResetMode }
                    : {}),
                },
              }),
              fallbackMessage: 'Не удалось обновить статус игры',
            },
          )
        }

        setStatusProgressMessage('Обновляем список игр…')
        await queryClient.invalidateQueries({ queryKey: ['cabinet-games'] })
        await gamesQuery.refetch()

        setStatusProgressMessage('')
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
        setStatusProgressMessage('')
      }
    },
    [
      canEditAllGames,
      canManageGameStatus,
      gamesQuery,
      queryClient,
      statusModalGame,
    ],
  )

  const handleManageTeamsFromList = useCallback((game, isReadOnly = false) => {
    if (!game) {
      return
    }

    setIsTeamsModalReadOnly(isReadOnly)
    setSelectedGameId(game.id)
    setIsResultsModalOpen(false)
    setIsTasksViewModalOpen(false)
    setIsDescriptionModalOpen(false)
    setIsTeamsModalOpen(true)
  }, [])

  const handleViewGameTeamsFromList = useCallback((game) => {
    if (!game) {
      return
    }

    setSelectedGameId(game.id)
    setIsResultsModalOpen(false)
    setIsTasksViewModalOpen(false)
    setIsDescriptionModalOpen(false)
    setIsTeamsModalOpen(true)
  }, [])

  const canViewResultsForGame = useCallback(
    (game) => {
      if (!game) {
        return false
      }

      if (!Boolean(game.isResultGenerated)) {
        return false
      }

      const status =
        typeof game.status === 'string' ? game.status.toLowerCase() : ''
      const isCompleted = status === 'finished' || status === 'closed'
      if (!isCompleted) {
        return false
      }

      const canManageThisGameStatus = canManageGameStatus(game)
      if (canManageThisGameStatus) {
        return true
      }

      return !Boolean(game.hideResult)
    },
    [canManageGameStatus],
  )

  const canGenerateResultsForGame = useCallback(
    (game) => {
      if (!game) {
        return false
      }

      if (Boolean(game.isResultGenerated)) {
        return false
      }

      const status =
        typeof game.status === 'string' ? game.status.toLowerCase() : ''
      const isCompleted = status === 'finished' || status === 'closed'
      if (!isCompleted) {
        return false
      }

      return canManageGameStatus(game)
    },
    [canManageGameStatus],
  )

  const canRebuildResultsForGame = useCallback(
    (game) => {
      if (!game) {
        return false
      }

      const status =
        typeof game.status === 'string' ? game.status.toLowerCase() : ''
      const isCompleted = status === 'finished' || status === 'closed'
      if (!isCompleted) {
        return false
      }

      return canManageGameStatus(game)
    },
    [canManageGameStatus],
  )

  const canViewTasksForGame = useCallback((game) => {
    if (!game || !Boolean(game.showTasks)) {
      return false
    }

    const status =
      typeof game.status === 'string' ? game.status.toLowerCase() : ''
    const isCompleted = status === 'finished' || status === 'closed'
    if (!isCompleted) {
      return false
    }

    return Array.isArray(game.tasks) && game.tasks.length > 0
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

  const resultsModalLocationForApi =
    resultsModalGame?.location ||
    (shouldShowLocationFilter ? gamesFilterLocation : location) ||
    ''
  const resultsModalUserParticipationTeamIds = useMemo(
    () =>
      resultsModalGame
        ? getUserParticipationTeams(resultsModalGame).map(
            (entry) => entry.teamId,
          )
        : [],
    [resultsModalGame],
  )
  const resultsModalViewerCanManageResults = useMemo(
    () => canManageGameStatus(resultsModalGame),
    [canManageGameStatus, resultsModalGame],
  )
  const gameResultsQuery = useQuery({
    queryKey: buildGameResultsQueryKey({
      gameId: resultsModalGame?.id,
      locationValue: resultsModalLocationForApi,
    }),
    queryFn: () =>
      fetchGameResultsData({
        game: resultsModalGame,
        locationForApi: resultsModalLocationForApi,
        userParticipationTeamIds: resultsModalUserParticipationTeamIds,
        viewerCanManageResults: resultsModalViewerCanManageResults,
      }),
    enabled:
      isResultsModalOpen &&
      Boolean(resultsModalGame?.id) &&
      canViewResultsForGame(resultsModalGame),
  })

  useEffect(() => {
    if (!isResultsModalOpen || !resultsModalGame?.id) {
      return
    }

    const fallbackState = {
      gameId: resultsModalGame.id,
      gameName: resultsModalGame.name || 'Без названия',
      rows: [],
      teamsCount: 0,
      participantsCount: 0,
      computed: null,
      interactiveResultsUrl: null,
      userParticipationTeamIds: resultsModalUserParticipationTeamIds,
      viewerCanManageResults: resultsModalViewerCanManageResults,
    }

    if (gameResultsQuery.data) {
      setResultsModalState({
        isLoading: false,
        error: null,
        ...gameResultsQuery.data,
      })
      return
    }

    if (gameResultsQuery.error) {
      setResultsModalState({
        isLoading: false,
        error:
          extractErrorMessage(gameResultsQuery.error) ||
          'Не удалось загрузить результаты игры',
        ...fallbackState,
      })
      return
    }

    if (gameResultsQuery.isFetching) {
      setResultsModalState({
        isLoading: true,
        error: null,
        ...fallbackState,
      })
    }
  }, [
    gameResultsQuery.data,
    gameResultsQuery.error,
    gameResultsQuery.isFetching,
    isResultsModalOpen,
    resultsModalGame,
    resultsModalUserParticipationTeamIds,
    resultsModalViewerCanManageResults,
  ])

  const handleOpenResultsFromGame = useCallback(
    (game) => {
      if (!game || !canViewResultsForGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(false)
      setIsTeamsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setResultsModalGame(game)
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
        userParticipationTeamIds: getUserParticipationTeams(game).map(
          (entry) => entry.teamId,
        ),
        viewerCanManageResults: canManageGameStatus(game),
      })
      setIsResultsModalOpen(true)
    },
    [canManageGameStatus, canViewResultsForGame],
  )

  const handleCloseResultsModal = useCallback(() => {
    setIsResultsModalOpen(false)
    setResultsModalGame(null)
  }, [])

  const handleOpenTasksViewFromGame = useCallback(
    (game) => {
      if (!game || !canViewTasksForGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(false)
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsTasksViewModalOpen(true)
    },
    [canViewTasksForGame],
  )

  const handleCloseTasksViewModal = useCallback(() => {
    setIsTasksViewModalOpen(false)
  }, [])

  const generateResultsMutation = useMutation({
    mutationFn: async ({ game, locationForApi }) => {
      const { json } = await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(game.id)}/result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: locationForApi }),
          fallbackMessage: 'Не удалось сформировать результаты',
        },
      )

      return {
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
        userParticipationTeamIds: getUserParticipationTeams(game).map(
          (entry) => entry.teamId,
        ),
        viewerCanManageResults: canManageGameStatus(game),
      }
    },
    onMutate: () => {
      setFeedback(null)
    },
    onSuccess: (nextData, { game, locationForApi }) => {
      queryClient.setQueryData(
        buildGameResultsQueryKey({
          gameId: game.id,
          locationValue: locationForApi,
        }),
        nextData,
      )

      applyPersistedGameUpdate(game.id, (gameItem) => ({
        ...gameItem,
        isResultGenerated: true,
      }))

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
    },
    onError: (error) => {
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
    },
  })

  const isGeneratingResults = generateResultsMutation.isPending

  const handleGenerateResultsFromGame = useCallback(
    (game, options = {}) => {
      const force = Boolean(options?.force) || Boolean(game?.isResultGenerated)
      const canProceed = force
        ? canRebuildResultsForGame(game)
        : canGenerateResultsForGame(game)

      if (!game || !canProceed || isGeneratingResults) {
        return
      }

      const confirmationMessage = Boolean(game.isResultGenerated)
        ? `Сформировать результаты игры «${game.name || 'Без названия'}» заново? Текущие сохранённые результаты будут пересчитаны.`
        : `Сформировать результаты игры «${game.name || 'Без названия'}»?`
      if (
        typeof window !== 'undefined' &&
        !window.confirm(confirmationMessage)
      ) {
        return
      }

      const locationForApi =
        game.location ||
        (shouldShowLocationFilter ? gamesFilterLocation : location) ||
        ''

      generateResultsMutation.mutate({ game, locationForApi })
    },
    [
      generateResultsMutation,
      canRebuildResultsForGame,
      canGenerateResultsForGame,
      gamesFilterLocation,
      isGeneratingResults,
      location,
      shouldShowLocationFilter,
    ],
  )

  const handleGenerateResults = useCallback(() => {
    if (!selectedGame || !canGenerateResults) {
      return
    }
    handleGenerateResultsFromGame(selectedGame, { force: true })
  }, [canGenerateResults, handleGenerateResultsFromGame, selectedGame])

  const handleCloseEditModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsEditModalOpen(false)
    if (!isTasksModalOpen) {
      setEditingGame(null)
      setEditingBaselineGame(null)
    }
  }, [isSaving, isTasksModalOpen])

  const handleCloseTasksModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsTasksModalOpen(false)
    if (!isEditModalOpen) {
      setEditingGame(null)
      setEditingBaselineGame(null)
    }
  }, [isEditModalOpen, isSaving])

  const handleCloseFinancesModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsFinancesModalOpen(false)
    if (!isEditModalOpen && !isTasksModalOpen) {
      setEditingGame(null)
      setEditingBaselineGame(null)
    }
  }, [isEditModalOpen, isSaving, isTasksModalOpen])

  const handleCloseGameHistoryModal = useCallback(() => {
    setIsGameHistoryModalOpen(false)
  }, [])

  const handleGameHistoryRollbackSuccess = useCallback(
    async (payload) => {
      queryClient.invalidateQueries({ queryKey: ['cabinet-games'] })
      queryClient.invalidateQueries({ queryKey: ['game-results'] })
      await gamesQuery.refetch()
      setFeedback({
        type: 'success',
        message:
          Number(payload?.rolledBackEntriesCount) > 0
            ? `Откат выполнен. Отменено действий: ${payload.rolledBackEntriesCount}.`
            : 'Откат выполнен.',
      })
      setIsGameHistoryModalOpen(false)
    },
    [gamesQuery, queryClient],
  )

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

  const handleTasksModalPrimaryAction = useCallback(() => {
    if (isSaving) {
      return
    }

    if (isDirty && canEditSelectedGame) {
      handleSaveChanges()
    } else {
      handleCloseTasksModal()
    }
  }, [
    canEditSelectedGame,
    handleCloseTasksModal,
    handleSaveChanges,
    isDirty,
    isSaving,
  ])

  const handleFinancesModalPrimaryAction = useCallback(() => {
    if (isSaving) {
      return
    }

    if (isDirty && canEditSelectedGame) {
      handleSaveChanges()
    } else {
      handleCloseFinancesModal()
    }
  }, [
    canEditSelectedGame,
    handleCloseFinancesModal,
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

  const handleAddAgent = useCallback(() => {
    if (!selectedGame || !canEditSelectedGame) {
      return
    }

    const candidateId = String(selectedAgentToAdd || '').trim()
    if (!candidateId) {
      return
    }

    const candidate = availableAgentsMap.get(candidateId)
    if (!candidate) {
      return
    }

    updateSelectedGame((game) => {
      const currentAgents = Array.isArray(game.agents)
        ? game.agents.filter(Boolean)
        : []
      const alreadyExists = currentAgents.some(
        (agent) =>
          String(agent?.userId || agent?.id || agent || '') === candidate.id,
      )

      if (alreadyExists) {
        return { agents: currentAgents }
      }

      return {
        agents: [
          ...currentAgents,
          {
            userId: candidate.id,
            id: candidate.id,
            active: true,
            name: candidate.name || '',
            username: candidate.username || '',
            telegramId: candidate.telegramId || '',
          },
        ],
      }
    })

    setSelectedAgentToAdd('')
  }, [
    availableAgentsMap,
    canEditSelectedGame,
    selectedAgentToAdd,
    selectedGame,
    updateSelectedGame,
  ])

  const handleRemoveAgent = useCallback(
    (agentId) => {
      const normalizedAgentId = String(agentId || '').trim()
      if (!canEditSelectedGame || !normalizedAgentId) {
        return
      }

      const gameForPrompt = editingGame ?? selectedGame
      const affectedTasks = (
        Array.isArray(gameForPrompt?.tasks) ? gameForPrompt.tasks : []
      )
        .map((task, index) => {
          const ids = Array.isArray(task?.agentUserIds)
            ? task.agentUserIds.map((id) => String(id))
            : []
          if (!ids.includes(normalizedAgentId)) {
            return null
          }
          return `Задание ${index + 1} - ${task?.title || 'Без названия'}`
        })
        .filter(Boolean)

      const agentLabel =
        selectedGameAgents.find((agent) => agent.userId === normalizedAgentId)
          ?.name || 'агента'
      const message =
        affectedTasks.length > 0
          ? `Удалить ${agentLabel} из игры? Агент также будет удален из заданий:\n\n${affectedTasks
              .map((label) => `- ${label}`)
              .join('\n')}`
          : `Удалить ${agentLabel} из игры?`

      if (typeof window !== 'undefined' && !window.confirm(message)) {
        return
      }

      updateSelectedGame((game) => ({
        agents: (Array.isArray(game.agents) ? game.agents : []).filter(
          (agent) =>
            String(agent?.userId || agent?.id || agent || '') !==
            normalizedAgentId,
        ),
        tasks: (Array.isArray(game.tasks) ? game.tasks : []).map((task) => ({
          ...task,
          agentUserIds: (Array.isArray(task?.agentUserIds)
            ? task.agentUserIds
            : []
          ).filter((id) => String(id) !== normalizedAgentId),
        })),
      }))
    },
    [
      canEditSelectedGame,
      editingGame,
      selectedGame,
      selectedGameAgents,
      updateSelectedGame,
    ],
  )

  const renderGameListItem = useCallback(
    (game) => {
      const cardStartDateRaw =
        gamesView === 'past'
          ? game.dateStartFact || game.dateStart
          : game.dateStart
      const startDateLabel = cardStartDateRaw
        ? formatDateInLocationTimeZone(cardStartDateRaw, game.location, {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : gamesView === 'past'
          ? 'Факт. старт не указан'
          : 'Дата не задана'

      const canManageThisGame = canManageGame(game)
      const canEditThisGame = canOpenGameEditModal(game)
      const canManageStatusThisGame =
        canEditAllGames && canManageGameStatus(game)
      const canManageFinancesThisGame = canManageCabinetGameFinances({
        canManageGameStatus: canManageGameStatus(game),
      })
      const canManageHistoryThisGame = canManageGameStatus(game)
      const canBroadcastThisGame =
        canManageThisGame && canBroadcastByGameStatus(game.status)
      const adminUnreadMessagesCount = Number(
        game.adminUnreadMessagesCount || 0,
      )
      const adminUnreadMessagesBadge =
        adminUnreadMessagesCount > 99 ? '99+' : adminUnreadMessagesCount || null
      const canViewThisGameResults = canViewResultsForGame(game)
      const isResultsAdminOnly =
        canViewThisGameResults &&
        Boolean(game.isResultGenerated) &&
        Boolean(game.hideResult)
      const resultsButtonClassName = isResultsAdminOnly
        ? 'inline-flex cursor-pointer items-center justify-center rounded-xl border border-amber-300/80 bg-amber-100/90 px-4 py-1.5 text-sm font-semibold text-amber-800 transition hover:border-amber-500 hover:bg-amber-200 dark:border-amber-400/55 dark:bg-amber-500/18 dark:text-amber-100 dark:hover:bg-amber-500/28'
        : 'inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/80 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/14 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/24'
      const canGenerateThisGameResults = canGenerateResultsForGame(game)
      const canViewThisGameTasks = canViewTasksForGame(game)
      const canViewGameTeams =
        typeof game?.status === 'string' && game.status !== 'canceled'
      const canOpenAgentPanel = isCurrentUserGameAgent(
        game,
        currentUserIdString,
      )
      const visibleStatus = normalizeVisibleStatus(
        game.status,
        canSeeClosedStatus,
      )
      const userTeamPlace = Number(game.userTeamPlace)
      const hasUserTeamPlace =
        Number.isFinite(userTeamPlace) && userTeamPlace > 0
      const participationTeams = getUserParticipationTeams(game)
      const hasParticipation = participationTeams.length > 0
      const captainParticipationTeams = participationTeams.filter(
        (entry) => entry.isCaptain,
      )
      const canJoinGame =
        !hasParticipation &&
        canJoinGameByStatus(visibleStatus) &&
        Boolean(game?.registrationOpen ?? true) &&
        Boolean(currentUserDbId)
      const canCancelRegistration =
        captainParticipationTeams.length > 0 &&
        isActiveGameStatus(visibleStatus)
      const gameEnterHref = resolveGameEntryHrefFromGame({
        game,
        fallbackLocation: location,
      })
      const canEnterGame =
        hasParticipation &&
        (isGameInProgressStatus(visibleStatus) ||
          (Boolean(game?.showEnterButton) &&
            isActiveGameStatus(visibleStatus))) &&
        Boolean(gameEnterHref)
      const participationSummary = hasParticipation
        ? `Вы участвуете: ${participationTeams
            .map((entry) => entry.teamName || entry.teamId)
            .join(', ')}`
        : ''
      const isCancellingRegistration = isRegistrationCancellationInProgress(
        game.id,
      )
      const hasSeason =
        typeof game?.seasonId === 'string' && game.seasonId.trim().length > 0
      const seasonLabel =
        typeof game?.seasonName === 'string' ? game.seasonName.trim() : ''
      const seasonBadgeLabel =
        hasSeason && seasonLabel ? seasonLabel : 'Вне сезона'
      const isHiddenGame = Boolean(game?.hidden)
      const isStartedGame = isGameInProgressStatus(game.status)

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
            className={`relative min-h-[150px] overflow-hidden p-0 cursor-pointer sm:min-h-[168px] ${
              isStartedGame ? STARTED_GAME_CARD_CLASS_NAME : ''
            }`}
            aria-pressed={false}
            aria-label={`Открыть описание игры «${game.name || 'Без названия'}»`}
            title={game.name || 'Без названия'}
          >
            <div className="flex items-start min-w-0">
              <div
                className={`relative hidden min-h-[156px] w-[156px] shrink-0 overflow-hidden rounded-lg border shadow-inner sm:block ${
                  isStartedGame
                    ? STARTED_GAME_IMAGE_FRAME_CLASS_NAME
                    : 'border-slate-300 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900'
                }`}
              >
                <GameCardImage
                  src={game.image}
                  alt={game.name ? `Обложка игры ${game.name}` : 'Обложка игры'}
                  className="block w-full h-auto"
                  placeholderClassName="flex w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 py-6 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400"
                />
              </div>
              <div className="min-w-0 flex-1 p-0 sm:absolute sm:inset-y-0 sm:left-[168px] sm:right-0 sm:overflow-hidden sm:p-4">
                <div className="flex items-start flex-1 w-full min-w-0 gap-3">
                  <div
                    className={`relative min-h-[96px] w-24 shrink-0 overflow-hidden rounded-xl border shadow-inner sm:hidden ${
                      isStartedGame
                        ? STARTED_GAME_IMAGE_FRAME_CLASS_NAME
                        : 'border-slate-300 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900'
                    }`}
                  >
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
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(visibleStatus)}`}
                      >
                        {getGameStatusLabel(visibleStatus)}
                      </span>
                      {game?.isRated === true && (
                        <span className="inline-grid max-w-[9.5rem] shrink-0 place-items-center self-start rounded-full border border-amber-400/75 bg-amber-100 px-2.5 py-1 text-center text-xs font-semibold leading-tight text-amber-700 dark:border-amber-300/60 dark:bg-amber-500/10 dark:text-amber-200">
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
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className="text-slate-500">
                        {gamesView === 'past'
                          ? `Факт. старт: ${startDateLabel}`
                          : startDateLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {getNounTeams(game.teamsCount)}
                    </p>
                    {hasParticipation && (
                      <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                        {participationSummary}
                      </p>
                    )}
                  </div>
                </div>
                {(hasUserTeamPlace ||
                  hasParticipation ||
                  canEnterGame ||
                  canJoinGame ||
                  canCancelRegistration ||
                  canBroadcastThisGame ||
                  canEditThisGame ||
                  canManageThisGame ||
                  canManageStatusThisGame ||
                  canOpenAgentPanel ||
                  canViewThisGameResults ||
                  canGenerateThisGameResults ||
                  canViewThisGameTasks) && (
                  <div className="flex flex-col gap-2 mt-3 phoneH:flex-row phoneH:items-center phoneH:justify-between">
                    <div className="flex items-center order-1 gap-2 phoneH:order-2">
                      {hasUserTeamPlace && (
                        <span className="pointer-events-none inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200">
                          Место: {userTeamPlace}
                        </span>
                      )}
                      {canCancelRegistration && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleCancelRegistrationFromGame(game)
                          }}
                          disabled={isCancellingRegistration}
                          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-rose-300/70 bg-rose-50/80 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/50 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
                        >
                          Снять команду с игры
                        </button>
                      )}
                    </div>
                    {(canJoinGame ||
                      canEnterGame ||
                      canViewThisGameTasks ||
                      canViewThisGameResults ||
                      canGenerateThisGameResults) && (
                      <div className="flex items-center order-2 gap-2 phoneH:order-3 phoneH:ml-auto">
                        {canEnterGame && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(gameEnterHref)
                            }}
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-emerald-300/70 bg-emerald-50/80 px-4 py-1.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-400/50 dark:bg-emerald-500/12 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                          >
                            Зайти в игру
                          </button>
                        )}
                        {canJoinGame && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenRegisterModalForGame(game)
                            }}
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/80 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/14 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/24"
                          >
                            Присоединиться
                          </button>
                        )}
                        {canViewThisGameTasks && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenTasksViewFromGame(game)
                            }}
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-violet-300/70 bg-violet-50/85 px-4 py-1.5 text-sm font-semibold text-violet-700 transition hover:border-violet-500 hover:bg-violet-100 dark:border-violet-500/45 dark:bg-violet-500/12 dark:text-violet-200 dark:hover:bg-violet-500/20"
                          >
                            Задания
                          </button>
                        )}
                        {canViewThisGameResults && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenResultsFromGame(game)
                            }}
                            className={resultsButtonClassName}
                            title={
                              isResultsAdminOnly
                                ? 'Результаты скрыты для игроков'
                                : undefined
                            }
                          >
                            Результаты
                          </button>
                        )}
                        {canGenerateThisGameResults && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleGenerateResultsFromGame(game)
                            }}
                            disabled={isGeneratingResults}
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-1.5 text-sm font-semibold text-amber-700 transition hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-400/50 dark:bg-amber-500/12 dark:text-amber-200 dark:hover:bg-amber-500/20"
                          >
                            {getGenerateResultsButtonLabel(
                              game,
                              isGeneratingResults,
                            )}
                          </button>
                        )}
                      </div>
                    )}
                    {(canEditThisGame ||
                      canManageThisGame ||
                      canManageStatusThisGame ||
                      canManageHistoryThisGame ||
                      canManageFinancesThisGame ||
                      canBroadcastThisGame ||
                      canOpenAgentPanel ||
                      canViewGameTeams) && (
                      <div className="flex flex-wrap items-center self-start order-3 gap-2 phoneH:order-1 phoneH:self-auto">
                        {canOpenAgentPanel && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(
                                `/cabinet/agent?gameId=${encodeURIComponent(
                                  game.id,
                                )}`,
                              )
                            }}
                            label="Панель агента"
                            title="Открыть панель агента"
                          >
                            <AgentCardIcon />
                          </CardActionIconButton>
                        )}
                        {canEditThisGame && (
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
                        {canManageThisGame && game.type !== 'story' && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              handleEditTasksFromList(game)
                            }}
                            label="Редактор заданий"
                            title="Открыть редактор заданий"
                          >
                            <TargetCardIcon />
                          </CardActionIconButton>
                        )}
                        {canManageThisGame && game.type === 'story' && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(
                                `/cabinet/admin/story-editor?gameId=${game.id}`,
                              )
                            }}
                            label="Story-редактор"
                            title="Открыть редактор сценария"
                          >
                            <TargetCardIcon />
                          </CardActionIconButton>
                        )}
                        {canManageStatusThisGame && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenStatusModal(game)
                            }}
                            label={getStatusActionLabel(game.status)}
                            title={getStatusActionLabel(game.status)}
                          >
                            <StatusCardIcon status={game.status} />
                          </CardActionIconButton>
                        )}
                        {canManageFinancesThisGame && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenFinancesModal(game)
                            }}
                            label="Финансы игры"
                            title="Открыть финансы игры"
                          >
                            <FinanceCardIcon />
                          </CardActionIconButton>
                        )}
                        {canManageHistoryThisGame && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenGameHistoryModal(game)
                            }}
                            label="История игры"
                            title="Открыть историю изменений игры"
                          >
                            <HistoryCardIcon />
                          </CardActionIconButton>
                        )}
                        {canBroadcastThisGame && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenPushBroadcastModal(game)
                            }}
                            label="Переписка с командами"
                            title="Открыть переписку с командами"
                            badge={adminUnreadMessagesBadge}
                          >
                            <ChatCardIcon />
                          </CardActionIconButton>
                        )}
                        {isGameInProgressStatus(game.status) &&
                          canManageThisGame && (
                            <CardActionIconButton
                              onClick={(event) => {
                                event.stopPropagation()
                                router.push(
                                  `/cabinet/admin/game-control?gameId=${game.id}`,
                                )
                              }}
                              label="Контроль игры"
                              title="Мониторинг хода игры"
                            >
                              <GameControlCardIcon />
                            </CardActionIconButton>
                          )}
                        {canManageThisGame && game.type === 'photo' && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(
                                `/cabinet/admin/photo-review?gameId=${game.id}`,
                              )
                            }}
                            label="Проверка фото"
                            title="Проверить фото-ответы"
                          >
                            <TargetCardIcon />
                          </CardActionIconButton>
                        )}
                        {canViewGameTeams && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              handleManageTeamsFromList(
                                game,
                                !canManageThisGame,
                              )
                            }}
                            label={
                              canManageThisGame
                                ? 'Управление командами'
                                : 'Просмотр команд'
                            }
                            title={
                              canManageThisGame
                                ? 'Управление командами'
                                : 'Просмотр команд'
                            }
                          >
                            <TeamCardIcon />
                          </CardActionIconButton>
                        )}
                      </div>
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
      canOpenGameEditModal,
      canManageGameStatus,
      canEditAllGames,
      canSeeClosedStatus,
      gamesView,
      canViewResultsForGame,
      canViewTasksForGame,
      currentUserDbId,
      currentUserIdString,
      getNounTeams,
      handleCancelRegistrationFromGame,
      handleEditGameFromList,
      handleEditTasksFromList,
      handleOpenFinancesModal,
      handleOpenGameHistoryModal,
      handleManageTeamsFromList,
      handleViewGameTeamsFromList,
      handleOpenPushBroadcastModal,
      handleOpenRegisterModalForGame,
      handleOpenTasksViewFromGame,
      handleOpenResultsFromGame,
      handleGenerateResultsFromGame,
      handleOpenStatusModal,
      canGenerateResultsForGame,
      isGeneratingResults,
      isRegistrationCancellationInProgress,
      handleSelectGameCard,
      router,
      selectedGameId,
    ],
  )

  const renderGameTileItem = useCallback(
    (game) => {
      const cardStartDateRaw =
        gamesView === 'past'
          ? game.dateStartFact || game.dateStart
          : game.dateStart
      const startDateLabel = cardStartDateRaw
        ? formatDateInLocationTimeZone(cardStartDateRaw, game.location, {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : gamesView === 'past'
          ? 'Факт. старт не указан'
          : 'Дата не задана'

      const canManageThisGame = canManageGame(game)
      const canEditThisGame = canOpenGameEditModal(game)
      const canManageStatusThisGame =
        canEditAllGames && canManageGameStatus(game)
      const canManageFinancesThisGame = canManageCabinetGameFinances({
        canManageGameStatus: canManageGameStatus(game),
      })
      const canManageHistoryThisGame = canManageGameStatus(game)
      const canBroadcastThisGame =
        canManageThisGame && canBroadcastByGameStatus(game.status)
      const canViewThisGameResults = canViewResultsForGame(game)
      const isResultsAdminOnly =
        canViewThisGameResults &&
        Boolean(game.isResultGenerated) &&
        Boolean(game.hideResult)
      const resultsButtonClassName = isResultsAdminOnly
        ? 'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-300/80 bg-amber-100/90 px-4 py-1.5 text-sm font-semibold text-amber-800 transition hover:border-amber-500 hover:bg-amber-200 dark:border-amber-400/55 dark:bg-amber-500/18 dark:text-amber-100 dark:hover:bg-amber-500/28'
        : 'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/70 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/22'
      const canGenerateThisGameResults = canGenerateResultsForGame(game)
      const canViewThisGameTasks = canViewTasksForGame(game)
      const canViewGameTeams =
        typeof game?.status === 'string' && game.status !== 'canceled'
      const canOpenAgentPanel = isCurrentUserGameAgent(
        game,
        currentUserIdString,
      )
      const visibleStatus = normalizeVisibleStatus(
        game.status,
        canSeeClosedStatus,
      )
      const userTeamPlace = Number(game.userTeamPlace)
      const hasUserTeamPlace =
        Number.isFinite(userTeamPlace) && userTeamPlace > 0
      const participationTeams = getUserParticipationTeams(game)
      const hasParticipation = participationTeams.length > 0
      const captainParticipationTeams = participationTeams.filter(
        (entry) => entry.isCaptain,
      )
      const canJoinGame =
        !hasParticipation &&
        canJoinGameByStatus(visibleStatus) &&
        Boolean(game?.registrationOpen ?? true) &&
        Boolean(currentUserDbId)
      const canCancelRegistration =
        captainParticipationTeams.length > 0 &&
        isActiveGameStatus(visibleStatus)
      const gameEnterHref = resolveGameEntryHrefFromGame({
        game,
        fallbackLocation: location,
      })
      const canEnterGame =
        hasParticipation &&
        (isGameInProgressStatus(visibleStatus) ||
          (Boolean(game?.showEnterButton) &&
            isActiveGameStatus(visibleStatus))) &&
        Boolean(gameEnterHref)
      const participationSummary = hasParticipation
        ? `Вы участвуете: ${participationTeams
            .map((entry) => entry.teamName || entry.teamId)
            .join(', ')}`
        : ''
      const isCancellingRegistration = isRegistrationCancellationInProgress(
        game.id,
      )
      const hasSeason =
        typeof game?.seasonId === 'string' && game.seasonId.trim().length > 0
      const seasonLabel =
        typeof game?.seasonName === 'string' ? game.seasonName.trim() : ''
      const seasonBadgeLabel =
        hasSeason && seasonLabel ? seasonLabel : 'Вне сезона'
      const isHiddenGame = Boolean(game?.hidden)
      const isStartedGame = isGameInProgressStatus(game.status)

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
            className={`relative overflow-hidden p-0 cursor-pointer ${
              isStartedGame ? STARTED_GAME_CARD_CLASS_NAME : ''
            }`}
            aria-pressed={false}
            aria-label={`Открыть описание игры «${game.name || 'Без названия'}»`}
            title={game.name || 'Без названия'}
          >
            <div
              className={`relative w-full overflow-hidden shadow-inner ${
                isStartedGame
                  ? STARTED_GAME_HERO_CLASS_NAME
                  : 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-900'
              }`}
            >
              <GameCardImage
                src={game.image}
                alt={game.name ? `Обложка игры ${game.name}` : 'Обложка игры'}
                className="block w-full h-auto"
                placeholderClassName="flex min-h-[180px] w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400"
              />
            </div>
            <div className="pt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(visibleStatus)}`}
                >
                  {getGameStatusLabel(visibleStatus)}
                </span>
                {game?.isRated === true && (
                  <span className="inline-grid max-w-[9.5rem] shrink-0 place-items-center self-start rounded-full border border-amber-400/75 bg-amber-100 px-2.5 py-1 text-center text-xs font-semibold leading-tight text-amber-700 dark:border-amber-300/60 dark:bg-amber-500/10 dark:text-amber-200">
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
              <p className="text-xs text-slate-500">
                {gamesView === 'past'
                  ? `Факт. старт: ${startDateLabel}`
                  : startDateLabel}
              </p>
              <p className="text-xs text-slate-400">
                {getNounTeams(game.teamsCount)}
              </p>
              {hasParticipation && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">
                  {participationSummary}
                </p>
              )}
              {(canViewThisGameResults ||
                canGenerateThisGameResults ||
                canViewThisGameTasks ||
                hasUserTeamPlace ||
                hasParticipation ||
                canEnterGame ||
                canJoinGame ||
                canCancelRegistration ||
                canBroadcastThisGame ||
                canEditThisGame ||
                canManageThisGame ||
                canManageStatusThisGame ||
                canOpenAgentPanel ||
                canViewGameTeams) && (
                <div className="flex flex-col gap-2 mt-3">
                  {(canJoinGame ||
                    canEnterGame ||
                    canViewThisGameTasks ||
                    canViewThisGameResults ||
                    canGenerateThisGameResults) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {canEnterGame && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(gameEnterHref)
                          }}
                          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-emerald-300/70 bg-emerald-50/80 px-4 py-1.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-400/50 dark:bg-emerald-500/12 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                        >
                          Зайти в игру
                        </button>
                      )}
                      {canJoinGame && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenRegisterModalForGame(game)
                          }}
                          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/70 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/22"
                        >
                          Присоединиться
                        </button>
                      )}
                      {canViewThisGameTasks && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenTasksViewFromGame(game)
                          }}
                          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-violet-300/70 bg-violet-50/80 px-4 py-1.5 text-sm font-semibold text-violet-700 transition hover:border-violet-500 hover:bg-violet-100 dark:border-violet-500/45 dark:bg-violet-500/12 dark:text-violet-200 dark:hover:bg-violet-500/20"
                        >
                          Задания
                        </button>
                      )}
                      {canViewThisGameResults && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenResultsFromGame(game)
                          }}
                          className={resultsButtonClassName}
                          title={
                            isResultsAdminOnly
                              ? 'Результаты скрыты для игроков'
                              : undefined
                          }
                        >
                          Результаты
                        </button>
                      )}
                      {canGenerateThisGameResults && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleGenerateResultsFromGame(game)
                          }}
                          disabled={isGeneratingResults}
                          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-1.5 text-sm font-semibold text-amber-700 transition hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-400/50 dark:bg-amber-500/12 dark:text-amber-200 dark:hover:bg-amber-500/20"
                        >
                          {getGenerateResultsButtonLabel(
                            game,
                            isGeneratingResults,
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {(hasUserTeamPlace || canCancelRegistration) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {hasUserTeamPlace && (
                        <span className="pointer-events-none inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200">
                          Место: {userTeamPlace}
                        </span>
                      )}
                      {canCancelRegistration && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleCancelRegistrationFromGame(game)
                          }}
                          disabled={isCancellingRegistration}
                          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-rose-300/70 bg-rose-50/80 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/50 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
                        >
                          Снять команду с игры
                        </button>
                      )}
                    </div>
                  )}
                  {(canEditThisGame ||
                    canManageThisGame ||
                    canManageStatusThisGame ||
                    canManageHistoryThisGame ||
                    canManageFinancesThisGame ||
                    canBroadcastThisGame ||
                    canOpenAgentPanel ||
                    canViewGameTeams) && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
                      {canOpenAgentPanel && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(
                              `/cabinet/agent?gameId=${encodeURIComponent(
                                game.id,
                              )}`,
                            )
                          }}
                          label="Панель агента"
                          title="Открыть панель агента"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <AgentCardIcon />
                        </CardActionIconButton>
                      )}
                      {canEditThisGame && (
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
                      {canManageThisGame && game.type !== 'story' && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleEditTasksFromList(game)
                          }}
                          label="Редактор заданий"
                          title="Открыть редактор заданий"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <TargetCardIcon />
                        </CardActionIconButton>
                      )}
                      {canManageThisGame && game.type === 'story' && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(
                              `/cabinet/admin/story-editor?gameId=${game.id}`,
                            )
                          }}
                          label="Story-редактор"
                          title="Открыть редактор сценария"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <TargetCardIcon />
                        </CardActionIconButton>
                      )}
                      {canManageStatusThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenStatusModal(game)
                          }}
                          label={getStatusActionLabel(game.status)}
                          title={getStatusActionLabel(game.status)}
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <StatusCardIcon status={game.status} />
                        </CardActionIconButton>
                      )}
                      {canManageFinancesThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenFinancesModal(game)
                          }}
                          label="Финансы игры"
                          title="Открыть финансы игры"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <FinanceCardIcon />
                        </CardActionIconButton>
                      )}
                      {canManageHistoryThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenGameHistoryModal(game)
                          }}
                          label="История игры"
                          title="Открыть историю изменений игры"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <HistoryCardIcon />
                        </CardActionIconButton>
                      )}
                      {canBroadcastThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenPushBroadcastModal(game)
                          }}
                          label="Переписка с командами"
                          title="Открыть переписку с командами"
                          badge={
                            Number(game.adminUnreadMessagesCount || 0) > 99
                              ? '99+'
                              : Number(game.adminUnreadMessagesCount || 0) ||
                                null
                          }
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <ChatCardIcon />
                        </CardActionIconButton>
                      )}
                      {isGameInProgressStatus(game.status) &&
                        canManageThisGame && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(
                                `/cabinet/admin/game-control?gameId=${game.id}`,
                              )
                            }}
                            label="Контроль игры"
                            title="Мониторинг хода игры"
                            className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                          >
                            <GameControlCardIcon />
                          </CardActionIconButton>
                        )}
                      {canManageThisGame && game.type === 'photo' && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(
                              `/cabinet/admin/photo-review?gameId=${game.id}`,
                            )
                          }}
                          label="Проверка фото"
                          title="Проверить фото-ответы"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <TargetCardIcon />
                        </CardActionIconButton>
                      )}
                      {canViewGameTeams && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleManageTeamsFromList(game, !canManageThisGame)
                          }}
                          label={
                            canManageThisGame
                              ? 'Управление командами'
                              : 'Просмотр команд'
                          }
                          title={
                            canManageThisGame
                              ? 'Управление командами'
                              : 'Просмотр команд'
                          }
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
      canOpenGameEditModal,
      canManageGameStatus,
      canEditAllGames,
      canSeeClosedStatus,
      gamesView,
      canViewResultsForGame,
      canViewTasksForGame,
      currentUserDbId,
      currentUserIdString,
      getNounTeams,
      handleCancelRegistrationFromGame,
      handleEditGameFromList,
      handleEditTasksFromList,
      handleOpenFinancesModal,
      handleOpenGameHistoryModal,
      handleManageTeamsFromList,
      handleViewGameTeamsFromList,
      handleOpenPushBroadcastModal,
      handleOpenRegisterModalForGame,
      handleOpenTasksViewFromGame,
      handleOpenResultsFromGame,
      handleGenerateResultsFromGame,
      handleOpenStatusModal,
      canGenerateResultsForGame,
      isGeneratingResults,
      isRegistrationCancellationInProgress,
      handleSelectGameCard,
      router,
      selectedGameId,
    ],
  )

  const gameTypeLabel = useMemo(() => {
    if (!modalGame) {
      return '—'
    }

    const option = ALL_GAME_TYPE_OPTIONS.find(
      (item) => item.value === modalGame.type,
    )
    return option?.label ?? '—'
  }, [modalGame])

  const plannedStartLabel = useMemo(() => {
    if (!modalGame?.dateStart) {
      return 'Дата не назначена'
    }

    try {
      return formatDateInLocationTimeZone(
        modalGame.dateStart,
        modalGame.location,
        {
          dateStyle: 'long',
          timeStyle: 'short',
        },
      )
    } catch {
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

  const availableAgentsForSelect = useMemo(() => {
    if (!modalGame) {
      return []
    }

    const existingIds = new Set(
      selectedGameAgents.map((agent) => agent.userId).filter(Boolean),
    )

    return availableAgents.filter((agent) => !existingIds.has(agent.id))
  }, [availableAgents, modalGame, selectedGameAgents])

  const availableOrganizersForSelect = useMemo(() => {
    const organizersMap = new Map()
    const organizerUsers = Array.isArray(organizersQuery.data)
      ? organizersQuery.data
      : []

    organizerUsers.forEach((user) => {
      const role = String(user?.role || '')
        .trim()
        .toLowerCase()
      if (role !== 'admin' && role !== 'dev') {
        return
      }

      const userId = String(user?.id || user?._id || '').trim()
      if (!userId) {
        return
      }

      organizersMap.set(userId, {
        id: userId,
        telegramId: String(user?.telegramId || '').trim(),
        name: typeof user?.name === 'string' ? user.name : '',
        username: typeof user?.username === 'string' ? user.username : '',
      })
    })

    selectedGameModerators.forEach((moderator) => {
      const userId =
        typeof moderator === 'string'
          ? moderator.trim()
          : String(moderator?.id || '').trim()
      if (!userId || organizersMap.has(userId)) {
        return
      }

      organizersMap.set(userId, {
        id: userId,
        telegramId:
          typeof moderator === 'string'
            ? ''
            : String(moderator?.telegramId || '').trim(),
        name:
          typeof moderator === 'string'
            ? ''
            : typeof moderator?.name === 'string'
              ? moderator.name
              : '',
        username:
          typeof moderator === 'string'
            ? ''
            : typeof moderator?.username === 'string'
              ? moderator.username
              : '',
      })
    })

    const currentOrganizerUserId = String(
      modalGame?.creatorUserId || modalGame?.creator?.id || '',
    ).trim()
    const currentOrganizer = modalGame?.creator

    if (currentOrganizerUserId && !organizersMap.has(currentOrganizerUserId)) {
      organizersMap.set(currentOrganizerUserId, {
        id: currentOrganizerUserId,
        telegramId: String(
          currentOrganizer?.telegramId || modalGame?.creatorTelegramId || '',
        ).trim(),
        name:
          typeof currentOrganizer?.name === 'string'
            ? currentOrganizer.name
            : '',
        username:
          typeof currentOrganizer?.username === 'string'
            ? currentOrganizer.username
            : '',
      })
    }

    return Array.from(organizersMap.values()).sort((left, right) =>
      String(left?.name || '').localeCompare(String(right?.name || ''), 'ru', {
        sensitivity: 'base',
      }),
    )
  }, [modalGame, organizersQuery.data, selectedGameModerators])

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
  const selectedGameParticipationTeams = useMemo(
    () => getUserParticipationTeams(selectedGame),
    [selectedGame],
  )
  const selectedGameCaptainParticipationTeams = useMemo(
    () => selectedGameParticipationTeams.filter((entry) => entry.isCaptain),
    [selectedGameParticipationTeams],
  )
  const selectedGameParticipationSummaryLabel = useMemo(() => {
    if (selectedGameParticipationTeams.length === 0) {
      return ''
    }

    const teamNames = selectedGameParticipationTeams.map(
      (entry) => entry.teamName || entry.teamId,
    )
    return `Вы участвуете в составе: ${teamNames.join(', ')}`
  }, [selectedGameParticipationTeams])
  const canJoinSelectedGame = useMemo(
    () =>
      Boolean(selectedGame?.id) &&
      selectedGameParticipationTeams.length === 0 &&
      canJoinGameByStatus(selectedGame?.status) &&
      Boolean(selectedGame?.registrationOpen ?? true) &&
      Boolean(currentUserDbId),
    [currentUserDbId, selectedGame, selectedGameParticipationTeams.length],
  )
  const canCancelSelectedGameRegistration = useMemo(
    () =>
      Boolean(selectedGame?.id) &&
      selectedGameCaptainParticipationTeams.length > 0 &&
      isActiveGameStatus(selectedGame?.status),
    [selectedGame, selectedGameCaptainParticipationTeams.length],
  )
  const selectedGameEnterHref = useMemo(
    () =>
      resolveGameEntryHrefFromGame({
        game: selectedGame,
        fallbackLocation: location,
      }),
    [location, selectedGame],
  )
  const canEnterSelectedGame = useMemo(
    () =>
      Boolean(selectedGame?.id) &&
      selectedGameParticipationTeams.length > 0 &&
      (isGameInProgressStatus(selectedGame?.status) ||
        (Boolean(selectedGame?.showEnterButton) &&
          isActiveGameStatus(selectedGame?.status))) &&
      Boolean(selectedGameEnterHref),
    [
      selectedGame,
      selectedGameEnterHref,
      selectedGameParticipationTeams.length,
    ],
  )
  const isSelectedGameRegistrationCancelling = useMemo(
    () =>
      Boolean(selectedGame?.id) &&
      isRegistrationCancellationInProgress(selectedGame.id),
    [isRegistrationCancellationInProgress, selectedGame],
  )
  const handleJoinSelectedGameFromDescription = useCallback(() => {
    if (!selectedGame) {
      return
    }

    handleOpenRegisterModalForGame(selectedGame)
  }, [handleOpenRegisterModalForGame, selectedGame])
  const handleCancelSelectedGameRegistrationFromDescription =
    useCallback(() => {
      if (!selectedGame) {
        return
      }

      handleCancelRegistrationFromGame(selectedGame)
    }, [handleCancelRegistrationFromGame, selectedGame])
  const handleEnterSelectedGameFromDescription = useCallback(() => {
    if (!selectedGameEnterHref) {
      return
    }
    router.push(selectedGameEnterHref)
  }, [router, selectedGameEnterHref])

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

  const financesSummary = useMemo(
    () => buildGameFinancesSummary(modalGame?.finances),
    [modalGame?.finances],
  )

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
            </div>
            {shouldShowLocationFilter && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenedGamesFilterPanel((prev) =>
                        prev === 'city' ? null : 'city',
                      )
                    }
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isCityFilterPanelOpen
                        ? 'bg-primary text-white'
                        : 'border border-slate-200 bg-slate-100/90 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                    aria-expanded={isCityFilterPanelOpen}
                    aria-controls="games-city-filter-panel"
                  >
                    {gamesCityFilterLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenedGamesFilterPanel((prev) =>
                        prev === 'season' ? null : 'season',
                      )
                    }
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isSeasonFilterPanelOpen
                        ? 'bg-primary text-white'
                        : 'border border-slate-200 bg-slate-100/90 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                    aria-expanded={isSeasonFilterPanelOpen}
                    aria-controls="games-season-filter-panel"
                  >
                    {gamesSeasonFilterLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenedGamesFilterPanel((prev) =>
                        prev === 'type' ? null : 'type',
                      )
                    }
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isTypeFilterPanelOpen
                        ? 'bg-primary text-white'
                        : 'border border-slate-200 bg-slate-100/90 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                    aria-expanded={isTypeFilterPanelOpen}
                    aria-controls="games-type-filter-panel"
                  >
                    {gamesTypeFilterLabel}
                  </button>
                  {canFilterCanceledGames && (
                    <button
                      type="button"
                      onClick={() => setShowCanceledGames((prev) => !prev)}
                      className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                        showCanceledGames
                          ? 'bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400'
                          : 'border border-slate-200 bg-slate-100/90 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                      aria-pressed={showCanceledGames}
                    >
                      {showCanceledGames ? '✓ ' : ''}
                      Отменённые
                    </button>
                  )}
                </div>

                {isCityFilterPanelOpen && (
                  <div
                    id="games-city-filter-panel"
                    className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-primary dark:text-slate-100">
                        Город
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenedGamesFilterPanel(null)}
                        className="text-sm font-semibold transition text-rose-500 hover:text-rose-400"
                      >
                        Скрыть
                      </button>
                    </div>
                    <div className="pr-1 mt-3 space-y-1 overflow-y-auto max-h-64">
                      {gameLocationOptions.map((item) => {
                        const isSelected = gamesFilterLocation === item.key
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              setGamesFilterLocation(item.key)
                              setOpenedGamesFilterPanel(null)
                            }}
                            className="flex items-center w-full gap-3 px-2 py-2 text-sm text-left transition rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
                          >
                            <span
                              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-xs font-bold ${
                                isSelected
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-slate-400 bg-transparent text-transparent dark:border-slate-500'
                              }`}
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                            <span>{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isSeasonFilterPanelOpen && (
                  <div
                    id="games-season-filter-panel"
                    className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-primary dark:text-slate-100">
                        Сезон
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPastGamesSeasonFilter(PAST_GAMES_SEASON_FILTER_ALL)
                          setOpenedGamesFilterPanel(null)
                        }}
                        className="text-sm font-semibold transition text-rose-500 hover:text-rose-400"
                      >
                        Сбросить
                      </button>
                    </div>
                    <div className="pr-1 mt-3 space-y-1 overflow-y-auto max-h-64">
                      {pastGamesSeasonOptions.map((option) => {
                        const isSelected =
                          pastGamesSeasonFilter === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setPastGamesSeasonFilter(option.value)
                              setOpenedGamesFilterPanel(null)
                            }}
                            className="flex items-center w-full gap-3 px-2 py-2 text-sm text-left transition rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
                          >
                            <span
                              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-xs font-bold ${
                                isSelected
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-slate-400 bg-transparent text-transparent dark:border-slate-500'
                              }`}
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                            <span>{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isTypeFilterPanelOpen && (
                  <div
                    id="games-type-filter-panel"
                    className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-primary dark:text-slate-100">
                        Тип игры
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setGamesTypeFilter(GAMES_TYPE_FILTER_ALL)
                          setOpenedGamesFilterPanel(null)
                        }}
                        className="text-sm font-semibold transition text-rose-500 hover:text-rose-400"
                      >
                        Сбросить
                      </button>
                    </div>
                    <div className="pr-1 mt-3 space-y-1 overflow-y-auto max-h-64">
                      {GAME_TYPE_FILTER_OPTIONS.map((option) => {
                        const isSelected = gamesTypeFilter === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setGamesTypeFilter(option.value)
                              setOpenedGamesFilterPanel(null)
                            }}
                            className="flex items-center w-full gap-3 px-2 py-2 text-sm text-left transition rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
                          >
                            <span
                              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-xs font-bold ${
                                isSelected
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-slate-400 bg-transparent text-transparent dark:border-slate-500'
                              }`}
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                            <span>{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {locationFilterError && (
                  <p className="mt-2 text-xs text-rose-500">
                    {locationFilterError}
                  </p>
                )}
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
                {!isPastView && filteredUpcomingGames.length > 0 && (
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
                      {filteredUpcomingGames.map((game) =>
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
                {((isUpcomingView && filteredUpcomingGames.length === 0) ||
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
                Для выбранного города пока нет игр.
              </div>
            )}
          </div>

          <div className="md:col-span-5">
            <div className="space-y-6">
              <GameModals
                selectedGame={selectedGame}
                editGame={editingGame}
                isEditModalOpen={isEditModalOpen}
                handleCloseEditModal={handleCloseEditModal}
                isTasksModalOpen={isTasksModalOpen}
                handleCloseTasksModal={handleCloseTasksModal}
                canEditSelectedGame={canEditSelectedGame}
                isSaving={isSaving}
                location={selectedGameApiLocation}
                isDirty={isDirty}
                handleModalPrimaryAction={handleModalPrimaryAction}
                handleTasksModalPrimaryAction={handleTasksModalPrimaryAction}
                handleResetChanges={handleResetChanges}
                updateSelectedGame={updateSelectedGame}
                GAME_TYPE_OPTIONS={availableGameTypeOptions}
                CLUE_EARLY_MODE_OPTIONS={CLUE_EARLY_MODE_OPTIONS}
                toMinutes={toMinutes}
                toSeconds={toSeconds}
                handleAddTask={handleAddTask}
                handleReorderTask={handleReorderTask}
                isTaskReorderLocked={isTaskReorderLocked}
                startedGameLockedTaskCount={startedGameLockedTaskCount}
                handleRemoveTask={handleRemoveTask}
                handleTaskFieldChange={handleTaskFieldChange}
                handleTaskNumberChange={handleTaskNumberChange}
                handleTaskOptionalNumberChange={handleTaskOptionalNumberChange}
                handleTaskCheckboxChange={handleTaskCheckboxChange}
                handleTaskCoordinateChange={handleTaskCoordinateChange}
                handleAddTaskCode={handleAddTaskCode}
                handleTaskCodeChange={handleTaskCodeChange}
                handleTaskCodePhotoChange={handleTaskCodePhotoChange}
                handleRemoveTaskCode={handleRemoveTaskCode}
                handleAddTaskImage={handleAddTaskImage}
                handleTaskImageChange={handleTaskImageChange}
                handleRemoveTaskImage={handleRemoveTaskImage}
                handleAddClue={handleAddClue}
                handleReorderClue={handleReorderClue}
                handleTaskClueChange={handleTaskClueChange}
                handleRemoveClue={handleRemoveClue}
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
                isFinancesModalOpen={isFinancesModalOpen}
                handleCloseFinancesModal={handleCloseFinancesModal}
                handleFinancesModalPrimaryAction={
                  handleFinancesModalPrimaryAction
                }
                isGameHistoryModalOpen={isGameHistoryModalOpen}
                handleCloseGameHistoryModal={handleCloseGameHistoryModal}
                handleGameHistoryRollbackSuccess={
                  handleGameHistoryRollbackSuccess
                }
                canGenerateResults={canGenerateResults}
                isGeneratingResults={isGeneratingResults}
                handleGenerateResults={handleGenerateResults}
                generateResultsButtonLabel={getGenerateResultsButtonLabel(
                  selectedGame,
                  isGeneratingResults,
                )}
                currencyFormatter={currencyFormatter}
                financesSummary={financesSummary}
                balanceClass={balanceClass}
                expandedTaskIds={expandedTaskIds}
                toggleTaskExpansion={toggleTaskExpansion}
                isTeamsModalOpen={isTeamsModalOpen}
                handleCloseTeamsModal={handleCloseTeamsModal}
                teamsModalState={teamsModalState}
                removingTeamIds={removingTeamIds}
                updatingOutOfCompetitionTeamIds={
                  updatingOutOfCompetitionTeamIds
                }
                updatingPaidGameTeamIds={updatingPaidGameTeamIds}
                selectedTeamToAdd={selectedTeamToAdd}
                setSelectedTeamToAdd={setSelectedTeamToAdd}
                handleAddTeamToGame={handleAddTeamToGame}
                isAddingTeam={isAddingTeam}
                handleRemoveTeamFromGame={handleRemoveTeamFromGame}
                handleToggleTeamOutOfCompetition={
                  handleToggleTeamOutOfCompetition
                }
                handleToggleTeamPaidGame={handleToggleTeamPaidGame}
                handleRefreshTeamsModalData={loadTeamsModalData}
                isTeamsModalReadOnly={isTeamsModalReadOnly}
                isRegisterModalOpen={isRegisterModalOpen}
                handleCloseRegisterModal={handleCloseRegisterModal}
                isRegisterSubmitting={isRegisterSubmitting}
                handleSubmitRegister={handleSubmitRegister}
                registerTeamId={registerTeamId}
                registerGameId={registerGameId}
                setRegisterTeamId={setRegisterTeamId}
                setRegisterGameId={setRegisterGameId}
                isRegisterModalFromCard={isRegisterModalFromCard}
                registerModalGameName={registerModalGameName}
                shouldHideRegisterGameIdField={Boolean(isRegisterModalFromCard)}
                registerFeedback={registerFeedback}
                isRegisterTeamsLoading={isRegisterTeamsLoading}
                registerTeams={registerTeams}
                currentUserId={currentUserDbId}
                currentUserRole={userRole}
                canViewCodePhotos={canViewCodePhotos}
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
                isTasksViewModalOpen={isTasksViewModalOpen}
                handleCloseTasksViewModal={handleCloseTasksViewModal}
                gameTypeLabel={gameTypeLabel}
                plannedStartLabel={plannedStartLabel}
                canViewRestrictedGameInfo={canViewRestrictedGameInfo}
                canViewGameResults={canViewGameResults}
                handleOpenResultsModal={() => {
                  if (selectedGame) {
                    handleOpenResultsFromGame(selectedGame)
                  }
                }}
                participationSummaryLabel={
                  selectedGameParticipationSummaryLabel
                }
                canJoinGameFromDescription={canJoinSelectedGame}
                canEnterGameFromDescription={canEnterSelectedGame}
                canCancelGameRegistrationFromDescription={
                  canCancelSelectedGameRegistration
                }
                handleJoinGameFromDescription={
                  handleJoinSelectedGameFromDescription
                }
                handleEnterGameFromDescription={
                  handleEnterSelectedGameFromDescription
                }
                handleCancelGameRegistrationFromDescription={
                  handleCancelSelectedGameRegistrationFromDescription
                }
                isGameRegistrationSubmittingFromDescription={
                  isSelectedGameRegistrationCancelling
                }
                selectedGameModerators={selectedGameModerators}
                availableModeratorsForSelect={availableModeratorsForSelect}
                availableModeratorsMap={availableModeratorsMap}
                availableOrganizersForSelect={availableOrganizersForSelect}
                selectedModeratorToAdd={selectedModeratorToAdd}
                setSelectedModeratorToAdd={setSelectedModeratorToAdd}
                handleAddModerator={handleAddModerator}
                handleRemoveModerator={handleRemoveModerator}
                selectedGameAgents={selectedGameAgents}
                availableAgentsForSelect={availableAgentsForSelect}
                availableAgentsMap={availableAgentsMap}
                selectedAgentToAdd={selectedAgentToAdd}
                setSelectedAgentToAdd={setSelectedAgentToAdd}
                handleAddAgent={handleAddAgent}
                handleRemoveAgent={handleRemoveAgent}
                editGameLocationOptions={gameLocationOptions}
                editGameSeasons={editGameSeasons}
                isEditGameSeasonsLoading={isEditGameSeasonsLoading}
                isEditGameSeasonCreating={Boolean(
                  editingGame?.location &&
                  creatingSeasonByLocation[
                    String(editingGame.location).trim().toLowerCase()
                  ],
                )}
                handleCreateSeasonForEditGame={handleCreateSeasonForEditGame}
                handleSaveAndOpenTaskPreview={handleSaveAndOpenTaskPreview}
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
                progressMessage={statusProgressMessage}
              />
              <GamePushBroadcastModal
                isOpen={isPushBroadcastModalOpen}
                onClose={handleClosePushBroadcastModal}
                gameId={pushBroadcastModalGame?.id || ''}
                gameName={pushBroadcastModalGame?.name || ''}
                gameStatus={pushBroadcastModalGame?.status || ''}
                onFeedback={setFeedback}
              />
              <style jsx global>{`
                @keyframes aqStartedGameCardEnter {
                  0% {
                    opacity: 0.92;
                    transform: translateY(-4px) scale(0.988);
                  }
                  100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }

                .aq-started-game-card {
                  animation: aqStartedGameCardEnter 200ms ease-in-out;
                }

                .aq-started-game-card > * {
                  position: relative;
                  z-index: 1;
                }

                .aq-started-game-card::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  bottom: 0;
                  left: -42%;
                  width: 38%;
                  z-index: 2;
                  pointer-events: none;
                  background: linear-gradient(
                    120deg,
                    rgba(255, 255, 255, 0) 0%,
                    rgba(255, 255, 255, 0.32) 28%,
                    rgba(236, 253, 245, 0.82) 50%,
                    rgba(255, 255, 255, 0.24) 72%,
                    rgba(255, 255, 255, 0) 100%
                  );
                  transform: skewX(-20deg);
                  filter: blur(0.5px);
                  animation: aq-toast-sheen 3.2s ease-in-out 180ms infinite;
                }

                .dark .aq-started-game-card::before {
                  background: linear-gradient(
                    120deg,
                    rgba(255, 255, 255, 0) 0%,
                    rgba(170, 240, 255, 0.18) 28%,
                    rgba(170, 240, 255, 0.34) 50%,
                    rgba(170, 240, 255, 0.16) 72%,
                    rgba(255, 255, 255, 0) 100%
                  );
                }
              `}</style>
            </div>
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
  clueRich: PropTypes.string,
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
  image: PropTypes.string,
})

const bonusCodeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  mongoId: PropTypes.string,
  code: PropTypes.string,
  bonus: PropTypes.number,
  description: PropTypes.string,
  image: PropTypes.string,
})

const coordinatesShape = PropTypes.shape({
  latitude: PropTypes.number,
  longitude: PropTypes.number,
  radius: PropTypes.number,
})

const taskMediaShape = PropTypes.shape({
  id: PropTypes.string,
  type: PropTypes.oneOf(['image', 'audio', 'video']),
  url: PropTypes.string,
  mime: PropTypes.string,
  size: PropTypes.number,
  duration: PropTypes.number,
  path: PropTypes.string,
  title: PropTypes.string,
})

const moderatorShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  username: PropTypes.string,
  telegramId: PropTypes.string,
})

const userParticipationTeamShape = PropTypes.shape({
  teamId: PropTypes.string.isRequired,
  gameTeamId: PropTypes.string,
  teamName: PropTypes.string,
  isCaptain: PropTypes.bool,
  prequelProgress: PropTypes.object,
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
      descriptionRich: PropTypes.string,
      descriptionMedia: PropTypes.arrayOf(taskMediaShape),
      image: PropTypes.string,
      startingPlace: PropTypes.string,
      finishingPlace: PropTypes.string,
      showFinishingPlace: PropTypes.bool,
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
      taskDistributionMode: PropTypes.oneOf(['linear', 'random']),
      taskDistributionTemplate: PropTypes.arrayOf(
        PropTypes.arrayOf(PropTypes.number),
      ),
      individualStart: PropTypes.bool,
      isRated: PropTypes.bool,
      hidden: PropTypes.bool,
      showCreator: PropTypes.bool,
      showTasks: PropTypes.bool,
      hideResult: PropTypes.bool,
      registrationOpen: PropTypes.bool,
      maxTeamPlayers: PropTypes.number,
      prices: PropTypes.arrayOf(priceShape),
      finances: PropTypes.arrayOf(financeShape),
      tasks: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          mongoId: PropTypes.string,
          title: PropTypes.string,
          task: PropTypes.string,
          howToSolve: PropTypes.string,
          taskRich: PropTypes.string,
          taskMedia: PropTypes.arrayOf(taskMediaShape),
          taskBonusForComplite: PropTypes.number,
          clues: PropTypes.arrayOf(clueShape),
          subTasks: PropTypes.arrayOf(subTaskShape),
          images: PropTypes.arrayOf(PropTypes.string),
          codes: PropTypes.arrayOf(PropTypes.string),
          codePhotos: PropTypes.arrayOf(PropTypes.string),
          coordinates: coordinatesShape,
          penaltyCodes: PropTypes.arrayOf(penaltyCodeShape),
          bonusCodes: PropTypes.arrayOf(bonusCodeShape),
          numCodesToCompliteTask: PropTypes.number,
          postMessage: PropTypes.string,
          postMessageRich: PropTypes.string,
          postMessageMedia: PropTypes.arrayOf(taskMediaShape),
          canceled: PropTypes.bool,
          isBonusTask: PropTypes.bool,
        }),
      ),
      teamsCount: PropTypes.number,
      userTeamPlace: PropTypes.number,
      userParticipationTeams: PropTypes.arrayOf(userParticipationTeamShape),
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
  forcedView: PropTypes.oneOfType([
    PropTypes.oneOf(['all', 'upcoming', 'past']),
    PropTypes.oneOf([null]),
  ]),
  session: PropTypes.object,
  availableModerators: PropTypes.arrayOf(moderatorShape),
}

GamesPage.defaultProps = {
  initialGames: [],
  initialHasMore: false,
  initialLocation: null,
  forcedView: null,
  session: null,
  availableModerators: [],
}

export default GamesPage
