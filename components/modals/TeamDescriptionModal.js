import { memo, useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

import CabinetButton from '@components/cabinet/CabinetButton'
import CopyableId from '@components/cabinet/CopyableId'
import ParticipationGameCard from '@components/cabinet/cards/ParticipationGameCard'
import TeamMemberCard from '@components/cabinet/cards/TeamMemberCard'
import UserViewModal from '@components/cabinet/modals/UserViewModal'
import RatingBreakdownModal from '@components/cabinet/rating/RatingBreakdownModal'
import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'
import fetchCabinetGameDetails from '@helpers/fetchCabinetGameDetails'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import { canOpenRestrictedTeamGamePreview } from '@helpers/cabinetGameVisibility'
import isUserAdmin from '@helpers/isUserAdmin'
import { LOCATIONS } from '@server/serverConstants'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'
import UnifiedGameDescriptionModal from './UnifiedGameDescriptionModal'

const formatRatingScore = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '—'
}

const resolveLocationLabel = (locationKey) => {
  const key =
    typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''
  if (!key) {
    return 'Не указан'
  }
  const rawName = LOCATIONS?.[key]?.townRu
  if (!rawName || typeof rawName !== 'string') {
    return key
  }
  return rawName.charAt(0).toUpperCase() + rawName.slice(1)
}

