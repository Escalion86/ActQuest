'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import SelectableCard from '@components/cabinet/SelectableCard'
import CardActionIconButton, {
  EditCardIcon,
  MegaphoneCardIcon,
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
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { toStringId } from '@helpers/idAndDate'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import requestApiJson from '@helpers/requestApiJson'
import { resolveGameEntryHrefFromGame } from '@helpers/resolveGameEntryHref'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import { getNounTeams } from '@helpers/getNoun'
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
const CABINET_GAMES_LIST_API_BASE = '/api/cabinet/games-list'
const CABINET_TEAMS_API_BASE = '/api/cabinet/teams'
const CABINET_SEASONS_API_BASE = '/api/cabinet/seasons'
const CABINET_USER_DETAILS_API_BASE = '/api/cabinet/user-details'
const CABINET_GAMES_API_BASE = '/api/cabinet/games'
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

const normalizeGamesViewValue = (value) =>
  value === 'upcoming' || value === 'past' ? value : 'all'

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
  taskRich: '',
  taskMedia: [],
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

const normalizePlainTextForComparison = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const hasMeaningfulRichMarkup = (value) =>
  /<(?!\/?(p|br|div|span)\b)[^>]+>/i.test(String(value || ''))

const normalizeRichParagraphContent = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const extractParagraphSegmentsFromRich = (rich) => {
  const richValue = String(rich || '')
  const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
  const segments = []
  let match = paragraphPattern.exec(richValue)

  while (match) {
    segments.push(normalizeRichParagraphContent(match[1] || ''))
    match = paragraphPattern.exec(richValue)
  }

  if (segments.length > 0) {
    return segments
  }

  const normalized = normalizePlainTextForComparison(
    stripHtmlToPlainText(richValue),
  )
  return normalized ? normalized.split('\n\n') : []
}

const extractParagraphSegmentsFromPlain = (plain) => {
  const normalized = normalizePlainTextForComparison(plain)
  return normalized ? normalized.split('\n\n') : []
}

const areParagraphSegmentsEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false
  }

  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

const normalizeRichTextForComparison = (richValue, plainValue) => {
  const rich = typeof richValue === 'string' ? richValue.trim() : ''
  if (!rich) {
    return ''
  }

  if (!hasMeaningfulRichMarkup(rich)) {
    const richSegments = extractParagraphSegmentsFromRich(rich)
    const plainSegments = extractParagraphSegmentsFromPlain(plainValue || '')

    if (areParagraphSegmentsEqual(richSegments, plainSegments)) {
      return ''
    }
  }

  const normalizedPlain = normalizePlainTextForComparison(plainValue || '')
  const normalizedRichPlain = normalizePlainTextForComparison(
    stripHtmlToPlainText(rich),
  )

  if (
    normalizedRichPlain === normalizedPlain &&
    !hasMeaningfulRichMarkup(rich)
  ) {
    return ''
  }

  return rich
}

const normalizePayloadForComparison = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  const normalizedTasks = (
    Array.isArray(payload.tasks) ? payload.tasks : []
  ).map((task) => ({
    ...task,
    task: normalizePlainTextForComparison(task?.task || ''),
    taskRich: normalizeRichTextForComparison(task?.taskRich, task?.task),
    clues: (Array.isArray(task?.clues) ? task.clues : []).map((clue) => ({
      ...clue,
      clue: normalizePlainTextForComparison(clue?.clue || ''),
      clueRich: normalizeRichTextForComparison(clue?.clueRich, clue?.clue),
    })),
  }))

  return {
    ...payload,
    description: normalizePlainTextForComparison(payload.description || ''),
    descriptionRich: normalizeRichTextForComparison(
      payload.descriptionRich,
      payload.description,
    ),
    tasks: normalizedTasks,
  }
}

const isActiveGameStatus = (status) =>
  (typeof status === 'string' ? status.toLowerCase() : String(status)) ===
  'active'

