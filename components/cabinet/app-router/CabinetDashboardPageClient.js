'use client'

import PropTypes from 'prop-types'
import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import GamePlaceBadge from '@components/cabinet/GamePlaceBadge'
import ParticipationGameCard from '@components/cabinet/cards/ParticipationGameCard'
import RatingBreakdownModal from '@components/cabinet/rating/RatingBreakdownModal'
import GameReviewModal from '@components/location-game/GameReviewModal'
import Modal from '@components/Modal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import UnifiedGameDescriptionModal from '@components/modals/UnifiedGameDescriptionModal'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { toStringId } from '@helpers/idAndDate'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import requestApiJson from '@helpers/requestApiJson'
import resolveEntityRating from '@helpers/resolveEntityRating'
import { resolveGameEntryHref } from '@helpers/resolveGameEntryHref'
import useMergedSession from '@helpers/useMergedSession'
import { LOCATIONS } from '@server/serverConstants'

const CHAT_CITY_OPTIONS = [
  { key: 'krsk', label: 'Чат Красноярска' },
  { key: 'nrsk', label: 'Чат Норильска' },
  { key: 'ekb', label: 'Чат Екатеринбурга' },
]

const getReviewCountLabel = (count) => {
  const numeric = Math.max(0, Math.trunc(Number(count) || 0))
  const modulo100 = numeric % 100
  const modulo10 = numeric % 10
  if (modulo100 >= 11 && modulo100 <= 14) return `${numeric} оценок`
  if (modulo10 === 1) return `${numeric} оценка`
  if (modulo10 >= 2 && modulo10 <= 4) return `${numeric} оценки`
  return `${numeric} оценок`
}

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
  const teamsUsers = Array.isArray(gameResult?.teamsUsers)
    ? gameResult.teamsUsers
    : []
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
  const teamName =
    typeof matchedTeam?.name === 'string' ? matchedTeam.name.trim() : ''
  return teamName || null
}