const TeamDescriptionModal = ({
  isOpen,
  onClose,
  selectedTeam,
  canLeaveTeam,
  isLeavingTeam,
  onLeaveTeam,
  onOpenMember,
  onOpenGame,
  canViewRestrictedGameInfo,
}) => {
  const { data: session } = useSession()
  const canViewIds = isUserAdmin({ role: session?.user?.role ?? 'client' })
  const canViewRestrictedPreview = canOpenRestrictedTeamGamePreview({
    isAdminViewer: canViewIds,
    allowRestrictedPreview: canViewRestrictedGameInfo,
  })
  const [isGamePreviewModalOpen, setIsGamePreviewModalOpen] = useState(false)
  const [selectedGamePreviewSource, setSelectedGamePreviewSource] =
    useState(null)
  const [gamePreviewError, setGamePreviewError] = useState('')
  const [showAllGames, setShowAllGames] = useState(false)
  const [isMemberPreviewModalOpen, setIsMemberPreviewModalOpen] =
    useState(false)
  const [selectedMemberUserId, setSelectedMemberUserId] = useState(null)
  const [memberPreviewError, setMemberPreviewError] = useState('')
  const [isRatingInfoOpen, setIsRatingInfoOpen] = useState(false)
  const [isRatingBreakdownOpen, setIsRatingBreakdownOpen] = useState(false)
  const [ratingDetailsError, setRatingDetailsError] = useState('')
  const selectedTeamId =
    typeof selectedTeam?.id === 'string' ? selectedTeam.id : ''
  const selectedGamePreviewId =
    typeof selectedGamePreviewSource?.id === 'string'
      ? selectedGamePreviewSource.id
      : ''
  const selectedGamePreviewLocation =
    typeof selectedGamePreviewSource?.location === 'string'
      ? selectedGamePreviewSource.location
      : ''
  const gamePreviewQuery = useQuery({
    queryKey: [
      'game',
      selectedGamePreviewId,
      selectedGamePreviewLocation || null,
    ],
    queryFn: () =>
      fetchCabinetGameDetails({
        gameId: selectedGamePreviewId,
        location: selectedGamePreviewLocation || null,
      }),
    enabled: isOpen && isGamePreviewModalOpen && Boolean(selectedGamePreviewId),
    staleTime: 1000 * 60 * 5,
  })
  const selectedGamePreview =
    gamePreviewQuery.data || selectedGamePreviewSource
  const teamRatingDetailsQuery = useQuery({
    queryKey: ['team', selectedTeamId],
    queryFn: () => fetchCabinetTeamDetails({ teamId: selectedTeamId }),
    enabled: false,
    staleTime: 1000 * 60 * 5,
  })
  const teamWithRatingDetails =
    selectedTeam?.ratingPeriods?.length > 0
      ? selectedTeam
      : teamRatingDetailsQuery.data || selectedTeam

  useEffect(() => {
    if (!isOpen) {
      setIsGamePreviewModalOpen(false)
      setSelectedGamePreviewSource(null)
      setGamePreviewError('')
      setShowAllGames(false)
      setIsMemberPreviewModalOpen(false)
      setSelectedMemberUserId(null)
      setMemberPreviewError('')
      setIsRatingInfoOpen(false)
      setIsRatingBreakdownOpen(false)
      setRatingDetailsError('')
    }
  }, [isOpen])

  const handleOpenRatingBreakdown = useCallback(async () => {
    setRatingDetailsError('')
    if (teamWithRatingDetails?.ratingPeriods?.length > 0) {
      setIsRatingBreakdownOpen(true)
      return
    }

    try {
      const result = await teamRatingDetailsQuery.refetch()
      if (!result.data) {
        throw new Error('Не удалось загрузить подробный расчёт рейтинга')
      }
      setIsRatingBreakdownOpen(true)
    } catch (error) {
      setRatingDetailsError(
        error?.message || 'Не удалось загрузить подробный расчёт рейтинга',
      )
    }
  }, [teamRatingDetailsQuery, teamWithRatingDetails])

  const handleOpenMemberCard = useCallback(
    async (member) => {
      if (!member) {
        return
      }

      if (typeof onOpenMember === 'function') {
        onOpenMember(member)
        return
      }

      setMemberPreviewError('')
      const nextUserId =
        typeof member?.userId === 'string' && member.userId.trim()
          ? member.userId.trim()
          : null

      if (!nextUserId) {
        setMemberPreviewError('Не удалось определить идентификатор пользователя')
        return
      }

      setSelectedMemberUserId(nextUserId)
      setIsMemberPreviewModalOpen(true)
    },
    [onOpenMember],
  )

  const handleOpenGameCard = useCallback(
    (game) => {
      if (!game) {
        return
      }

      if (typeof onOpenGame === 'function') {
        onOpenGame(game)
        return
      }

      setGamePreviewError('')
      setSelectedGamePreviewSource(game)
      setIsGamePreviewModalOpen(true)
    },
    [onOpenGame],
  )

  useEffect(() => {
    if (gamePreviewQuery.error) {
      setGamePreviewError(
        gamePreviewQuery.error?.message || 'Не удалось загрузить данные игры',
      )
    }
  }, [gamePreviewQuery.error])

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={`Команда — ${selectedTeam?.name || 'Без названия'}`}
        onClose={onClose}
        footer={
          canLeaveTeam ? (
            <>
              <CabinetButton
                type="button"
                variant="secondary"
                tone="neutral"
                onClick={onClose}
                disabled={isLeavingTeam}
              >
                Закрыть
              </CabinetButton>
              <CabinetButton
                type="button"
                variant="secondary"
                tone="danger"
                onClick={onLeaveTeam}
                disabled={isLeavingTeam}
              >
                {isLeavingTeam ? 'Выходим...' : 'Выйти из команды'}
              </CabinetButton>
            </>
          ) : undefined
        }
      >
        {selectedTeam ? (
          <div className="space-y-6">
            <ModalSection className="p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
                  <img
                    src={selectedTeam.image || '/img/avatars/team.png'}
                    alt={`Иконка команды ${selectedTeam.name || 'Без названия'}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selectedTeam.name || 'Без названия'}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      selectedTeam.open
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200'
                    }`}
                  >
                    {selectedTeam.open
                      ? 'Открыта для заявок'
                      : 'Закрыта для заявок'}
                  </span>
                </div>
              </div>
            </ModalSection>

            {typeof selectedTeam.description === 'string' &&
            selectedTeam.description.trim() ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-800/60">
                <ModalSectionTitle>Описание</ModalSectionTitle>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                  {selectedTeam.description}
                </p>
              </div>
            ) : null}

            <ModalSection className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <ModalSectionTitle>Рейтинг команды</ModalSectionTitle>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenRatingBreakdown}
                    disabled={teamRatingDetailsQuery.isFetching}
                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                  >
                    {teamRatingDetailsQuery.isFetching
                      ? 'Загрузка…'
                      : 'Подробнее'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRatingInfoOpen(true)}
                    className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                    aria-label="Как считается рейтинг команды"
                    title="Как считается рейтинг команды"
                  >
                    i
                  </button>
                </div>
              </div>
              {ratingDetailsError ? (
                <p className="text-xs text-rose-600 dark:text-rose-300">
                  {ratingDetailsError}
                </p>
              ) : null}
              <div className="space-y-1">
                {selectedTeam.rating?.isEligible ? (
                  <>
                  <p className="text-lg font-semibold text-primary dark:text-slate-100">
                    #{selectedTeam.rating.rank} из{' '}
                    {selectedTeam.rating.totalRanked}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Рейтинговые очки:{' '}
                    {formatRatingScore(selectedTeam.rating.finalScore)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Рейтинговых игр: {selectedTeam.rating.playedGames ?? 0} ·
                    Побед: {selectedTeam.rating.wins ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-300">
                    Учтены закрытые рейтинговые игры города{' '}
                    {resolveLocationLabel(selectedTeam.location)}.
                  </p>
                  </>
                ) : (
                  <>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                    Недостаточно данных для рейтинга
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Нужно минимум три закрытые рейтинговые игры. Сейчас сыграно:{' '}
                    {selectedTeam.rating?.playedGames ?? 0}
                  </p>
                  </>
                )}
              </div>
            </ModalSection>

            <ModalSection className="p-4 sm:p-5">
              <ModalSectionTitle>Информация</ModalSectionTitle>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Статус набора
                  </dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        selectedTeam.open
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200'
                      }`}
                    >
                    {selectedTeam.open
                      ? 'Открыта для заявок'
                      : 'Закрыта для заявок'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Участников
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selectedTeam.membersCount ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Город
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {resolveLocationLabel(selectedTeam.location)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Сыгранных игр
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selectedTeam.gamesCount ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Капитан
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selectedTeam.captain?.name || 'Не назначен'}
                    {selectedTeam.captain?.username
                      ? ` (@${selectedTeam.captain.username})`
                      : ''}
                  </dd>
                </div>
                {selectedTeam.createdAt && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Создана
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      {formatDate(selectedTeam.createdAt)}
                    </dd>
                  </div>
                )}
                {canViewIds && selectedTeam.id ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      ID
                    </dt>
                    <dd className="mt-1">
                      <CopyableId id={selectedTeam.id} label="Team ID" />
                    </dd>
                  </div>
                ) : null}
              </dl>
            </ModalSection>

            <ModalSection className="p-4 sm:p-5">
              <ModalSectionTitle>Состав команды</ModalSectionTitle>
              {memberPreviewError ? (
                <p className="mt-2 text-xs text-rose-500">
                  {memberPreviewError}
                </p>
              ) : null}
              {selectedTeam.members?.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {selectedTeam.members.map((member, memberIndex) => (
                    <li
                      key={`${member.id || member.userId || 'member'}-${memberIndex}`}
                    >
                      <TeamMemberCard
                        member={member}
                        onOpen={handleOpenMemberCard}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Пока нет участников. Пригласите игроков через телеграм-бота,
                  чтобы они появились здесь.
                </p>
              )}
            </ModalSection>

            {selectedTeam.games?.length > 0 && (
              <ModalSection className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <ModalSectionTitle>Сыгранных игр</ModalSectionTitle>
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    Всего: {selectedTeam.games.length}
                  </span>
                </div>
                {gamePreviewError ? (
                  <p className="mt-2 text-xs text-rose-500">
                    {gamePreviewError}
                  </p>
                ) : null}
                <ul className="mt-4 space-y-3">
                  {(showAllGames
                    ? selectedTeam.games
                    : selectedTeam.games.slice(0, 5)
                  ).map((game, gameIndex) => (
                    <li
                      key={`${game.id || 'game'}-${game.location || ''}-${gameIndex}`}
                    >
                      <ParticipationGameCard
                        game={game}
                        onOpen={() => handleOpenGameCard(game)}
                        showTeam={false}
                        footerText={
                          game.hidden ? 'Игра скрыта из публичного списка' : ''
                        }
                      />
                    </li>
                  ))}
                </ul>
                {!showAllGames && selectedTeam.games.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllGames(true)}
                    className="mt-3 w-full text-xs font-medium text-primary transition hover:underline dark:text-sky-300"
                  >
                    Показать остальные {selectedTeam.games.length - 5} игр
                  </button>
                ) : null}
              </ModalSection>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Выберите команду из списка слева, чтобы просмотреть детали.
          </p>
        )}
      </Modal>
      <UnifiedGameDescriptionModal
        selectedGame={selectedGamePreview}
        isOpen={isOpen && isGamePreviewModalOpen}
        onClose={() => {
          setIsGamePreviewModalOpen(false)
          setSelectedGamePreviewSource(null)
        }}
        canViewRestrictedGameInfo={canViewRestrictedPreview}
        canViewGameResults={Boolean(
          selectedGamePreview?.status === 'closed' ||
          selectedGamePreview?.status === 'finished',
        )}
      />
      <UserViewModal
        userId={selectedMemberUserId}
        isOpen={isOpen && isMemberPreviewModalOpen}
        onClose={() => {
          setIsMemberPreviewModalOpen(false)
          setSelectedMemberUserId(null)
        }}
        canViewContacts={canViewIds}
      />
      <Modal
        isOpen={isOpen && isRatingInfoOpen}
        onClose={() => setIsRatingInfoOpen(false)}
        title="Как считается рейтинг команды"
      >
        <div className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-200">
          <p>
            За каждую игру команда получает от 0 до 100 очков относительно
            числа соперников: первое место даёт 100, последнее — 0.
          </p>
          <p>
            Рейтинг — среднее число очков. Пропуски не уменьшают его и
            показываются только как статистика участия.
          </p>
          <p>
            При равных очках выше команда с большим числом игр, затем побед и
            лучшим последним результатом.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Для попадания в рейтинг нужно минимум три закрытые рейтинговые
            игры.
          </p>
        </div>
      </Modal>
      <RatingBreakdownModal
        key={
          isRatingBreakdownOpen
            ? `team-rating-${selectedTeam?.id || 'unknown'}`
            : 'team-rating-closed'
        }
        item={
          isOpen && isRatingBreakdownOpen && teamWithRatingDetails
            ? {
                id: teamWithRatingDetails.id || 'team',
                name: teamWithRatingDetails.name || 'Команда ActQuest',
                rating: teamWithRatingDetails.rating,
                ratingPeriods: teamWithRatingDetails.ratingPeriods,
              }
            : null
        }
        type="teams"
        onClose={() => setIsRatingBreakdownOpen(false)}
      />
    </>
  )
}

TeamDescriptionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  canLeaveTeam: PropTypes.bool,
  isLeavingTeam: PropTypes.bool,
  onLeaveTeam: PropTypes.func,
  onOpenMember: PropTypes.func,
  onOpenGame: PropTypes.func,
  canViewRestrictedGameInfo: PropTypes.bool,
  selectedTeam: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    open: PropTypes.bool,
    location: PropTypes.string,
    membersCount: PropTypes.number,
    gamesCount: PropTypes.number,
    rating: PropTypes.shape({
      isEligible: PropTypes.bool,
      rank: PropTypes.number,
      totalRanked: PropTypes.number,
      finalScore: PropTypes.number,
      playedGames: PropTypes.number,
      missedGames: PropTypes.number,
      wins: PropTypes.number,
      updatedAt: PropTypes.string,
    }),
    ratingPeriods: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        rating: PropTypes.object.isRequired,
      }),
    ),
    captain: PropTypes.shape({
      name: PropTypes.string,
      username: PropTypes.string,
    }),
    updatedAt: PropTypes.string,
    createdAt: PropTypes.string,
    members: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        userId: PropTypes.string,
        name: PropTypes.string,
        username: PropTypes.string,
        userRole: PropTypes.string,
        hasLinkedUser: PropTypes.bool,
        phone: PropTypes.string,
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
}

TeamDescriptionModal.defaultProps = {
  canLeaveTeam: false,
  isLeavingTeam: false,
  onLeaveTeam: undefined,
  onOpenMember: undefined,
  onOpenGame: undefined,
  canViewRestrictedGameInfo: false,
  selectedTeam: null,
}

export default memo(TeamDescriptionModal)
