'use client'

import PropTypes from 'prop-types'
import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import ParticipationGameCard from '@components/cabinet/cards/ParticipationGameCard'
import Modal from '@components/Modal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { toStringId } from '@helpers/idAndDate'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import requestApiJson from '@helpers/requestApiJson'
import resolveEntityRating from '@helpers/resolveEntityRating'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import { LOCATIONS } from '@server/serverConstants'

const CHAT_CITY_OPTIONS = [
  { key: 'krsk', label: 'Чат Красноярска' },
  { key: 'nrsk', label: 'Чат Норильска' },
  { key: 'ekb', label: 'Чат Екатеринбурга' },
]

const normalizeLocationName = (locationKey) => {
  const location = locationKey ? LOCATIONS[locationKey] : null
  const rawName = location?.townRu ?? ''

  if (!rawName) {
    return 'Город не выбран'
  }

  return rawName.charAt(0).toUpperCase() + rawName.slice(1)
}

const isUpcomingGame = (game, nowDate) => {
  const status = (game?.status ?? '').toString().toLowerCase()
  if (status === 'finished' || status === 'closed' || status === 'canceled') {
    return false
  }

  const startDate = game?.dateStart ? new Date(game.dateStart) : null
  if (startDate && !Number.isNaN(startDate.getTime())) {
    return startDate >= nowDate
  }

  return status === 'active' || status === 'started'
}

const isPastGame = (game, nowDate) => {
  const status = (game?.status ?? '').toString().toLowerCase()
  if (status === 'finished' || status === 'closed' || status === 'canceled') {
    return true
  }

  const startDate = game?.dateStart ? new Date(game.dateStart) : null
  if (startDate && !Number.isNaN(startDate.getTime())) {
    return startDate < nowDate
  }

  return false
}

const resolveTeamsPlace = (teamsPlaces, teamId) => {
  if (!teamsPlaces || !teamId) {
    return null
  }

  if (typeof teamsPlaces.get === 'function') {
    const mapValue = teamsPlaces.get(teamId)
    return Number.isFinite(Number(mapValue)) ? Number(mapValue) : null
  }

  const objectValue = teamsPlaces[teamId]
  return Number.isFinite(Number(objectValue)) ? Number(objectValue) : null
}

const resolveUserTeamIdFromResult = (gameResult, userId, telegramId) => {
  const teamsUsers = Array.isArray(gameResult?.teamsUsers) ? gameResult.teamsUsers : []
  if (!teamsUsers.length) {
    return null
  }

  const membership = teamsUsers.find((item) => {
    const itemUserId = toStringId(item?.userId)
    const itemTelegramId = Number(item?.userTelegramId)
    if (userId && itemUserId && itemUserId === userId) {
      return true
    }
    if (Number.isFinite(telegramId) && Number.isFinite(itemTelegramId)) {
      return itemTelegramId === telegramId
    }
    return false
  })

  return toStringId(membership?.teamId)
}

const resolveTeamNameFromResult = (gameResult, teamId) => {
  if (!teamId) {
    return null
  }

  const teams = Array.isArray(gameResult?.teams) ? gameResult.teams : []
  const matchedTeam = teams.find((team) => toStringId(team?._id) === teamId)
  const teamName = typeof matchedTeam?.name === 'string' ? matchedTeam.name.trim() : ''
  return teamName || null
}

const RATING_MIN_PLAYED_GAMES = 3
const RATING_STABILITY_WEIGHT = 0.2
const RATING_MISS_PENALTY_WEIGHT = 0.3

const getAverage = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null
  }

  const sum = values.reduce((acc, value) => acc + value, 0)
  return sum / values.length
}

const getStdDev = (values = [], average = null) => {
  if (!Array.isArray(values) || values.length === 0) {
    return 0
  }

  const avg = Number.isFinite(average) ? average : getAverage(values)
  if (!Number.isFinite(avg)) {
    return 0
  }

  const variance =
    values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length

  return Math.sqrt(variance)
}

const resolveParticipantRatingKey = (userId, telegramId) => {
  if (userId) {
    return `uid:${userId}`
  }
  if (Number.isFinite(telegramId)) {
    return `tg:${telegramId}`
  }
  return null
}