const RATING_MIN_PLAYED_GAMES = 3

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
  const effectiveRole = activeSession?.user?.role ?? 'client'

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
      wins: 0,
      seasonName: null,
      playersAbove: null,
      playedGames: 0,
      missedGames: 0,
      breakdown: [],
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
          : Array.isArray(source.participantTeams) &&
            source.participantTeams.length > 0,
      hasUpcomingRegistration: Boolean(source.hasUpcomingRegistration),
      profileCompleted: Boolean(source.profileCompleted),
      inProgressGame:
        source.inProgressGame && typeof source.inProgressGame === 'object'
          ? source.inProgressGame
          : null,
      nearestGame:
        source.nearestGame && typeof source.nearestGame === 'object'
          ? source.nearestGame
          : null,
      personalProgressGames: Array.isArray(source.personalProgressGames)
        ? source.personalProgressGames
        : [],
      latestPlayedGameDetails:
        source.latestPlayedGameDetails &&
        typeof source.latestPlayedGameDetails === 'object'
          ? source.latestPlayedGameDetails
          : null,
      rating:
        source.rating && typeof source.rating === 'object'
          ? { ...fallbackRating, ...source.rating }
          : fallbackRating,
      ratingPeriods: Array.isArray(source.ratingPeriods)
        ? source.ratingPeriods
        : [],
      recentActivity: Array.isArray(source.recentActivity)
        ? source.recentActivity
        : [],
      chatUrl: typeof source.chatUrl === 'string' ? source.chatUrl : '',
      chatUrlsByLocation:
        source.chatUrlsByLocation &&
        typeof source.chatUrlsByLocation === 'object'
          ? source.chatUrlsByLocation
          : { krsk: '', nrsk: '', ekb: '' },
    }
  }, [initialDashboardData])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [isTeamDescriptionOpen, setIsTeamDescriptionOpen] = useState(false)
  const [isAllPlayedGamesOpen, setIsAllPlayedGamesOpen] = useState(false)
  const [isPlayedGamePreviewOpen, setIsPlayedGamePreviewOpen] = useState(false)
  const [reviewModalGame, setReviewModalGame] = useState(null)
  const [isRatingInfoOpen, setIsRatingInfoOpen] = useState(false)
  const [isRatingBreakdownOpen, setIsRatingBreakdownOpen] = useState(false)
  const [isChatLinksModalOpen, setIsChatLinksModalOpen] = useState(false)
  const [isLeavingTeam, setIsLeavingTeam] = useState(false)
  const [leaveTeamError, setLeaveTeamError] = useState('')
  const selectedTeam = useMemo(
    () =>
      dashboardData.participantTeams.find(
        (team) => team.id === selectedTeamId,
      ) ?? null,
    [dashboardData.participantTeams, selectedTeamId],
  )
  const isPrivilegedTeamEditor = ['admin', 'dev'].includes(
    String(effectiveRole ?? 'client').toLowerCase(),
  )
  const canLeaveSelectedTeam =
    Boolean(selectedTeam?.membershipId) && !selectedTeam?.isCaptain
  const handleLeaveSelectedTeam = useCallback(async () => {
    if (
      !selectedTeam?.membershipId ||
      selectedTeam?.isCaptain ||
      isLeavingTeam
    ) {
      return
    }

    const confirmed = window.confirm('Вы уверены, что хотите выйти из команды?')
    if (!confirmed) {
      return
    }

    setLeaveTeamError('')
    setIsLeavingTeam(true)

    try {
      await requestApiJson(
        `/api/cabinet/teams/members/${selectedTeam.membershipId}`,
        {
          method: 'DELETE',
          fallbackMessage: 'Не удалось выйти из команды',
        },
      )

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
  const ratingPlayerItem = {
    id: toStringId(
      activeSession?.user?.globalUserId ??
        activeSession?.user?.userId ??
        activeSession?.user?._id ??
        activeSession?.user?.id,
    ) || 'current-user',
    name:
      activeSession?.user?.name?.trim() ||
      activeSession?.user?.username?.trim() ||
      'Игрок ActQuest',
    rating: dashboardData.rating,
    ratingPeriods: dashboardData.ratingPeriods,
  }
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
          <span className="text-sm font-semibold uppercase tracking-widest">
            Загрузка кабинета…
          </span>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="space-y-4 text-center">
          <p className="text-lg font-semibold">Сессия не найдена</p>
          <p className="text-sm text-slate-200">
            Похоже, вы не авторизованы. Пожалуйста, перейдите на страницу входа
            и попробуйте снова.
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
        <section className="grid min-w-0 gap-6 md:grid-cols-5">
          <div className="min-w-0 space-y-6 md:col-span-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">
                Личный прогресс
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Завершено игр
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary dark:text-slate-100">
                    {dashboardData.completedGamesCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Среднее место
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary dark:text-slate-100">
                    {dashboardData.averageFinishedPlace
                      ? dashboardData.averageFinishedPlace.toFixed(2)
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Рейтинг игрока
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRatingBreakdownOpen(true)}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                    >
                      Подробнее
                    </button>
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
                </div>
                {dashboardData.rating?.isEligible ? (
                  <>
                    <p className="mt-1 text-lg font-semibold text-primary dark:text-slate-100">
                      #{dashboardData.rating.rank} из{' '}
                      {dashboardData.rating.totalRanked}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Рейтинговые очки:{' '}
                      {dashboardData.rating.finalScore.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Рейтинговых игр: {dashboardData.rating.playedGames} ·
                      Побед: {dashboardData.rating.wins ?? 0}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-300">
                      Учтены закрытые рейтинговые игры города{' '}
                      {dashboardData.cityName}.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Недостаточно данных для рейтинга
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Нужно минимум {RATING_MIN_PLAYED_GAMES} закрытые
                      рейтинговые игры. Сейчас сыграно:{' '}
                      {dashboardData.rating?.playedGames ?? 0}
                    </p>
                  </>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">
                Мои команды
              </h3>
              {leaveTeamError ? (
                <p className="mt-3 rounded-xl border border-rose-300/70 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                  {leaveTeamError}
                </p>
              ) : null}
              {dashboardData.participantTeams.length > 0 ? (
                <ul className="mt-4 grid gap-3">
                  {dashboardData.participantTeams.map((team) => {
                    const teamRatingBadge = resolveTeamRatingBadge(team.rating)
                    const canManageTeam =
                      isPrivilegedTeamEditor || team.isCaptain

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
                              className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                team.open
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                                  : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200'
                              }`}
                              title={team.open ? 'Открыта' : 'Закрыта'}
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
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                  Вы пока не состоите в командах
                </p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              {dashboardData.inProgressGame ? (
                <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/12">
                  <h3 className="aq-modal-section-title text-base font-semibold text-emerald-700 dark:text-emerald-200">
                    Игра в процессе
                  </h3>
                  <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-100/80">
                    Вы уже зарегистрированы. Можно сразу перейти к прохождению.
                  </p>
                  <div className="mt-3 space-y-3">
                    <ParticipationGameCard
                      game={{
                        id:
                          dashboardData.inProgressGame.id || 'in-progress-game',
                        name:
                          dashboardData.inProgressGame.name || 'Без названия',
                        status:
                          dashboardData.inProgressGame.status || 'started',
                        dateStart:
                          dashboardData.inProgressGame.dateStart || null,
                        location:
                          dashboardData.inProgressGame.location ||
                          activeSession?.user?.location ||
                          '',
                        teams: dashboardData.inProgressGame.userTeamName
                          ? [dashboardData.inProgressGame.userTeamName]
                          : [],
                      }}
                      onOpen={() => {
                        router.push(
                          resolveGameEntryHref({
                            gameId: dashboardData.inProgressGame?.id,
                            teamId: dashboardData.inProgressGame?.userTeamId,
                            location:
                              dashboardData.inProgressGame?.location ||
                              activeSession?.user?.location ||
                              '',
                          }),
                        )
                      }}
                    />
                    <a
                      href={resolveGameEntryHref({
                        gameId: dashboardData.inProgressGame?.id,
                        teamId: dashboardData.inProgressGame?.userTeamId,
                        location:
                          dashboardData.inProgressGame?.location ||
                          activeSession?.user?.location ||
                          '',
                      })}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-emerald-500 bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-500/90 dark:text-emerald-50 dark:hover:bg-emerald-500"
                    >
                      Зайти в игру
                    </a>
                  </div>
                </div>
              ) : null}
              <h3 className="aq-modal-section-title text-base font-semibold">
                Ближайшая игра
              </h3>
              {dashboardData.nearestGame ? (
                <div className="mt-4 space-y-3">
                  <ParticipationGameCard
                    game={{
                      id: dashboardData.nearestGame.id || 'nearest-game',
                      name: dashboardData.nearestGame.name || 'Без названия',
                      status: dashboardData.nearestGame.status || '',
                      dateStart: dashboardData.nearestGame.dateStart || null,
                      location:
                        dashboardData.nearestGame.location ||
                        activeSession?.user?.location ||
                        '',
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
                    Открыть список предстоящих игр
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Пока нет зарегистрированных предстоящих игр. Выберите игру и
                  присоединитесь к старту.
                </p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">
                Последняя сыгранная игра
              </h3>
              {latestPlayedGame ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsPlayedGamePreviewOpen(true)}
                    className="mt-4 w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
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
                          <p className="aq-modal-item-title truncate text-sm font-semibold">
                            {latestPlayedGame.gameName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                            {latestPlayedGame.dateLabel}
                          </p>
                          {latestPlayedGame.teamName ? (
                            <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                              {latestPlayedGame.teamName}
                            </p>
                          ) : null}
                          {latestPlayedGame.reviewsCount > 0 &&
                          latestPlayedGame.reviewAverageRating ? (
                            <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
                              {latestPlayedGame.reviewAverageRating} ★
                              {latestPlayedGame.reviewAverageDifficultyRating ? (
                                <>
                                  {' '}·{' '}
                                  {latestPlayedGame.reviewAverageDifficultyRating} ◈
                                </>
                              ) : null}{' '}
                              -{' '}
                              {getReviewCountLabel(
                                latestPlayedGame.reviewsCount,
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {latestPlayedGame.isResultPublished && latestPlayedGame.place ? (
                        <GamePlaceBadge
                          place={latestPlayedGame.place}
                          label={`${latestPlayedGame.place} место`}
                        />
                      ) : (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                          {latestPlayedGame.isResultPublished
                            ? 'Без места'
                            : 'Результаты скрыты'}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReviewModalGame({
                        id: latestPlayedGame.id,
                        name: latestPlayedGame.gameName,
                        location:
                          latestPlayedGame.location ||
                          activeSession?.user?.location ||
                          '',
                      })
                    }
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-cyan-400 px-4 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-500/50 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                  >
                    {latestPlayedGame.reviewRating
                      ? `★ ${Number(latestPlayedGame.reviewRating).toFixed(1)}${
                          latestPlayedGame.reviewDifficultyRating
                            ? ` · ◈ ${Number(latestPlayedGame.reviewDifficultyRating).toFixed(1)}`
                            : ''
                        }`
                      : 'Оценить/Отзыв'}
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

          <div className="min-w-0 space-y-6 md:col-span-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">
                Последние события
              </h3>
              {dashboardData.recentActivity.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {dashboardData.recentActivity.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                    >
                      <p className="aq-modal-item-title text-sm font-semibold">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        {item.details}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {formatRelativeTimeFromNow(item.timestamp)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Событий пока нет. Как только появится активность, она
                  отобразится здесь.
                </p>
              )}
            </article>

            {hasAnyCityChatUrl ? (
              <article className="rounded-2xl border border-cyan-300 bg-cyan-50 p-5 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/10">
                <h3 className="aq-modal-section-title text-base font-semibold">
                  Чат проекта
                </h3>
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
      <GameReviewModal
        game={reviewModalGame}
        onClose={() => setReviewModalGame(null)}
        onSaved={() => router.refresh()}
      />
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
                  <p className="aq-modal-item-title truncate text-sm font-semibold">
                    {item.gameName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    {item.dateLabel}
                  </p>
                  {item.teamName ? (
                    <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                      {item.teamName}
                    </p>
                  ) : null}
                  {item.reviewsCount > 0 && item.reviewAverageRating ? (
                    <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-200">
                      {item.reviewAverageRating} ★
                      {item.reviewAverageDifficultyRating ? (
                        <>
                          {' '}· {item.reviewAverageDifficultyRating} ◈
                        </>
                      ) : null}{' '}
                      -{' '}
                      {getReviewCountLabel(item.reviewsCount)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReviewModalGame({
                      id: item.id,
                      name: item.gameName,
                      location:
                        item.location || activeSession?.user?.location || '',
                    })
                  }
                  className="inline-flex shrink-0 items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                >
                  {item.reviewRating
                    ? `★ ${Number(item.reviewRating).toFixed(1)}${
                        item.reviewDifficultyRating
                          ? ` · ◈ ${Number(item.reviewDifficultyRating).toFixed(1)}`
                          : ''
                      }`
                    : 'Оценить/Отзыв'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Завершённых игр пока нет.
          </p>
        )}
      </Modal>
      <UnifiedGameDescriptionModal
        selectedGame={dashboardData.latestPlayedGameDetails}
        isOpen={isPlayedGamePreviewOpen}
        onClose={() => setIsPlayedGamePreviewOpen(false)}
        canViewRestrictedGameInfo={['admin', 'dev'].includes(
          String(effectiveRole).toLowerCase(),
        )}
        canViewGameResults={Boolean(
          dashboardData.latestPlayedGameDetails &&
            ['finished', 'closed'].includes(
              String(
                dashboardData.latestPlayedGameDetails.status || '',
              ).toLowerCase(),
            ) &&
            (['admin', 'dev'].includes(String(effectiveRole).toLowerCase()) ||
              !dashboardData.latestPlayedGameDetails.hideResult),
        )}
        onOpenResults={() => {
          const game = dashboardData.latestPlayedGameDetails
          if (!game?.id) {
            return
          }

          router.push(
            `/${encodeURIComponent(
              game.location || activeSession?.user?.location || '',
            )}/game/result/${encodeURIComponent(game.id)}`,
          )
        }}
      />
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
            Рейтинг считается по всем закрытым рейтинговым играм города{' '}
            {dashboardData.cityName}.
          </p>
          <p>
            За каждую игру начисляется от 0 до 100 очков относительно числа
            соперников: первое место даёт 100, последнее — 0.
          </p>
          <p>
            Рейтинг — среднее число очков. Пропуски не уменьшают его и
            показываются только как статистика участия.
          </p>
          <p>
            При равных очках выше игрок с большим числом игр, затем побед и
            лучшим последним результатом.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Для попадания в рейтинг нужно минимум {RATING_MIN_PLAYED_GAMES}{' '}
            закрытые рейтинговые игры.
          </p>
        </div>
      </Modal>
      <RatingBreakdownModal
        key={isRatingBreakdownOpen ? ratingPlayerItem.id : 'closed'}
        item={isRatingBreakdownOpen ? ratingPlayerItem : null}
        type="players"
        onClose={() => setIsRatingBreakdownOpen(false)}
      />
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
          wins: PropTypes.number,
          seasonName: PropTypes.string,
          playedGames: PropTypes.number,
          missedGames: PropTypes.number,
          updatedAt: PropTypes.string,
        }),
        ratingPeriods: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            rating: PropTypes.object.isRequired,
          }),
        ),
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
            telegramId: PropTypes.oneOfType([
              PropTypes.string,
              PropTypes.number,
            ]),
            isCaptain: PropTypes.bool,
          }),
        ),
        games: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string,
            status: PropTypes.string,
            dateStart: PropTypes.string,
            hidden: PropTypes.bool,
          }),
        ),
      }),
    ),
    completedGamesCount: PropTypes.number,
    averageFinishedPlace: PropTypes.number,
    upcomingGamesCount: PropTypes.number,
    pastGamesCount: PropTypes.number,
    hasTeam: PropTypes.bool,
    hasUpcomingRegistration: PropTypes.bool,
    profileCompleted: PropTypes.bool,
    inProgressGame: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      status: PropTypes.string,
      dateStart: PropTypes.string,
      location: PropTypes.string,
      userTeamId: PropTypes.string,
      userTeamName: PropTypes.string,
    }),
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
        location: PropTypes.string,
        image: PropTypes.string,
        dateLabel: PropTypes.string.isRequired,
        teamName: PropTypes.string,
        place: PropTypes.number,
        isResultPublished: PropTypes.bool.isRequired,
        reviewRating: PropTypes.number,
        reviewDifficultyRating: PropTypes.number,
        reviewAverageRating: PropTypes.number,
        reviewAverageDifficultyRating: PropTypes.number,
        reviewsCount: PropTypes.number,
      }),
    ),
    latestPlayedGameDetails: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      status: PropTypes.string,
      location: PropTypes.string,
      hideResult: PropTypes.bool,
    }),
    rating: PropTypes.shape({
      isEligible: PropTypes.bool.isRequired,
      rank: PropTypes.number,
      totalRanked: PropTypes.number.isRequired,
      finalScore: PropTypes.number,
      wins: PropTypes.number,
      seasonName: PropTypes.string,
      playersAbove: PropTypes.number,
      playedGames: PropTypes.number.isRequired,
      missedGames: PropTypes.number.isRequired,
      breakdown: PropTypes.arrayOf(
        PropTypes.shape({
          gameId: PropTypes.string.isRequired,
          seasonId: PropTypes.string,
          gameName: PropTypes.string.isRequired,
          dateStart: PropTypes.string,
          place: PropTypes.number.isRequired,
          participantsCount: PropTypes.number.isRequired,
          score: PropTypes.number.isRequired,
          teamName: PropTypes.string,
        }),
      ),
    }),
    ratingPeriods: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        rating: PropTypes.object.isRequired,
      }),
    ),
    recentActivity: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        details: PropTypes.string.isRequired,
        timestamp: PropTypes.string.isRequired,
      }),
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
    inProgressGame: null,
    nearestGame: null,
    personalProgressGames: [],
    latestPlayedGameDetails: null,
    rating: {
      isEligible: false,
      rank: null,
      totalRanked: 0,
      finalScore: null,
      wins: 0,
      seasonName: null,
      playersAbove: null,
      playedGames: 0,
      missedGames: 0,
      breakdown: [],
    },
    ratingPeriods: [],
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