const isGameInProgressStatus = (status) =>
  (typeof status === 'string' ? status.toLowerCase() : String(status)) ===
  'started'

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
        teamName:
          typeof entry?.teamName === 'string' ? entry.teamName.trim() : '',
        isCaptain: Boolean(entry?.isCaptain),
      }
    })
    .filter(Boolean)

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

  const payload = buildUpdatePayload({
    ...game,
    prices: game.prices ?? [],
    finances: game.finances ?? [],
    tasks: game.tasks ?? [],
  })

  return JSON.stringify(normalizePayloadForComparison(payload))
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
          url: typeof media?.url === 'string' ? media.url.trim() : '',
          mime: typeof media?.mime === 'string' ? media.mime.trim() : '',
          size: Number(media?.size) || 0,
          duration: Number(media?.duration) || 0,
          path: typeof media?.path === 'string' ? media.path.trim() : '',
          title: typeof media?.title === 'string' ? media.title.trim() : '',
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
    registrationOpen: Boolean(game.registrationOpen ?? true),
    maxTeamPlayers: toNullableNumber(game.maxTeamPlayers),
    prices,
    finances,
    tasks,
    moderators: Array.from(moderatorsSet),
    ...(Number.isFinite(Number(game.creatorTelegramId))
      ? { creatorTelegramId: Number(game.creatorTelegramId) }
      : {}),
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
  const canEditOwnGames = userRole === 'moder'
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
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [statusModalGameId, setStatusModalGameId] = useState('')
  const [statusValidationResult, setStatusValidationResult] = useState(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [editingBaselineGame, setEditingBaselineGame] = useState(null)
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
  const [isTeamsModalReadOnly, setIsTeamsModalReadOnly] = useState(false)
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
  const [resultsCacheByGameId, setResultsCacheByGameId] = useState({})
  const [isGeneratingResults, setIsGeneratingResults] = useState(false)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [registerGameId, setRegisterGameId] = useState('')
  const [isRegisterModalFromCard, setIsRegisterModalFromCard] = useState(false)
  const [registerModalGameName, setRegisterModalGameName] = useState('')
  const [registerTeamId, setRegisterTeamId] = useState('')
  const [registerTeams, setRegisterTeams] = useState([])
  const [isRegisterTeamsLoading, setIsRegisterTeamsLoading] = useState(false)
  const [registerFeedback, setRegisterFeedback] = useState(null)
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false)
  const [cancellingRegistrationGameIds, setCancellingRegistrationGameIds] =
    useState([])
  const [isPushBroadcastModalOpen, setIsPushBroadcastModalOpen] =
    useState(false)
  const [pushBroadcastGameId, setPushBroadcastGameId] = useState('')
  const [pushBroadcastMode, setPushBroadcastMode] =
    useState('announce_all_users')
  const [pushBroadcastMessage, setPushBroadcastMessage] = useState('')
  const [isPushBroadcastSubmitting, setIsPushBroadcastSubmitting] =
    useState(false)
  const [pushBroadcastFeedback, setPushBroadcastFeedback] = useState(null)
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
  const isFilteredGamesView = isUpcomingView || isPastView
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
  const registerApiLocation = isFilteredGamesView
    ? shouldShowLocationFilter
      ? gamesFilterLocation
      : location
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
    if (!isEditModalOpen && !isTasksModalOpen) {
      setEditingGame(null)
      setEditingBaselineGame(null)
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
  }, [isEditModalOpen, isTasksModalOpen, selectedGameId])

  useEffect(() => {
    const requestedGameId = searchParams?.get('gameId')

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
    setIsTasksModalOpen(false)
    setIsTeamsModalOpen(false)
    setIsTasksViewModalOpen(false)

    const nextQuery = new URLSearchParams(searchParams?.toString() || '')
    nextQuery.delete('gameId')
    const nextUrl = nextQuery.toString()
      ? `${pathname}?${nextQuery.toString()}`
      : pathname
    router.replace(nextUrl, { scroll: false })
  }, [games, pathname, router, searchParams])

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
        return [...validItems].sort((first, second) => {
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
        `${CABINET_GAMES_LIST_API_BASE}?${params.toString()}`,
        {
          fallbackMessage: 'Не удалось загрузить список игр',
        },
      )

      const nextGames = Array.isArray(json?.data)
        ? json.data.filter((game) => game !== null && game !== undefined)
        : []
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

  useEffect(() => {
    if (shouldShowLocationFilter) {
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
          locationValue: location,
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
          extractErrorMessage(error) || 'Не удалось загрузить список игр.',
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
  }, [fetchGamesPage, location, shouldShowLocationFilter])

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

  const resetRegisterForm = useCallback((nextGameId = '') => {
    setRegisterGameId(nextGameId)
    setRegisterTeamId('')
    setRegisterFeedback(null)
  }, [])

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
    } else {
      setIsRegisterSubmitting(false)
    }
  }, [isRegisterModalOpen, loadRegisterTeams])

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
      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(trimmedGameId)}/teams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: registerTeamId,
          }),
          fallbackMessage: 'Не удалось зарегистрироваться на игру',
        },
      )

      setRegisterFeedback({
        type: 'success',
        message: `Команда «${selectedTeam.name || 'без названия'}» зарегистрирована на игру`,
      })

      setGames((prev) =>
        prev.map((game) => {
          if (game.id !== trimmedGameId) {
            return game
          }

          const nextParticipationTeams = getUserParticipationTeams(game)
          const hasTeamAlready = nextParticipationTeams.some(
            (entry) => entry.teamId === registerTeamId,
          )

          if (!hasTeamAlready) {
            nextParticipationTeams.push({
              teamId: registerTeamId,
              teamName:
                typeof selectedTeam?.name === 'string'
                  ? selectedTeam.name.trim()
                  : '',
              isCaptain: true,
            })
          }

          return {
            ...game,
            teamsCount: (game.teamsCount ?? 0) + 1,
            userParticipationTeams: nextParticipationTeams,
          }
        }),
      )

      setPersistedGames((prev) =>
        prev.map((game) => {
          if (game.id !== trimmedGameId) {
            return game
          }

          const nextParticipationTeams = getUserParticipationTeams(game)
          const hasTeamAlready = nextParticipationTeams.some(
            (entry) => entry.teamId === registerTeamId,
          )

          if (!hasTeamAlready) {
            nextParticipationTeams.push({
              teamId: registerTeamId,
              teamName:
                typeof selectedTeam?.name === 'string'
                  ? selectedTeam.name.trim()
                  : '',
              isCaptain: true,
            })
          }

          return {
            ...game,
            teamsCount: (game.teamsCount ?? 0) + 1,
            userParticipationTeams: nextParticipationTeams,
          }
        }),
      )

      setFeedback({
        type: 'success',
        message: `Команда «${selectedTeam.name || 'без названия'}» зарегистрирована на игру`,
      })
      setIsRegisterModalOpen(false)
      setIsRegisterModalFromCard(false)
      setRegisterModalGameName('')
      setRegisterTeams([])
      setIsRegisterTeamsLoading(false)
      resetRegisterForm()
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
    registerGameId,
    registerTeamId,
    registerTeams,
    resetRegisterForm,
    setGames,
    setFeedback,
    setPersistedGames,
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
    setPushBroadcastMode('announce_all_users')
    setPushBroadcastMessage('')
    setPushBroadcastFeedback(null)
    setIsPushBroadcastModalOpen(true)
  }, [])

  const handleClosePushBroadcastModal = useCallback(() => {
    if (isPushBroadcastSubmitting) {
      return
    }

    setIsPushBroadcastModalOpen(false)
    setPushBroadcastFeedback(null)
    setPushBroadcastMessage('')
    setPushBroadcastMode('announce_all_users')
    setPushBroadcastGameId('')
  }, [isPushBroadcastSubmitting])

  const handleSubmitPushBroadcast = useCallback(async () => {
    if (!pushBroadcastModalGame?.id) {
      setPushBroadcastFeedback({
        type: 'error',
        message: 'Игра для рассылки не найдена',
      })
      return
    }

    if (
      pushBroadcastMode === 'custom_for_registered' &&
      !pushBroadcastMessage.trim()
    ) {
      setPushBroadcastFeedback({
        type: 'error',
        message: 'Введите сообщение для зарегистрированных участников',
      })
      return
    }

    setIsPushBroadcastSubmitting(true)
    setPushBroadcastFeedback(null)

    try {
      const { json } = await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
          pushBroadcastModalGame.id,
        )}/push-broadcast`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: pushBroadcastMode,
            message: pushBroadcastMessage.trim(),
          }),
          fallbackMessage: 'Не удалось отправить уведомления',
        },
      )

      const usersMatched = Number(json?.data?.usersMatched) || 0
      const notificationsCreated = Number(json?.data?.notificationsCreated) || 0
      const pushDelivered = Number(json?.data?.pushDelivered) || 0

      const successMessage =
        pushBroadcastMode === 'announce_all_users'
          ? `Анонс отправлен: получателей ${usersMatched}, уведомлений ${notificationsCreated}, push доставлено ${pushDelivered}`
          : `Сообщение отправлено зарегистрированным командам: получателей ${usersMatched}, уведомлений ${notificationsCreated}, push доставлено ${pushDelivered}`

      setPushBroadcastFeedback({
        type: 'success',
        message: successMessage,
      })
      setFeedback({ type: 'success', message: successMessage })
      setIsPushBroadcastModalOpen(false)
      setPushBroadcastMessage('')
      setPushBroadcastMode('announce_all_users')
      setPushBroadcastGameId('')
    } catch (error) {
      const message =
        extractErrorMessage(error) || 'Не удалось отправить уведомления'

      setPushBroadcastFeedback({
        type: 'error',
        message,
      })
      setFeedback({ type: 'error', message })
    } finally {
      setIsPushBroadcastSubmitting(false)
    }
  }, [
    pushBroadcastMessage,
    pushBroadcastModalGame?.id,
    pushBroadcastMode,
    setFeedback,
  ])

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
          ? `Отменить регистрацию команд ${teamsLabel} на игру «${game.name || 'Без названия'}»?`
          : `Отменить регистрацию команды ${teamsLabel} на игру «${game.name || 'Без названия'}»?`

      if (typeof window !== 'undefined') {
        const isConfirmed = window.confirm(confirmMessage)
        if (!isConfirmed) {
          return
        }
      }

      setCancellingRegistrationGameIds((prev) =>
        prev.includes(game.id) ? prev : [...prev, game.id],
      )

      try {
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
            fallbackMessage: 'Не удалось отменить регистрацию команды',
          },
        )

        const applyCancellationToGame = (gameItem) => {
          if (!gameItem || gameItem.id !== game.id) {
            return gameItem
          }

          const nextParticipationTeams = getUserParticipationTeams(
            gameItem,
          ).filter((entry) => !captainTeamIds.has(entry.teamId))

          return {
            ...gameItem,
            teamsCount: Math.max(
              0,
              (Number(gameItem.teamsCount) || 0) - teamIdsToDelete.length,
            ),
            userParticipationTeams: nextParticipationTeams,
            userTeamPlace:
              nextParticipationTeams.length > 0 ? gameItem.userTeamPlace : null,
          }
        }

        setGames((prev) =>
          prev.map((gameItem) => applyCancellationToGame(gameItem)),
        )
        setPersistedGames((prev) =>
          prev.map((gameItem) => applyCancellationToGame(gameItem)),
        )

        setFeedback({
          type: 'success',
          message: 'Регистрация на игру отменена',
        })
      } catch (error) {
        console.error('Failed to cancel game registration', error)
        setFeedback({
          type: 'error',
          message:
            extractErrorMessage(error) ||
            'Не удалось отменить регистрацию команды',
        })
      } finally {
        setCancellingRegistrationGameIds((prev) =>
          prev.filter((item) => item !== game.id),
        )
      }
    },
    [isRegistrationCancellationInProgress, setFeedback],
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

    setIsCreatingGame(true)
    setCreateGameFeedback(null)

    try {
      const baseDraft = {
        name: trimmedName,
        status: 'active',
        dateStart: null,
        type: 'classic',
        description: '',
        descriptionRich: '',
        descriptionMedia: [],
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
        registrationOpen: true,
        maxTeamPlayers: null,
        prices: [],
        finances: [],
        tasks: [],
        moderators: [],
      }

      if (isCloneMode) {
        const gameDetailsParams = new URLSearchParams({
          gameId: cloneSourceGameId,
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
        creatorTelegramId: currentUserTelegramIdNumber,
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
      const createdDraft = cloneGameDraft(createdGame)
      setEditingGame(createdDraft)
      setEditingBaselineGame(cloneGameDraft(createdDraft))
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
          return canFilterCanceledGames && showCanceledGames
        }
        return false
      }),
    [canFilterCanceledGames, games, showCanceledGames],
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
  const gamesCityFilterLabel =
    selectedGamesLocationOption?.label?.trim() || 'Город'
  const gamesSeasonFilterLabel =
    selectedPastGamesSeasonOption?.label?.trim() || 'Сезон'
  const isCityFilterPanelOpen = openedGamesFilterPanel === 'city'
  const isSeasonFilterPanelOpen = openedGamesFilterPanel === 'season'

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
    if (!editingGame || !editingBaselineGame) {
      return false
    }

    return (
      serializeGameForComparison(editingGame) !==
      serializeGameForComparison(editingBaselineGame)
    )
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
      if (!canEditSelectedGame || !editingGame) return

      setEditingGame((prevGame) => {
        if (!prevGame) {
          return prevGame
        }

        const patch =
          typeof updater === 'function' ? updater(prevGame) : updater
        const isClosedEditing = isClosedStatus(prevGame.status)
        const allowedClosedKeys = [
          'showCreator',
          'showTasks',
          'hideResult',
          'registrationOpen',
        ]
        const normalizedPatch =
          isClosedEditing && patch && typeof patch === 'object'
            ? Object.fromEntries(
                Object.entries(patch).filter(([key]) =>
                  allowedClosedKeys.includes(key),
                ),
              )
            : patch
        if (
          isClosedEditing &&
          (!normalizedPatch || Object.keys(normalizedPatch).length === 0)
        ) {
          return prevGame
        }
        const nextGame = { ...prevGame, ...normalizedPatch }
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
  const isEditingPhotoGame = useMemo(() => {
    const type =
      typeof (editingGame?.type ?? selectedGame?.type) === 'string'
        ? String(editingGame?.type ?? selectedGame?.type)
            .trim()
            .toLowerCase()
        : ''
    return type === 'photo'
  }, [editingGame?.type, selectedGame?.type])

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

    setIsSaving(true)
    setFeedback(null)

    try {
      const { json } = await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(gameToSave.id)}`,
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
      setEditingBaselineGame(null)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(false)
    } catch (error) {
      console.error('Failed to update game', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить игру',
      })
    } finally {
      setIsSaving(false)
    }
  }, [canEditSelectedGame, editingGame, selectedGame])

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
            } catch (error) {
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
  }, [selectedGame])

  const handleAddTeamToGame = useCallback(async () => {
    if (!selectedGame || !selectedTeamToAdd) {
      return
    }

    setIsAddingTeam(true)
    setTeamsModalState((prev) => ({ ...prev, error: null }))

    try {
      await requestApiJson(
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(selectedGame.id)}/teams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: selectedTeamToAdd }),
          fallbackMessage: 'Не удалось добавить команду',
        },
      )

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
  }, [loadTeamsModalData, selectedGame, selectedTeamToAdd])

  const handleRemoveTeamFromGame = useCallback(
    async (gameTeamId) => {
      if (!gameTeamId || !selectedGame) {
        return
      }

      setRemovingTeamIds((prev) =>
        prev.includes(gameTeamId) ? prev : [...prev, gameTeamId],
      )
      setTeamsModalState((prev) => ({ ...prev, error: null }))

      try {
        const gameTeamEntry = teamsModalState.gameTeams.find(
          (entry) => entry.id === gameTeamId,
        )
        if (!gameTeamEntry?.teamId) {
          throw new Error('Не удалось определить команду для удаления')
        }

        await requestApiJson(
          `${CABINET_GAMES_API_BASE}/${encodeURIComponent(selectedGame.id)}/teams`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamIds: [gameTeamEntry.teamId] }),
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
    [loadTeamsModalData, selectedGame, teamsModalState.gameTeams],
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
      const draft = cloneGameDraft(game)
      setEditingGame(draft)
      setEditingBaselineGame(cloneGameDraft(draft))
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsTasksModalOpen(false)
      setIsEditModalOpen(true)
    },
    [canOpenGameEditModal],
  )

  const handleEditTasksFromList = useCallback(
    (game) => {
      if (!game || !canManageGame(game)) {
        return
      }

      setSelectedGameId(game.id)
      const draft = cloneGameDraft(game)
      setEditingGame(draft)
      setEditingBaselineGame(cloneGameDraft(draft))
      setIsTeamsModalOpen(false)
      setIsResultsModalOpen(false)
      setIsTasksViewModalOpen(false)
      setIsDescriptionModalOpen(false)
      setIsEditModalOpen(false)
      setIsTasksModalOpen(true)
    },
    [canManageGame],
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

      setIsStatusChanging(true)
      setFeedback(null)

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
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}/start`,
            {
              fallbackMessage: 'Не удалось обновить статус игры',
            },
          )
          successMessage = 'Игра запущена'
        } else if (actionId === 'stop_game') {
          await requestApiJson(
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}/stop`,
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
            `${CABINET_GAMES_API_BASE}/${encodeURIComponent(
              statusModalGame.id,
            )}`,
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
      canEditAllGames,
      canManageGameStatus,
      fetchGamesPage,
      shouldShowLocationFilter,
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
      const userParticipationTeamIds = getUserParticipationTeams(game).map(
        (entry) => entry.teamId,
      )

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
        userParticipationTeamIds,
      })

      try {
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
          userParticipationTeamIds,
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
          userParticipationTeamIds,
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
      setIsTasksViewModalOpen(false)
      setIsResultsModalOpen(true)
      loadGameResults(game)
    },
    [canViewResultsForGame, loadGameResults],
  )

  const handleCloseResultsModal = useCallback(() => {
    setIsResultsModalOpen(false)
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
        `${CABINET_GAMES_API_BASE}/${encodeURIComponent(selectedGame.id)}/result`,
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
        userParticipationTeamIds: getUserParticipationTeams(selectedGame).map(
          (entry) => entry.teamId,
        ),
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
      const canEditThisGame = canOpenGameEditModal(game)
      const canManageStatusThisGame =
        canEditAllGames && canManageGameStatus(game)
      const canBroadcastThisGame =
        canManageThisGame && !isGameInProgressStatus(game.status)
      const canViewThisGameResults = canViewResultsForGame(game)
      const canViewThisGameTasks = canViewTasksForGame(game)
      const canViewGameTeams =
        typeof game?.status === 'string' && game.status !== 'canceled'
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
        isGameInProgressStatus(visibleStatus) &&
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
            className="relative min-h-[150px] overflow-hidden p-0 cursor-pointer sm:min-h-[168px]"
            aria-pressed={false}
            aria-label={`Открыть описание игры «${game.name || 'Без названия'}»`}
            title={game.name || 'Без названия'}
          >
            <div className="flex items-start min-w-0">
              <div className="relative hidden min-h-[156px] w-[156px] shrink-0 overflow-hidden rounded-lg border border-slate-300 shadow-inner sm:block dark:border-slate-700 dark:from-slate-900 dark:to-slate-900">
                <GameCardImage
                  src={game.image}
                  alt={game.name ? `Обложка игры ${game.name}` : 'Обложка игры'}
                  className="block w-full h-auto"
                  placeholderClassName="flex w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 py-6 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-400"
                />
              </div>
              <div className="min-w-0 flex-1 p-0 sm:absolute sm:inset-y-0 sm:left-[168px] sm:right-0 sm:overflow-hidden sm:p-4">
                <div className="flex items-start flex-1 w-full min-w-0 gap-3">
                  <div className="relative min-h-[96px] w-24 shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 shadow-inner sm:hidden dark:border-slate-700 dark:from-slate-900 dark:to-slate-900">
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
                      <span className="mb-2 ml-2 inline-flex items-center rounded-full border border-amber-400/75 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-300/60 dark:bg-amber-500/10 dark:text-amber-200">
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
                  canViewThisGameResults ||
                  canViewThisGameTasks) && (
                  <div className="mt-3 flex flex-col gap-2 phoneH:flex-row phoneH:items-center phoneH:justify-between">
                    <div className="order-1 flex items-center gap-2 phoneH:order-2">
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
                          Отменить регистрацию
                        </button>
                      )}
                    </div>
                    {(canJoinGame ||
                      canEnterGame ||
                      canViewThisGameTasks ||
                      canViewThisGameResults) && (
                      <div className="order-2 flex items-center gap-2 phoneH:order-3 phoneH:ml-auto">
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
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/80 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/14 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/24"
                          >
                            Результаты
                          </button>
                        )}
                      </div>
                    )}
                    {(canEditThisGame ||
                      canManageThisGame ||
                      canManageStatusThisGame ||
                      canBroadcastThisGame) && (
                      <div className="order-3 flex items-center gap-2 self-start phoneH:order-1 phoneH:self-auto">
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
                        {canManageThisGame && (
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
                        {canBroadcastThisGame && (
                          <CardActionIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenPushBroadcastModal(game)
                            }}
                            label="Рассылка уведомлений"
                            title="Открыть рассылку уведомлений"
                          >
                            <MegaphoneCardIcon />
                          </CardActionIconButton>
                        )}
                      </div>
                    )}
                    {canViewGameTeams && !canManageThisGame && (
                      <div className="flex items-center gap-2">
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleManageTeamsFromList(game, true)
                          }}
                          label="Просмотр команд"
                        >
                          <TeamCardIcon />
                        </CardActionIconButton>
                      </div>
                    )}
                    {canManageThisGame && canViewGameTeams && (
                      <div className="flex items-center gap-2">
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleManageTeamsFromList(game, false)
                          }}
                          label="Управление командами"
                        >
                          <TeamCardIcon />
                        </CardActionIconButton>
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
      canViewResultsForGame,
      canViewTasksForGame,
      currentUserDbId,
      getNounTeams,
      handleCancelRegistrationFromGame,
      handleEditGameFromList,
      handleEditTasksFromList,
      handleManageTeamsFromList,
      handleViewGameTeamsFromList,
      handleOpenPushBroadcastModal,
      handleOpenRegisterModalForGame,
      handleOpenTasksViewFromGame,
      handleOpenResultsFromGame,
      handleOpenStatusModal,
      isRegistrationCancellationInProgress,
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
      const canEditThisGame = canOpenGameEditModal(game)
      const canManageStatusThisGame =
        canEditAllGames && canManageGameStatus(game)
      const canBroadcastThisGame =
        canManageThisGame && !isGameInProgressStatus(game.status)
      const canViewThisGameResults = canViewResultsForGame(game)
      const canViewThisGameTasks = canViewTasksForGame(game)
      const canViewGameTeams =
        typeof game?.status === 'string' && game.status !== 'canceled'
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
        isGameInProgressStatus(visibleStatus) &&
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
            <div className="relative w-full overflow-hidden shadow-inner bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-900">
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
                  <span className="inline-flex items-center rounded-full border border-amber-400/75 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-300/60 dark:bg-amber-500/10 dark:text-amber-200">
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
              {hasParticipation && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">
                  {participationSummary}
                </p>
              )}
              {(canViewThisGameResults ||
                canViewThisGameTasks ||
                hasUserTeamPlace ||
                hasParticipation ||
                canEnterGame ||
                canJoinGame ||
                canCancelRegistration ||
                canBroadcastThisGame ||
                canEditThisGame ||
                canManageThisGame ||
                canManageStatusThisGame) && (
                <div className="mt-3 flex flex-col gap-2">
                  {(canJoinGame ||
                    canEnterGame ||
                    canViewThisGameTasks ||
                    canViewThisGameResults) && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/70 px-4 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/22"
                        >
                          Результаты
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
                          Отменить регистрацию
                        </button>
                      )}
                    </div>
                  )}
                  {(canEditThisGame ||
                    canManageThisGame ||
                    canManageStatusThisGame) && (
                    <div className="flex items-center gap-2 self-start pointer-events-auto">
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
                      {canManageThisGame && (
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
                      {canBroadcastThisGame && (
                        <CardActionIconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenPushBroadcastModal(game)
                          }}
                          label="Рассылка уведомлений"
                          title="Открыть рассылку уведомлений"
                          className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                        >
                          <MegaphoneCardIcon />
                        </CardActionIconButton>
                      )}
                    </div>
                  )}
                  {canViewGameTeams && !canManageThisGame && (
                    <div className="flex items-center gap-2">
                      <CardActionIconButton
                        onClick={(event) => {
                          event.stopPropagation()
                          handleManageTeamsFromList(game, true)
                        }}
                        label="Просмотр команд"
                        className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                      >
                        <TeamCardIcon />
                      </CardActionIconButton>
                    </div>
                  )}
                  {canManageThisGame && canViewGameTeams && (
                    <div className="flex items-center gap-2">
                      <CardActionIconButton
                        onClick={(event) => {
                          event.stopPropagation()
                          handleManageTeamsFromList(game, false)
                        }}
                        label="Управление командами"
                        className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full cursor-pointer border-cyan-300 bg-white/90 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-100 dark:focus:ring-primary"
                      >
                        <TeamCardIcon />
                      </CardActionIconButton>
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
      canViewResultsForGame,
      canViewTasksForGame,
      currentUserDbId,
      getNounTeams,
      handleCancelRegistrationFromGame,
      handleEditGameFromList,
      handleEditTasksFromList,
      handleManageTeamsFromList,
      handleViewGameTeamsFromList,
      handleOpenPushBroadcastModal,
      handleOpenRegisterModalForGame,
      handleOpenTasksViewFromGame,
      handleOpenResultsFromGame,
      handleOpenStatusModal,
      isRegistrationCancellationInProgress,
      handleSelectGameCard,
      selectedGameId,
    ],
  )

  const modalGame =
    (isEditModalOpen || isTasksModalOpen) && editingGame
      ? editingGame
      : selectedGame

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

  const availableOrganizersForSelect = useMemo(() => {
    const organizersMap = new Map()
    const isOrganizerRoleAllowed = (roleValue) => {
      if (typeof roleValue !== 'string') {
        return true
      }

      const normalizedRole = roleValue.trim().toLowerCase()
      return normalizedRole === 'admin' || normalizedRole === 'moder'
    }

    availableModerators.forEach((moderator) => {
      if (!isOrganizerRoleAllowed(moderator?.role)) {
        return
      }

      const telegramId = String(moderator?.telegramId || '').trim()
      if (!telegramId) {
        return
      }

      organizersMap.set(telegramId, {
        telegramId,
        name: typeof moderator?.name === 'string' ? moderator.name : '',
        username:
          typeof moderator?.username === 'string' ? moderator.username : '',
      })
    })

    const currentOrganizerTelegramId = String(
      modalGame?.creatorTelegramId || '',
    ).trim()
    const currentOrganizer = modalGame?.creator

    if (
      currentOrganizerTelegramId &&
      !organizersMap.has(currentOrganizerTelegramId)
    ) {
      organizersMap.set(currentOrganizerTelegramId, {
        telegramId: currentOrganizerTelegramId,
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
  }, [availableModerators, modalGame])

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
      isGameInProgressStatus(selectedGame?.status) &&
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
                      isPastView &&
                      setOpenedGamesFilterPanel((prev) =>
                        prev === 'season' ? null : 'season',
                      )
                    }
                    disabled={!isPastView}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isSeasonFilterPanelOpen
                        ? 'bg-primary text-white'
                        : 'border border-slate-200 bg-slate-100/90 text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                    aria-expanded={isSeasonFilterPanelOpen}
                    aria-controls="games-season-filter-panel"
                  >
                    {gamesSeasonFilterLabel}
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
                        className="text-sm font-semibold text-rose-500 transition hover:text-rose-400"
                      >
                        Скрыть
                      </button>
                    </div>
                    <div className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
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
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
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

                {isPastView && isSeasonFilterPanelOpen && (
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
                        className="text-sm font-semibold text-rose-500 transition hover:text-rose-400"
                      >
                        Сбросить
                      </button>
                    </div>
                    <div className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
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
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
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
              <GamePushBroadcastModal
                isOpen={isPushBroadcastModalOpen}
                onClose={handleClosePushBroadcastModal}
                gameName={pushBroadcastModalGame?.name || ''}
                mode={pushBroadcastMode}
                onChangeMode={setPushBroadcastMode}
                customMessage={pushBroadcastMessage}
                onChangeCustomMessage={setPushBroadcastMessage}
                isSubmitting={isPushBroadcastSubmitting}
                onSubmit={handleSubmitPushBroadcast}
                feedback={pushBroadcastFeedback}
              />
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
  teamName: PropTypes.string,
  isCaptain: PropTypes.bool,
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
          taskRich: PropTypes.string,
          taskMedia: PropTypes.arrayOf(taskMediaShape),
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
