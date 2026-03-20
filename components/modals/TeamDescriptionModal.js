import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'
const itemTitleClass = 'aq-modal-item-title font-semibold'
const systemRoleLabels = {
  client: 'Участник',
  moder: 'Модератор',
  admin: 'Администратор',
  dev: 'Разработчик',
  ban: 'Заблокирован',
}

const TeamDescriptionModal = ({
  isOpen,
  onClose,
  selectedTeam,
}) => (
  <Modal
    isOpen={isOpen}
    title={`Команда — ${selectedTeam?.name || 'Без названия'}`}
    onClose={onClose}
  >
    {selectedTeam ? (
      <div className="space-y-6">
        <ModalSection className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
              {selectedTeam.image ? (
                <img
                  src={selectedTeam.image}
                  alt={`Иконка команды ${selectedTeam.name || 'Без названия'}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-slate-500 dark:text-slate-300">
                  {selectedTeam.name?.[0] ? selectedTeam.name[0].toUpperCase() : '?'}
                </div>
              )}
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
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Участие в играх</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{selectedTeam.gamesCount ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Капитан</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {selectedTeam.captain?.name || 'Не назначен'}
                {selectedTeam.captain?.username ? ` (@${selectedTeam.captain.username})` : ''}
              </dd>
            </div>
            {selectedTeam.updatedAt && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Обновлено</dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {formatRelativeTimeFromNow(selectedTeam.updatedAt)}
                </dd>
              </div>
            )}
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
          {selectedTeam.members?.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {selectedTeam.members.map((member) => (
                <li
                  key={member.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <p className={itemTitleClass}>
                    {member.name || 'Без имени'}
                    {member.isCaptain ? ' · Капитан' : ''}
                  </p>
                  {member.username && (
                    <p className="mt-1 text-xs text-slate-500">@{member.username}</p>
                  )}
                  {member.userRole && (
                    (() => {
                      const normalizedRole = String(member.userRole).toLowerCase()
                      const roleLabel =
                        systemRoleLabels[normalizedRole] ?? member.userRole
                      if (normalizedRole === 'client' || roleLabel === 'Участник') {
                        return null
                      }
                      return (
                        <p className="mt-1 text-xs text-slate-400">
                          Роль в системе: {roleLabel}
                        </p>
                      )
                    })()
                  )}
                  {!member.hasLinkedUser && (
                    <p className="mt-1 text-xs text-amber-600">
                      Профиль пользователя не найден в глобальной базе.
                    </p>
                  )}
                  {member.phone && (
                    <p className="mt-2 text-xs text-slate-500">Телефон: {member.phone}</p>
                  )}
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
            <ModalSectionTitle>Участие в играх</ModalSectionTitle>
            <ul className="mt-4 space-y-3">
              {selectedTeam.games.map((game) => (
                <li
                  key={game.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <p className={itemTitleClass}>{game.name || 'Без названия'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Статус: {getGameStatusLabel(game.status)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {game.dateStart ? formatDate(game.dateStart) : 'Дата не назначена'}
                  </p>
                  {game.hidden && (
                    <p className="mt-1 text-xs text-slate-400">Игра скрыта из публичного списка</p>
                  )}
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
)

TeamDescriptionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedTeam: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    open: PropTypes.bool,
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
  }),
}

TeamDescriptionModal.defaultProps = {
  selectedTeam: null,
}

export default memo(TeamDescriptionModal)
