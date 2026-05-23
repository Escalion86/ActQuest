import { memo, useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useAtomValue } from 'jotai'
import { useQuery } from '@tanstack/react-query'

import CabinetButton from '@components/cabinet/CabinetButton'
import CopyableId from '@components/cabinet/CopyableId'
import ParticipationGameCard from '@components/cabinet/cards/ParticipationGameCard'
import TeamMemberCard from '@components/cabinet/cards/TeamMemberCard'
import UserViewModal from '@components/cabinet/modals/UserViewModal'
import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'
import fetchCabinetGameDetails from '@helpers/fetchCabinetGameDetails'
import { canOpenRestrictedTeamGamePreview } from '@helpers/cabinetGameVisibility'
import { LOCATIONS } from '@server/serverConstants'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'
import UnifiedGameDescriptionModal from './UnifiedGameDescriptionModal'
import { isAdminAtom } from '@state/atoms/cabinetSessionAtom'

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
  const canViewIds = useAtomValue(isAdminAtom)
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

  useEffect(() => {
    if (!isOpen) {
      setIsGamePreviewModalOpen(false)
      setSelectedGamePreviewSource(null)
      setGamePreviewError('')
      setShowAllGames(false)
      setIsMemberPreviewModalOpen(false)
      setSelectedMemberUserId(null)
      setMemberPreviewError('')
    }
  }, [isOpen])

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
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {selectedTeam.open
                      ? 'Открыта для заявок'
                      : 'Закрытый состав'}
                  </p>
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
              <ModalSectionTitle>Информация</ModalSectionTitle>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Статус набора
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selectedTeam.open
                      ? 'Открыта для заявок'
                      : 'Закрытый состав'}
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
                    Рейтинг
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selectedTeam.rating?.isEligible &&
                    Number.isFinite(selectedTeam.rating?.rank)
                      ? `#${selectedTeam.rating.rank} · ${Number(selectedTeam.rating?.finalScore || 0).toFixed(2)}`
                      : 'Недостаточно данных для рейтинга'}
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
      finalScore: PropTypes.number,
      playedGames: PropTypes.number,
      missedGames: PropTypes.number,
      updatedAt: PropTypes.string,
    }),
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