const buildPlayerRatingMetrics = ({ places = [], missedGames = 0 }) => {
  const normalizedPlaces = Array.isArray(places)
    ? places.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : []
  const playedGames = normalizedPlaces.length
  const normalizedMissedGames = Number.isFinite(Number(missedGames))
    ? Math.max(0, Number(missedGames))
    : 0
  const averagePlace = playedGames ? getAverage(normalizedPlaces) : null
  const stdDevPlace =
    playedGames && Number.isFinite(averagePlace) ? getStdDev(normalizedPlaces, averagePlace) : 0
  const attendanceDenominator = playedGames + normalizedMissedGames
  const attendance = attendanceDenominator > 0 ? playedGames / attendanceDenominator : 1
  const baseScore =
    Number.isFinite(averagePlace)
      ? averagePlace + RATING_STABILITY_WEIGHT * stdDevPlace
      : null
  const missPenalty =
    Number.isFinite(baseScore) ? (1 - attendance) * RATING_MISS_PENALTY_WEIGHT : null
  const finalScore = Number.isFinite(baseScore) ? baseScore + missPenalty : null

  return {
    places: normalizedPlaces,
    playedGames,
    missedGames: normalizedMissedGames,
    averagePlace,
    stdDevPlace,
    attendance,
    baseScore,
    missPenalty,
    finalScore,
    isEligible: playedGames >= RATING_MIN_PLAYED_GAMES && Number.isFinite(finalScore),
  }
}

const resolveTeamRatingBadge = (rating) => {
  if (!rating) {
    return { label: 'Без рейтинга', eligible: false }
  }

  if (rating.isEligible && Number.isFinite(rating.rank)) {
    return { label: `#${rating.rank}`, eligible: true }
  }

  if (Number.isFinite(rating.finalScore)) {
    return { label: Number(rating.finalScore).toFixed(2), eligible: false }
  }

  return { label: 'Без рейтинга', eligible: false }
}

