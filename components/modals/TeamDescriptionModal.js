import { memo, useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import CabinetButton from '@components/cabinet/CabinetButton'
import ParticipationGameCard from '@components/cabinet/cards/ParticipationGameCard'
import TeamMemberCard from '@components/cabinet/cards/TeamMemberCard'
import Modal from '@components/Modal'
import fetchCabinetUserDetails from '@helpers/fetchCabinetUserDetails'
import formatDate from '@helpers/formatDate'
import fetchCabinetGameDetails from '@helpers/fetchCabinetGameDetails'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'
import UnifiedGameDescriptionModal from './UnifiedGameDescriptionModal'

const TeamDescriptionModal = ({
  isOpen,
  onClose,
  selectedTeam,
  canLeaveTeam,
  isLeavingTeam,
  onLeaveTeam,
  onOpenMember,
  onOpenGame,
}) => {
  const [isGamePreviewModalOpen, setIsGamePreviewModalOpen] = useState(false)
  const [selectedGamePreview, setSelectedGamePreview] = useState(null)
  const [isGamePreviewLoading, setIsGamePreviewLoading] = useState(false)
  const [gamePreviewError, setGamePreviewError] = useState('')
  const [isMemberPreviewModalOpen, setIsMemberPreviewModalOpen] = useState(false)
  const [selectedMemberPreview, setSelectedMemberPreview] = useState(null)
  const [isMemberPreviewLoading, setIsMemberPreviewLoading] = useState(false)
  const [memberPreviewError, setMemberPreviewError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setIsGamePreviewModalOpen(false)
      setSelectedGamePreview(null)
      setIsGamePreviewLoading(false)
      setGamePreviewError('')
      setIsMemberPreviewModalOpen(false)
      setSelectedMemberPreview(null)
      setIsMemberPreviewLoading(false)
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

      setIsMemberPreviewLoading(true)
      setMemberPreviewError('')
      try {
        const detailedUser = await fetchCabinetUserDetails({
          userId: member.userId || '',
          telegramId: member.telegramId || null,
        })
        setSelectedMemberPreview(detailedUser)
        setIsMemberPreviewModalOpen(true)
      } catch (error) {
        setMemberPreviewError(error?.message || 'Не удалось загрузить пользователя')
      } finally {
        setIsMemberPreviewLoading(false)
      }
    },
    [onOpenMember]
  )

  const handleOpenGameCard = useCallback(
    async (game) => {
      if (!game) {
        return
      }

      if (typeof onOpenGame === 'function') {
        onOpenGame(game)
        return
      }

      setIsGamePreviewLoading(true)
      setGamePreviewError('')
      try {
        const detailedGame = await fetchCabinetGameDetails({ gameId: game.id, location: game.location || null })
        setSelectedGamePreview(detailedGame)
        setIsGamePreviewModalOpen(true)
      } catch (error) {
        setGamePreviewError(error?.message || 'Не удалось загрузить данные игры')
      } finally {
        setIsGamePreviewLoading(false)
      }
    },
    [onOpenGame]
  )

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
        <ModalSection className="p-5">
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
                {selectedTeam.open ? 'Открыта для заявок' : 'Закрытый состав'}
              </p>
            </div>
          </div>
        </ModalSection>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <ModalSectionTitle>Описание</ModalSectionTitle>
          {selectedTeam.description ? (
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
              {selectedTeam.description}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Капитан ещё не добавил описание команды.
            </p>
          )}
        </div>

        <ModalSection className="p-5">
          <ModalSectionTitle>Информация</ModalSectionTitle>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Статус набора</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {selectedTeam.open ? 'Открыта для заявок' : 'Закрытый состав'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Участников</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{selectedTeam.membersCount ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сыгранных игр</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{selectedTeam.gamesCount ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Рейтинг</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {selectedTeam.rating?.isEligible && Number.isFinite(selectedTeam.rating?.rank)
                  ? `#${selectedTeam.rating.rank} · ${Number(selectedTeam.rating?.finalScore || 0).toFixed(2)}`
                  : 'Недостаточно данных для рейтинга'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Капитан</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {selectedTeam.captain?.name || 'Не назначен'}
                {selectedTeam.captain?.username ? ` (@${selectedTeam.captain.username})` : ''}
              </dd>
            </div>
            {selectedTeam.createdAt && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Создана</dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {formatDate(selectedTeam.createdAt)}
                </dd>
              </div>
            )}
          </dl>
        </ModalSection>

        <ModalSection className="p-5">
          <ModalSectionTitle>Состав команды</ModalSectionTitle>
          {memberPreviewError ? (
            <p className="mt-2 text-xs text-rose-500">{memberPreviewError}</p>
          ) : null}
          {selectedTeam.members?.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {selectedTeam.members.map((member) => (
                <li key={member.id}>
                  <TeamMemberCard member={member} onOpen={handleOpenMemberCard} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Пока нет участников. Пригласите игроков через телеграм-бота, чтобы они появились здесь.
            </p>
          )}
        </ModalSection>

        {selectedTeam.games?.length > 0 && (
          <ModalSection className="p-5">
            <ModalSectionTitle>Сыгранных игр</ModalSectionTitle>
            {gamePreviewError ? (
              <p className="mt-2 text-xs text-rose-500">{gamePreviewError}</p>
            ) : null}
            <ul className="mt-4 space-y-3">
              {selectedTeam.games.map((game) => (
                <li key={game.id}>
                  <ParticipationGameCard
                    game={game}
                    onOpen={() => handleOpenGameCard(game)}
                    showTeam={false}
                    footerText={game.hidden ? 'Игра скрыта из публичного списка' : ''}
                  />
                </li>
              ))}
            </ul>
          </ModalSection>
        )}
      </div>
    ) : (
      <p className="text-sm text-slate-500">
        Выберите команду из списка слева, чтобы просмотреть детали.
      </p>
      )}
      </Modal>
      <Modal
        isOpen={isOpen && isGamePreviewLoading}
        onClose={() => setIsGamePreviewLoading(false)}
        title="Игра"
      >
        <p className="text-sm text-slate-500">Загружаем подробности игры...</p>
      </Modal>
      <Modal
        isOpen={isOpen && isMemberPreviewLoading}
        onClose={() => setIsMemberPreviewLoading(false)}
        title="Пользователь"
      >
        <p className="text-sm text-slate-500">Загружаем профиль пользователя...</p>
      </Modal>
      <UnifiedGameDescriptionModal
        selectedGame={selectedGamePreview}
        isOpen={isOpen && isGamePreviewModalOpen}
        onClose={() => {
          setIsGamePreviewModalOpen(false)
          setSelectedGamePreview(null)
        }}
        canViewRestrictedGameInfo
        canViewGameResults={Boolean(selectedGamePreview?.status === 'closed' || selectedGamePreview?.status === 'finished')}
      />
      <Modal
        isOpen={isOpen && isMemberPreviewModalOpen}
        onClose={() => {
          setIsMemberPreviewModalOpen(false)
          setSelectedMemberPreview(null)
        }}
        title={`Пользователь — ${selectedMemberPreview?.name || 'Без имени'}`}
      >
        {selectedMemberPreview ? (
          <div className="space-y-5">
            <ModalSection className="p-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Имя</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selectedMemberPreview.name || 'Без имени'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ник</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {selectedMemberPreview.username ? `@${selectedMemberPreview.username}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Команд</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {Number(selectedMemberPreview.teamsCount || 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сыграно игр</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {Number(selectedMemberPreview.gamesCount || 0)}
                  </dd>
                </div>
              </dl>
            </ModalSection>
          </div>
        ) : null}
      </Modal>
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
  selectedTeam: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    open: PropTypes.bool,
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
  }),
}

TeamDescriptionModal.defaultProps = {
  canLeaveTeam: false,
  isLeavingTeam: false,
  onLeaveTeam: undefined,
  onOpenMember: undefined,
  onOpenGame: undefined,
  selectedTeam: null,
}

export default memo(TeamDescriptionModal)
