import Head from 'next/head'
import PropTypes from 'prop-types'
import { useMemo, useState } from 'react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import Modal from '@components/Modal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import getSessionSafe from '@helpers/getSessionSafe'
import { resolveCabinetCallback } from '@helpers/cabinetAuth'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { toStringId } from '@helpers/idAndDate'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import resolveEntityRating from '@helpers/resolveEntityRating'
import useMergedSession from '@helpers/useMergedSession'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

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

const resolveRatingBadge = (rating) =>
  rating?.isEligible && Number.isFinite(rating?.rank)
    ? `#${rating.rank}`
    : null

const CabinetDashboard = ({
  session: initialSession,
  dashboardData: initialDashboardData,
}) => {
  const { activeSession, status } = useMergedSession(initialSession)

  const dashboardData = initialDashboardData ?? {
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
  }
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [isTeamDescriptionOpen, setIsTeamDescriptionOpen] = useState(false)
  const [isAllPlayedGamesOpen, setIsAllPlayedGamesOpen] = useState(false)
  const [isPlayedGamePreviewOpen, setIsPlayedGamePreviewOpen] = useState(false)
  const [previewPlayedGame, setPreviewPlayedGame] = useState(null)
  const [isRatingInfoOpen, setIsRatingInfoOpen] = useState(false)
  const selectedTeam = useMemo(
    () => dashboardData.participantTeams.find((team) => team.id === selectedTeamId) ?? null,
    [dashboardData.participantTeams, selectedTeamId]
  )
  const latestPlayedGame = dashboardData.personalProgressGames[0] ?? null

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
          <Head>
            <title>ActQuest — Кабинет</title>
          </Head>
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
      <Head>
        <title>ActQuest — Обзор</title>
      </Head>
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
              {dashboardData.participantTeams.length > 0 ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {dashboardData.participantTeams.map((team) => (
                    <li key={team.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeamId(team.id)
                          setIsTeamDescriptionOpen(true)
                        }}
                        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
                        title={team.name}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {team.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                              Участников: {team.membersCount ?? 0}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                              Игр: {team.gamesCount ?? 0}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {resolveRatingBadge(team.rating) ? (
                              <span className="inline-flex items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                {resolveRatingBadge(team.rating)}
                              </span>
                            ) : null}
                            {team.isCaptain ? (
                              <span className="inline-flex items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                Капитан
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">Вы пока не состоите в командах</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Ближайшая игра</h3>
              {dashboardData.nearestGame ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="aq-modal-item-title text-sm font-semibold">
                    {dashboardData.nearestGame.name || 'Без названия'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                    {dashboardData.nearestGame.dateStart
                      ? new Date(dashboardData.nearestGame.dateStart).toLocaleString('ru-RU')
                      : 'Дата старта уточняется'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    Статус: {getGameStatusLabel(dashboardData.nearestGame.status)}
                  </p>
                  <a
                    href="/cabinet/games?view=upcoming"
                    className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
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

            {dashboardData.chatUrl ? (
              <article className="rounded-2xl border border-cyan-300 bg-cyan-50 p-5 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/10">
                <h3 className="aq-modal-section-title text-base font-semibold">Чат проекта</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                  Вопросы, анонсы и быстрые ответы команды ActQuest.
                </p>
                <a
                  href={dashboardData.chatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg border border-cyan-400 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-300/50 dark:text-cyan-100 dark:hover:bg-cyan-500/15"
                >
                  Перейти в чат
                </a>
              </article>
            ) : null}
          </div>
        </section>
      </CabinetLayout>
      <TeamDescriptionModal
        isOpen={isTeamDescriptionOpen}
        onClose={() => setIsTeamDescriptionOpen(false)}
        selectedTeam={selectedTeam}
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
              href={`/cabinet/games?view=past&gameId=${encodeURIComponent(previewPlayedGame.id)}`}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
            >
              Открыть в списке игр
            </a>
          </div>
        ) : null}
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
        name: PropTypes.string,
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
  },
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)
  const { relativeCallback, isSafe } = resolveCabinetCallback(context?.query?.callbackUrl, context?.req)

  if (!session) {
    const target = isSafe ? relativeCallback : null
    const query = target ? `?callbackUrl=${encodeURIComponent(target)}` : ''

    return {
      redirect: {
        destination: `/cabinet/login${query}`,
        permanent: false,
      },
    }
  }

  if (
    isSafe &&
    relativeCallback &&
    relativeCallback !== '/cabinet' &&
    relativeCallback !== '/cabinet/'
  ) {
    return {
      redirect: {
        destination: relativeCallback,
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  const cityName = normalizeLocationName(location)
  const userRole = session?.user?.role ?? 'client'
  const canViewHiddenGames = userRole === 'admin' || userRole === 'dev' || userRole === 'moder'
  const canSeeClosedStatus = userRole === 'admin' || userRole === 'dev'

  const dashboardData = {
    cityName,
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
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return { props: { session, dashboardData } }
    }

    const UsersModel = db.model('Users')
    const TeamsUsersModel = db.model('TeamsUsers')
    const TeamsModel = db.model('Teams')
    const GamesTeamsModel = db.model('GamesTeams')
    const GamesModel = db.model('Games')
    const SiteSettingsModel = db.model('SiteSettings')

    const userFilter = resolveSessionUserFilter(session.user)
    const sessionUserId = toStringId(session?.user?.globalUserId || session?.user?._id)
    const sessionTelegramId =
      session?.user?.telegramId === null || session?.user?.telegramId === undefined
        ? null
        : Number(session.user.telegramId)

    const [userDoc, siteSettingsDoc] = await Promise.all([
      userFilter
        ? UsersModel.findOne(userFilter)
            .select({ _id: 1, name: 1, about: 1, phone: 1 })
            .lean()
        : null,
      SiteSettingsModel.findOne({}).lean(),
    ])

    const userId = toStringId(userDoc?._id) || sessionUserId
    const membershipOr = []
    if (userId) {
      membershipOr.push({ userId })
    }
    if (Number.isFinite(sessionTelegramId)) {
      membershipOr.push({ userTelegramId: sessionTelegramId })
    }

    const memberships = membershipOr.length
      ? await TeamsUsersModel.find({ $or: membershipOr })
          .select({ teamId: 1, role: 1, updatedAt: 1, createdAt: 1 })
          .lean()
      : []

    const teamIds = Array.from(
      new Set(
        memberships
          .map((membership) => toStringId(membership?.teamId))
          .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
      )
    )

    const [teamsDocs, gamesTeamsDocs, teamMembersDocs] = await Promise.all([
      teamIds.length
        ? TeamsModel.find({ _id: { $in: teamIds } })
            .select({
              _id: 1,
              name: 1,
              description: 1,
              open: 1,
              rating: 1,
              ratingsByLocation: 1,
              updatedAt: 1,
              createdAt: 1,
            })
            .lean()
        : [],
      teamIds.length
        ? GamesTeamsModel.find({ teamId: { $in: teamIds } })
            .select({ gameId: 1, teamId: 1 })
            .lean()
        : [],
      teamIds.length
        ? TeamsUsersModel.find({ teamId: { $in: teamIds } })
            .select({ teamId: 1, userId: 1, userTelegramId: 1, role: 1 })
            .lean()
        : [],
    ])

    const gameIds = Array.from(
      new Set(
        gamesTeamsDocs
          .map((link) => toStringId(link?.gameId))
          .filter((gameId) => typeof gameId === 'string' && gameId.length > 0)
      )
    )

    const gamesQuery = { _id: { $in: gameIds } }
    if (!canViewHiddenGames) {
      gamesQuery.hidden = { $ne: true }
    }

    const gamesDocs = gameIds.length
      ? await GamesModel.find(gamesQuery)
          .select({
            _id: 1,
            name: 1,
            image: 1,
            isRated: 1,
            status: 1,
            location: 1,
            dateStart: 1,
            hidden: 1,
            updatedAt: 1,
            createdAt: 1,
            'result.teamsPlaces': 1,
            'result.teamsUsers': 1,
          })
          .lean()
      : []

    const memberUserIds = Array.from(
      new Set(
        teamMembersDocs
          .map((member) => toStringId(member?.userId))
          .filter((id) => typeof id === 'string' && id.length > 0)
      )
    )
    const memberTelegramIds = Array.from(
      new Set(
        teamMembersDocs
          .map((member) => Number(member?.userTelegramId))
          .filter((id) => Number.isFinite(id))
      )
    )

    const memberUsersDocs = memberUserIds.length || memberTelegramIds.length
      ? await UsersModel.find({
          $or: [
            ...(memberUserIds.length ? [{ _id: { $in: memberUserIds } }] : []),
            ...(memberTelegramIds.length ? [{ telegramId: { $in: memberTelegramIds } }] : []),
          ],
        })
          .select({
            _id: 1,
            name: 1,
            username: 1,
            phone: 1,
            telegramId: 1,
            role: 1,
          })
          .lean()
      : []

    const now = new Date()
    const upcomingGames = gamesDocs.filter((game) => isUpcomingGame(game, now))
    const pastGames = gamesDocs.filter((game) => isPastGame(game, now))
    const nearestGame = [...upcomingGames]
      .sort((a, b) => {
        const aTime = a?.dateStart ? new Date(a.dateStart).getTime() : Number.POSITIVE_INFINITY
        const bTime = b?.dateStart ? new Date(b.dateStart).getTime() : Number.POSITIVE_INFINITY
        return aTime - bTime
      })[0]

    const membersCountMap = teamMembersDocs.reduce((acc, doc) => {
      const teamId = toStringId(doc?.teamId)
      if (!teamId) return acc
      acc[teamId] = (acc[teamId] ?? 0) + 1
      return acc
    }, {})
    const usersById = memberUsersDocs.reduce((acc, user) => {
      const userId = toStringId(user?._id)
      if (userId) {
        acc[userId] = user
      }
      return acc
    }, {})
    const usersByTelegramId = memberUsersDocs.reduce((acc, user) => {
      const telegramId = Number(user?.telegramId)
      if (Number.isFinite(telegramId)) {
        acc[telegramId] = user
      }
      return acc
    }, {})
    const teamMembersByTeamId = teamMembersDocs.reduce((acc, member) => {
      const teamId = toStringId(member?.teamId)
      if (!teamId) {
        return acc
      }
      if (!acc[teamId]) {
        acc[teamId] = []
      }
      acc[teamId].push(member)
      return acc
    }, {})
    const gamesById = gamesDocs.reduce((acc, game) => {
      const gameId = toStringId(game?._id)
      if (gameId) {
        acc[gameId] = game
      }
      return acc
    }, {})
    const gamesByTeamId = gamesTeamsDocs.reduce((acc, link) => {
      const teamId = toStringId(link?.teamId)
      const gameId = toStringId(link?.gameId)
      if (!teamId || !gameId) {
        return acc
      }
      if (!acc[teamId]) {
        acc[teamId] = []
      }
      const game = gamesById[gameId]
      if (game) {
        acc[teamId].push(game)
      }
      return acc
    }, {})
    const membershipRoleByTeamId = memberships.reduce((acc, membership) => {
      const teamId = toStringId(membership?.teamId)
      if (!teamId) {
        return acc
      }
      const isCaptain = membership?.role === 'capitan'
      if (isCaptain) {
        acc[teamId] = true
      } else if (acc[teamId] === undefined) {
        acc[teamId] = false
      }
      return acc
    }, {})
    const participantTeams = teamsDocs
      .map((team) => {
        const teamId = toStringId(team?._id)
        if (!teamId) {
          return null
        }
        const teamName = typeof team?.name === 'string' ? team.name.trim() : ''
        const memberEntries = teamMembersByTeamId[teamId] ?? []
        const members = memberEntries.map((member, index) => {
          const memberUserId = toStringId(member?.userId)
          const memberTelegramId = Number(member?.userTelegramId)
          const linkedUser =
            (memberUserId ? usersById[memberUserId] : null) ||
            (Number.isFinite(memberTelegramId) ? usersByTelegramId[memberTelegramId] : null) ||
            null
          return {
            id:
              memberUserId ||
              (Number.isFinite(memberTelegramId) ? `tg-${memberTelegramId}` : `member-${teamId}-${index}`),
            name: linkedUser?.name || 'Без имени',
            username: linkedUser?.username || '',
            userRole: linkedUser?.role || 'client',
            hasLinkedUser: Boolean(linkedUser),
            phone: linkedUser?.phone ? String(linkedUser.phone) : '',
            telegramId: Number.isFinite(memberTelegramId) ? memberTelegramId : null,
            isCaptain: member?.role === 'capitan',
          }
        })
        const captain = members.find((member) => member.isCaptain) ?? null
        const teamGames = (gamesByTeamId[teamId] ?? [])
          .map((game) => ({
            id: toStringId(game?._id) || '',
            name: game?.name || 'Без названия',
            status:
              game?.status === 'closed' && !canSeeClosedStatus
                ? 'finished'
                : game?.status || '',
            dateStart: game?.dateStart ? new Date(game.dateStart).toISOString() : null,
            hidden: Boolean(game?.hidden),
          }))
          .filter((game) => game.id)
        return {
          id: teamId,
          name: teamName || 'Без названия',
          isCaptain: Boolean(membershipRoleByTeamId[teamId]),
          description: typeof team?.description === 'string' ? team.description : '',
          open: Boolean(team?.open),
          rating: resolveEntityRating({ entity: team, location }),
          membersCount: membersCountMap[teamId] ?? members.length,
          gamesCount: teamGames.length,
          captain,
          updatedAt: team?.updatedAt ? new Date(team.updatedAt).toISOString() : null,
          createdAt: team?.createdAt ? new Date(team.createdAt).toISOString() : null,
          members,
          games: teamGames,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    const teamNameById = teamsDocs.reduce((acc, team) => {
      const teamId = toStringId(team?._id)
      if (!teamId) {
        return acc
      }
      const teamName = typeof team?.name === 'string' ? team.name.trim() : ''
      if (teamName) {
        acc[teamId] = teamName
      }
      return acc
    }, {})

    const teamActivity = teamsDocs.map((team) => {
      const teamId = toStringId(team?._id)
      const timestamp = team?.updatedAt ?? team?.createdAt ?? null
      return {
        id: `team-${teamId ?? Math.random().toString(36).slice(2)}`,
        title: `Команда «${team?.name || 'Без названия'}»`,
        details: `Участников: ${membersCountMap[teamId] ?? 0}`,
        timestamp: timestamp ? new Date(timestamp).toISOString() : null,
      }
    })

    const gameActivity = gamesDocs.map((game) => {
      const gameId = toStringId(game?._id)
      const timestamp = game?.updatedAt ?? game?.createdAt ?? null
      return {
        id: `game-${gameId ?? Math.random().toString(36).slice(2)}`,
        title: `Игра «${game?.name || 'Без названия'}»`,
        details: `Статус: ${getGameStatusLabel(game?.status)}`,
        timestamp: timestamp ? new Date(timestamp).toISOString() : null,
      }
    })

    const recentActivity = [...gameActivity, ...teamActivity]
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6)

    const ratingGamesQuery = {
      status: 'closed',
      isRated: { $ne: false },
    }

    if (location) {
      ratingGamesQuery.location = location
    }

    if (!canViewHiddenGames) {
      ratingGamesQuery.hidden = { $ne: true }
    }

    const ratedFinishedGames = await GamesModel.find(ratingGamesQuery)
      .select({
        _id: 1,
        dateStart: 1,
        'result.teamsPlaces': 1,
        'result.teamsUsers': 1,
      })
      .lean()

    const ratingTimeline = ratedFinishedGames
      .map((game) => {
        const teamsUsers = Array.isArray(game?.result?.teamsUsers) ? game.result.teamsUsers : []
        const participantsPlaces = new Map()

        teamsUsers.forEach((membership) => {
          const membershipUserId = toStringId(membership?.userId)
          const membershipTelegramId = Number(membership?.userTelegramId)
          const participantKey = resolveParticipantRatingKey(membershipUserId, membershipTelegramId)
          if (!participantKey) {
            return
          }

          const teamId = toStringId(membership?.teamId)
          const place = resolveTeamsPlace(game?.result?.teamsPlaces, teamId)
          if (!Number.isFinite(place)) {
            return
          }

          const prevPlace = participantsPlaces.get(participantKey)
          const numericPlace = Number(place)
          if (!Number.isFinite(prevPlace) || numericPlace < prevPlace) {
            participantsPlaces.set(participantKey, numericPlace)
          }
        })

        if (!participantsPlaces.size) {
          return null
        }

        const startedAt = game?.dateStart ? new Date(game.dateStart).getTime() : Number.NaN
        return {
          id: toStringId(game?._id) || '',
          startedAt: Number.isFinite(startedAt) ? startedAt : Number.POSITIVE_INFINITY,
          participantsPlaces,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.startedAt !== b.startedAt) {
          return a.startedAt - b.startedAt
        }
        return a.id.localeCompare(b.id, 'ru')
      })

    const participantKeys = new Set()
    ratingTimeline.forEach((game) => {
      game.participantsPlaces.forEach((_, participantKey) => {
        participantKeys.add(participantKey)
      })
    })

    const ratingMetricsByParticipant = new Map()

    participantKeys.forEach((participantKey) => {
      const firstPlayedIndex = ratingTimeline.findIndex((game) =>
        game.participantsPlaces.has(participantKey)
      )
      if (firstPlayedIndex < 0) {
        return
      }

      const metrics = { places: [], missedGames: 0 }
      for (let index = firstPlayedIndex; index < ratingTimeline.length; index += 1) {
        const game = ratingTimeline[index]
        const place = game.participantsPlaces.get(participantKey)
        if (Number.isFinite(place)) {
          metrics.places.push(Number(place))
        } else {
          metrics.missedGames += 1
        }
      }

      ratingMetricsByParticipant.set(participantKey, metrics)
    })

    const ratingRows = Array.from(ratingMetricsByParticipant.entries())
      .map(([participantKey, rawMetrics]) => {
        const metrics = buildPlayerRatingMetrics(rawMetrics)
        return {
          participantKey,
          ...metrics,
        }
      })
      .filter((item) => item.playedGames > 0 || item.missedGames > 0)

    const eligibleRatingRows = ratingRows
      .filter((item) => item.isEligible)
      .sort((a, b) => {
        if (a.finalScore !== b.finalScore) {
          return a.finalScore - b.finalScore
        }
        if (a.playedGames !== b.playedGames) {
          return b.playedGames - a.playedGames
        }
        return a.participantKey.localeCompare(b.participantKey, 'ru')
      })

    const sessionRatingKeys = [
      resolveParticipantRatingKey(userId, null),
      resolveParticipantRatingKey(null, sessionTelegramId),
    ].filter(Boolean)

    const currentRatingRow =
      sessionRatingKeys
        .map((key) => ratingRows.find((item) => item.participantKey === key))
        .find(Boolean) ?? null

    if (currentRatingRow) {
      const rankIndex = eligibleRatingRows.findIndex(
        (item) => item.participantKey === currentRatingRow.participantKey
      )
      const rank = rankIndex >= 0 ? rankIndex + 1 : null

      dashboardData.rating = {
        isEligible: currentRatingRow.isEligible && Number.isFinite(rank),
        rank,
        totalRanked: eligibleRatingRows.length,
        finalScore: currentRatingRow.finalScore,
        playersAbove: Number.isFinite(rank) ? rank - 1 : null,
        playedGames: currentRatingRow.playedGames,
        missedGames: currentRatingRow.missedGames,
      }
    }

    const gameTeamIdsByGameId = gamesTeamsDocs.reduce((acc, link) => {
      const gameId = toStringId(link?.gameId)
      const teamId = toStringId(link?.teamId)
      if (!gameId || !teamId) {
        return acc
      }
      if (!acc[gameId]) {
        acc[gameId] = new Set()
      }
      acc[gameId].add(teamId)
      return acc
    }, {})

    const finishedProgressItems = [...pastGames]
      .filter((game) => {
        const status = (game?.status ?? '').toString().toLowerCase()
        return status === 'finished' || status === 'closed'
      })
      .map((game) => {
        const gameId = toStringId(game?._id)
        const teamIdFromResult = resolveUserTeamIdFromResult(game?.result, userId, sessionTelegramId)
        const teamIdFromLinks =
          gameId && gameTeamIdsByGameId[gameId] ? [...gameTeamIdsByGameId[gameId]][0] : null
        const resolvedTeamId = teamIdFromResult || teamIdFromLinks
        const place = resolveTeamsPlace(game?.result?.teamsPlaces, resolvedTeamId)
        const teamName =
          resolveTeamNameFromResult(game?.result, resolvedTeamId) ||
          (resolvedTeamId ? teamNameById[resolvedTeamId] || null : null)
        const gameDate = game?.dateStart ? new Date(game.dateStart) : null
        const timestamp =
          gameDate && !Number.isNaN(gameDate.getTime()) ? gameDate.getTime() : 0
        return {
          id: gameId || `progress-${Math.random().toString(36).slice(2)}`,
          gameName: game?.name || 'Без названия',
          image: typeof game?.image === 'string' ? game.image : '',
          dateLabel:
            gameDate && !Number.isNaN(gameDate.getTime())
              ? gameDate.toLocaleString('ru-RU', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Дата не указана',
          teamName,
          place,
          timestamp,
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
    const personalProgressGames = finishedProgressItems.map(({ timestamp, ...item }) => item)
    const placesForAverage = finishedProgressItems
      .map((item) => item.place)
      .filter((place) => Number.isFinite(place))
    const averageFinishedPlace = placesForAverage.length
      ? placesForAverage.reduce((sum, place) => sum + place, 0) / placesForAverage.length
      : null

    const normalizedSiteSettings = normalizeSiteSettings(siteSettingsDoc)
    const hasProfileName = typeof userDoc?.name === 'string' && userDoc.name.trim().length > 0
    const hasProfileAbout = typeof userDoc?.about === 'string' && userDoc.about.trim().length > 0
    const hasProfilePhone = Boolean(userDoc?.phone)

    dashboardData.teamsCount = teamIds.length
    dashboardData.participantTeams = participantTeams
    dashboardData.completedGamesCount = finishedProgressItems.length
    dashboardData.averageFinishedPlace = averageFinishedPlace
    dashboardData.upcomingGamesCount = upcomingGames.length
    dashboardData.pastGamesCount = pastGames.length
    dashboardData.hasTeam = teamIds.length > 0
    dashboardData.hasUpcomingRegistration = upcomingGames.length > 0
    dashboardData.profileCompleted = hasProfileName && (hasProfileAbout || hasProfilePhone)
    dashboardData.nearestGame = nearestGame
      ? {
          id: toStringId(nearestGame._id),
          name: nearestGame.name ?? 'Без названия',
          status: nearestGame.status ?? '',
          dateStart: nearestGame.dateStart
            ? new Date(nearestGame.dateStart).toISOString()
            : null,
        }
      : null
    dashboardData.personalProgressGames = personalProgressGames
    dashboardData.recentActivity = recentActivity
    dashboardData.chatUrl = normalizedSiteSettings.chatUrl || ''
  } catch (error) {
    console.error('Failed to load client dashboard data', error)
  }

  return {
    props: {
      session,
      dashboardData,
    },
  }
}

export default CabinetDashboard
