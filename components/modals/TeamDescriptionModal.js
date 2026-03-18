import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'

const sectionHeadingClass = 'aq-modal-section-title text-base font-semibold'
const itemTitleClass = 'aq-modal-item-title font-semibold'

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
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <h4 className={sectionHeadingClass}>Описание</h4>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h4 className={sectionHeadingClass}>Информация</h4>
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
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h4 className={sectionHeadingClass}>Состав команды</h4>
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
                    <p className="mt-1 text-xs text-slate-400">Роль в системе: {member.userRole}</p>
                  )}
                  {!member.hasLinkedUser && (
                    <p className="mt-1 text-xs text-amber-600">
                      Профиль пользователя не найден в глобальной базе.
                    </p>
                  )}
                  {member.phone && (
                    <p className="mt-2 text-xs text-slate-500">Телефон: {member.phone}</p>
                  )}
                  {member.telegramId && (
                    <p className="mt-1 text-xs text-slate-400">Telegram ID: {member.telegramId}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Пока нет участников. Пригласите игроков через телеграм-бота, чтобы они появились здесь.
            </p>
          )}
        </section>

        {selectedTeam.games?.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h4 className={sectionHeadingClass}>Участие в играх</h4>
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
          </section>
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