const CabinetDashboard = ({
  session: initialSession,
  dashboardData: initialDashboardData,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentPath = `${pathname || ''}${
    searchParams?.toString() ? `?${searchParams.toString()}` : ''
  }`
  const { activeSession, status } = useMergedSession(initialSession)
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )

  const dashboardData = useMemo(() => {
    const source =
      initialDashboardData && typeof initialDashboardData === 'object'
        ? initialDashboardData
        : {}

    const fallbackRating = {
      isEligible: false,
      rank: null,
      totalRanked: 0,
      finalScore: null,
      playersAbove: null,
      playedGames: 0,
      missedGames: 0,
    }

    return {
      cityName:
        typeof source.cityName === 'string' && source.cityName.trim()
          ? source.cityName
          : 'Город не выбран',
      teamsCount: Number.isFinite(Number(source.teamsCount))
        ? Number(source.teamsCount)
        : 0,
      participantTeams: Array.isArray(source.participantTeams)
        ? source.participantTeams
        : [],
      completedGamesCount: Number.isFinite(Number(source.completedGamesCount))
        ? Number(source.completedGamesCount)
        : 0,
      averageFinishedPlace: Number.isFinite(Number(source.averageFinishedPlace))
        ? Number(source.averageFinishedPlace)
        : null,
      upcomingGamesCount: Number.isFinite(Number(source.upcomingGamesCount))
        ? Number(source.upcomingGamesCount)
        : 0,
      pastGamesCount: Number.isFinite(Number(source.pastGamesCount))
        ? Number(source.pastGamesCount)
        : 0,
      hasTeam:
        typeof source.hasTeam === 'boolean'
          ? source.hasTeam
          : Array.isArray(source.participantTeams) && source.participantTeams.length > 0,
      hasUpcomingRegistration: Boolean(source.hasUpcomingRegistration),
      profileCompleted: Boolean(source.profileCompleted),
      nearestGame:
        source.nearestGame && typeof source.nearestGame === 'object'
          ? source.nearestGame
          : null,
      personalProgressGames: Array.isArray(source.personalProgressGames)
        ? source.personalProgressGames
        : [],
      rating:
        source.rating && typeof source.rating === 'object'
          ? { ...fallbackRating, ...source.rating }
          : fallbackRating,
      recentActivity: Array.isArray(source.recentActivity) ? source.recentActivity : [],
      chatUrl: typeof source.chatUrl === 'string' ? source.chatUrl : '',
      chatUrlsByLocation:
        source.chatUrlsByLocation && typeof source.chatUrlsByLocation === 'object'
          ? source.chatUrlsByLocation
          : { krsk: '', nrsk: '', ekb: '' },
    }
  }, [initialDashboardData])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [isTeamDescriptionOpen, setIsTeamDescriptionOpen] = useState(false)
  const [isAllPlayedGamesOpen, setIsAllPlayedGamesOpen] = useState(false)
  const [isPlayedGamePreviewOpen, setIsPlayedGamePreviewOpen] = useState(false)
  const [previewPlayedGame, setPreviewPlayedGame] = useState(null)
  const [isRatingInfoOpen, setIsRatingInfoOpen] = useState(false)
  const [isChatLinksModalOpen, setIsChatLinksModalOpen] = useState(false)
  const [isLeavingTeam, setIsLeavingTeam] = useState(false)
  const [leaveTeamError, setLeaveTeamError] = useState('')
  const selectedTeam = useMemo(
    () => dashboardData.participantTeams.find((team) => team.id === selectedTeamId) ?? null,
    [dashboardData.participantTeams, selectedTeamId]
  )
  const isPrivilegedTeamEditor = ['admin', 'dev'].includes(
    String(effectiveRole ?? 'client').toLowerCase()
  )
  const canLeaveSelectedTeam = Boolean(selectedTeam?.membershipId) && !selectedTeam?.isCaptain
  const handleLeaveSelectedTeam = useCallback(async () => {
    if (!selectedTeam?.membershipId || selectedTeam?.isCaptain || isLeavingTeam) {
      return
    }

    const confirmed = window.confirm('Вы уверены, что хотите выйти из команды?')
    if (!confirmed) {
      return
    }

    setLeaveTeamError('')
    setIsLeavingTeam(true)

    try {
      await requestApiJson(`/api/cabinet/teams/members/${selectedTeam.membershipId}`, {
        method: 'DELETE',
        fallbackMessage: 'Не удалось выйти из команды',
      })

      setIsTeamDescriptionOpen(false)
      router.replace(currentPath, { scroll: false })
    } catch (error) {
      console.error('Failed to leave selected team from dashboard', error)
      setLeaveTeamError(error?.message || 'Не удалось выйти из команды')
    } finally {
      setIsLeavingTeam(false)
    }
  }, [currentPath, isLeavingTeam, router, selectedTeam])
  const latestPlayedGame = dashboardData.personalProgressGames[0] ?? null
  const hasAnyCityChatUrl = useMemo(
    () =>
      CHAT_CITY_OPTIONS.some(
        (item) =>
          typeof dashboardData?.chatUrlsByLocation?.[item.key] === 'string' &&
          dashboardData.chatUrlsByLocation[item.key].trim().length > 0,
      ),
    [dashboardData],
  )

  if (!activeSession) {
    if (status === 'loading') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
          <span className="text-sm font-semibold uppercase tracking-widest">Загрузка кабинета…</span>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="space-y-4 text-center">
<p className="text-lg font-semibold">Сессия не найдена</p>
          <p className="text-sm text-slate-200">
            Похоже, вы не авторизованы. Пожалуйста, перейдите на страницу входа и попробуйте снова.
          </p>
          <a
            href="/cabinet/login"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 dark:bg-slate-900/80 dark:text-slate-100"
          >
            Перейти к авторизации
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
<CabinetLayout
        title="Обзор"
        description="Ваш личный статус, ближайшие игры и быстрый доступ к ключевым действиям."
        activePage="dashboard"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="space-y-6 md:col-span-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Личный прогресс</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Завершено игр</p>
                  <p className="mt-1 text-lg font-semibold text-primary dark:text-slate-100">
                    {dashboardData.completedGamesCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Среднее место</p>
                  <p className="mt-1 text-lg font-semibold text-primary dark:text-slate-100">
                    {dashboardData.averageFinishedPlace
                      ? dashboardData.averageFinishedPlace.toFixed(2)
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Рейтинг игрока</p>
                  <button
                    type="button"
                    onClick={() => setIsRatingInfoOpen(true)}
                    className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                    aria-label="Как считается рейтинг"
                    title="Как считается рейтинг"
                  >
                    i
                  </button>
                </div>
                {dashboardData.rating?.isEligible ? (
                  <>
                    <p className="mt-1 text-lg font-semibold text-primary dark:text-slate-100">
                      #{dashboardData.rating.rank} из {dashboardData.rating.totalRanked}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Рейтинговый балл: {dashboardData.rating.finalScore.toFixed(2)} ·
                      Выше вас: {dashboardData.rating.playersAbove}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Сыграно: {dashboardData.rating.playedGames} · Пропущено: {dashboardData.rating.missedGames}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-300">
                      Учтены только закрытые рейтинговые игры.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Недостаточно данных для рейтинга
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Нужно минимум {RATING_MIN_PLAYED_GAMES} закрытые рейтинговые игры.
                      Сейчас сыграно: {dashboardData.rating?.playedGames ?? 0}
                    </p>
                  </>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Мои команды</h3>
              {leaveTeamError ? (
                <p className="mt-3 rounded-xl border border-rose-300/70 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                  {leaveTeamError}
                </p>
              ) : null}
              {dashboardData.participantTeams.length > 0 ? (
                <ul className="mt-4 grid gap-3">
                  {dashboardData.participantTeams.map((team) => {
                    const teamRatingBadge = resolveTeamRatingBadge(team.rating)
                    const canManageTeam = isPrivilegedTeamEditor || team.isCaptain

                    return (
                      <li key={team.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedTeamId(team.id)
                            setIsTeamDescriptionOpen(true)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedTeamId(team.id)
                              setIsTeamDescriptionOpen(true)
                            }
                          }}
                          className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
                          title={team.name}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex flex-1 items-start gap-3">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
                                <img
                                  src={team.image || '/img/avatars/team.png'}
                                  alt={`Иконка команды ${team.name || 'Без названия'}`}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {team.name}
                                </p>
                              </div>
                            </div>
                              {canManageTeam ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    router.push(
                                      `/cabinet/teams?teamId=${encodeURIComponent(team.id)}&mode=edit`,
                                    )
                                  }}
                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300 text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 dark:border-[#00D1FF]/35 dark:text-[#b3ecff] dark:hover:border-[#00D1FF]/65 dark:hover:bg-[#00D1FF]/10 dark:hover:text-[#e1f8ff]"
                                  aria-label="Открыть управление командой"
                                  title="Открыть управление командой"
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
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                teamRatingBadge.eligible
                                  ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200'
                                  : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200'
                              }`}
                            >
                              {teamRatingBadge.label}
                            </span>
                            {team.isCaptain ? (
                              <span className="inline-flex items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                Капитан
                              </span>
                            ) : null}
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                team.open
                                  ? 'border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]'
                                  : 'border-violet-300 bg-violet-100 text-violet-700 dark:border-[#7A00FF]/35 dark:bg-[#7A00FF]/12 dark:text-[#d9c8ff]'
                              }`}
                            >
                              {team.open ? 'Открыта' : 'Закрыта'}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                            Участников: {team.membersCount ?? 0}
                          </p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                            Игр: {team.gamesCount ?? 0}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">Вы пока не состоите в командах</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Ближайшая игра</h3>
              {dashboardData.nearestGame ? (
                <div className="mt-4 space-y-3">
                  <ParticipationGameCard
                    game={{
                      id: dashboardData.nearestGame.id || 'nearest-game',
                      name: dashboardData.nearestGame.name || 'Без названия',
                      status: dashboardData.nearestGame.status || '',
                      dateStart: dashboardData.nearestGame.dateStart || null,
                      teams: [],
                    }}
                    onOpen={() => {
                      if (dashboardData.nearestGame?.id) {
                        router.push(
                          `/cabinet/games-upcoming?gameId=${encodeURIComponent(
                            dashboardData.nearestGame.id,
                          )}`,
                        )
                        return
                      }
                      router.push('/cabinet/games-upcoming')
                    }}
                    showTeam={false}
                  />
                  <a
                    href="/cabinet/games-upcoming"
                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 dark:border-[#00D1FF]/60 dark:bg-[#00D1FF]/18 dark:text-[#e9fbff] dark:hover:bg-[#00D1FF]/28"
                  >
                    Открыть список игр
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Пока нет зарегистрированных предстоящих игр. Выберите игру и присоединитесь к старту.
                </p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Последняя сыгранная игра</h3>
              {latestPlayedGame ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPlayedGame(latestPlayedGame)
                      setIsPlayedGamePreviewOpen(true)
                    }}
                    className="mt-4 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70">
                          {latestPlayedGame.image ? (
                            <img
                              src={latestPlayedGame.image}
                              alt={latestPlayedGame.gameName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                              Нет фото
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="aq-modal-item-title truncate text-sm font-semibold">{latestPlayedGame.gameName}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{latestPlayedGame.dateLabel}</p>
                          {latestPlayedGame.teamName ? (
                            <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                              {latestPlayedGame.teamName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                        {latestPlayedGame.place ? `${latestPlayedGame.place} место` : 'Без места'}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAllPlayedGamesOpen(true)}
                    className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:border-[#00D1FF]/50 dark:bg-[#00D1FF]/12 dark:text-[#c6e8ff] dark:hover:bg-[#00D1FF]/20 dark:hover:text-[#e9fbff]"
                  >
                    Посмотреть все сыгранные игры
                  </button>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Завершённых игр с итоговым местом пока нет.
                </p>
              )}
            </article>

          </div>

          <div className="space-y-6 md:col-span-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Последние события</h3>
              {dashboardData.recentActivity.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {dashboardData.recentActivity.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                    >
                      <p className="aq-modal-item-title text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{item.details}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatRelativeTimeFromNow(item.timestamp)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Событий пока нет. Как только появится активность, она отобразится здесь.
                </p>
              )}
            </article>

            {hasAnyCityChatUrl ? (
              <article className="rounded-2xl border border-cyan-300 bg-cyan-50 p-5 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/10">
                <h3 className="aq-modal-section-title text-base font-semibold">Чат проекта</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                  Вопросы, анонсы и быстрые ответы команды ActQuest.
                </p>
                <button
                  type="button"
                  onClick={() => setIsChatLinksModalOpen(true)}
                  className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg border border-cyan-400 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-300/50 dark:text-cyan-100 dark:hover:bg-cyan-500/15"
                >
                  Перейти в чат
                </button>
              </article>
            ) : null}
          </div>
        </section>
      </CabinetLayout>
      <TeamDescriptionModal
        isOpen={isTeamDescriptionOpen}
        onClose={() => setIsTeamDescriptionOpen(false)}
        selectedTeam={selectedTeam}
        canLeaveTeam={canLeaveSelectedTeam}
        isLeavingTeam={isLeavingTeam}
        onLeaveTeam={handleLeaveSelectedTeam}
      />
      <Modal
        isOpen={isAllPlayedGamesOpen}
        onClose={() => setIsAllPlayedGamesOpen(false)}
        title="Все сыгранные игры"
      >
        {dashboardData.personalProgressGames.length > 0 ? (
          <ul className="space-y-3">
            {dashboardData.personalProgressGames.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
              >
                <div className="min-w-0">
                  <p className="aq-modal-item-title truncate text-sm font-semibold">{item.gameName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{item.dateLabel}</p>
                  {item.teamName ? (
                    <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                      {item.teamName}
                    </p>
                  ) : null}
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                  {item.place ? `${item.place} место` : 'Без места'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Завершённых игр пока нет.
          </p>
        )}
      </Modal>
      <Modal
        isOpen={isPlayedGamePreviewOpen}
        onClose={() => setIsPlayedGamePreviewOpen(false)}
        title={previewPlayedGame?.gameName || 'Просмотр игры'}
      >
        {previewPlayedGame ? (
          <div className="space-y-4">
            <div className="h-44 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70">
              {previewPlayedGame.image ? (
                <img
                  src={previewPlayedGame.image}
                  alt={previewPlayedGame.gameName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-300">
                  Нет обложки
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/80">
              <p className="aq-modal-item-title text-sm font-semibold">{previewPlayedGame.gameName}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{previewPlayedGame.dateLabel}</p>
              {previewPlayedGame.teamName ? (
                <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                  Команда: {previewPlayedGame.teamName}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                Результат: {previewPlayedGame.place ? `${previewPlayedGame.place} место` : 'Без места'}
              </p>
            </div>
            <a
              href={`/cabinet/games-past?gameId=${encodeURIComponent(previewPlayedGame.id)}`}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
            >
              Открыть в списке игр
            </a>
          </div>
        ) : null}
      </Modal>
      <Modal
        isOpen={isChatLinksModalOpen}
        onClose={() => setIsChatLinksModalOpen(false)}
        title="Чаты проекта по городам"
      >
        <div className="space-y-3">
          {CHAT_CITY_OPTIONS.map((item) => {
            const href =
              typeof dashboardData?.chatUrlsByLocation?.[item.key] === 'string'
                ? dashboardData.chatUrlsByLocation[item.key].trim()
                : ''
            const isAvailable = Boolean(href)

            return isAvailable ? (
              <a
                key={item.key}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-cyan-400 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-300/50 dark:text-cyan-100 dark:hover:bg-cyan-500/15"
              >
                {item.label}
              </a>
            ) : (
              <button
                key={item.key}
                type="button"
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-500"
              >
                {item.label} (не задан)
              </button>
            )
          })}
        </div>
      </Modal>
      <Modal
        isOpen={isRatingInfoOpen}
        onClose={() => setIsRatingInfoOpen(false)}
        title="Как считается рейтинг"
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-200">
          <p>
            Рейтинг считается только по закрытым рейтинговым играм.
          </p>
          <p>
            Базовая оценка: среднее место игрока. Чем меньше, тем лучше.
          </p>
          <p>
            Дополнительно учитывается стабильность: если места сильно скачут, добавляется небольшой штраф.
          </p>
          <p>
            Пропуски считаются только начиная с первой рейтинговой игры, где игрок реально участвовал.
            Игры до первого участия в рейтинг не влияют.
          </p>
          <p>
            Итоговый рейтинг строится по возрастанию балла. Меньший балл означает более высокое место в рейтинге.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Для попадания в рейтинг нужно минимум {RATING_MIN_PLAYED_GAMES} закрытые рейтинговые игры.
          </p>
        </div>
      </Modal>
    </>
  )
}

CabinetDashboard.propTypes = {
  session: PropTypes.object,
  dashboardData: PropTypes.shape({
    cityName: PropTypes.string,
    teamsCount: PropTypes.number,
    participantTeams: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        membershipId: PropTypes.string,
        name: PropTypes.string,
        image: PropTypes.string,
        isCaptain: PropTypes.bool,
        description: PropTypes.string,
        open: PropTypes.bool,
        rating: PropTypes.shape({
          isEligible: PropTypes.bool,
          rank: PropTypes.number,
          totalRanked: PropTypes.number,
          playersAbove: PropTypes.number,
          finalScore: PropTypes.number,
          playedGames: PropTypes.number,
          missedGames: PropTypes.number,
          updatedAt: PropTypes.string,
        }),
        membersCount: PropTypes.number,
        gamesCount: PropTypes.number,
        captain: PropTypes.shape({
          name: PropTypes.string,
          username: PropTypes.string,
        }),
        updatedAt: PropTypes.string,
        createdAt: PropTypes.string,
        members: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string,
            username: PropTypes.string,
            userRole: PropTypes.string,
            hasLinkedUser: PropTypes.bool,
            phone: PropTypes.string,
            telegramId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            isCaptain: PropTypes.bool,
          })
        ),
        games: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string,
            status: PropTypes.string,
            dateStart: PropTypes.string,
            hidden: PropTypes.bool,
          })
        ),
      })
    ),
    completedGamesCount: PropTypes.number,
    averageFinishedPlace: PropTypes.number,
    upcomingGamesCount: PropTypes.number,
    pastGamesCount: PropTypes.number,
    hasTeam: PropTypes.bool,
    hasUpcomingRegistration: PropTypes.bool,
    profileCompleted: PropTypes.bool,
    nearestGame: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      status: PropTypes.string,
      dateStart: PropTypes.string,
    }),
    personalProgressGames: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        gameName: PropTypes.string.isRequired,
        image: PropTypes.string,
        dateLabel: PropTypes.string.isRequired,
        teamName: PropTypes.string,
        place: PropTypes.number,
      })
    ),
    rating: PropTypes.shape({
      isEligible: PropTypes.bool.isRequired,
      rank: PropTypes.number,
      totalRanked: PropTypes.number.isRequired,
      finalScore: PropTypes.number,
      playersAbove: PropTypes.number,
      playedGames: PropTypes.number.isRequired,
      missedGames: PropTypes.number.isRequired,
    }),
    recentActivity: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        details: PropTypes.string.isRequired,
        timestamp: PropTypes.string.isRequired,
      })
    ),
    chatUrl: PropTypes.string,
    chatUrlsByLocation: PropTypes.shape({
      krsk: PropTypes.string,
      nrsk: PropTypes.string,
      ekb: PropTypes.string,
    }),
  }),
}

CabinetDashboard.defaultProps = {
  session: null,
  dashboardData: {
    cityName: 'Город не выбран',
    teamsCount: 0,
    participantTeams: [],
    completedGamesCount: 0,
    averageFinishedPlace: null,
    upcomingGamesCount: 0,
    pastGamesCount: 0,
    hasTeam: false,
    hasUpcomingRegistration: false,
    profileCompleted: false,
    nearestGame: null,
    personalProgressGames: [],
    rating: {
      isEligible: false,
      rank: null,
      totalRanked: 0,
      finalScore: null,
      playersAbove: null,
      playedGames: 0,
      missedGames: 0,
    },
    recentActivity: [],
    chatUrl: '',
    chatUrlsByLocation: {
      krsk: '',
      nrsk: '',
      ekb: '',
    },
  },
}

export default CabinetDashboard

