import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'

const normalizePhoneLink = (phone) => {
  if (!phone) {
    return ''
  }

  return phone.replace(/[^+\d]/g, '')
}

const TeamsModals = ({
  selectedTeam,
  isEditModalOpen,
  onCloseEditModal,
  canManageSelectedTeam,
  isSaving,
  onTeamFieldChange,
  onCopyTeamId,
  isTeamIdCopied,
  onModalPrimaryAction,
  isDirty,
  onResetTeam,
  memberActionId,
  onSetCaptain,
  onRemoveMember,
  location,
  isCreateModalOpen,
  onCloseCreateModal,
  isCreatingTeam,
  isCreateActionDisabled,
  newTeamName,
  onChangeNewTeamName,
  newTeamDescription,
  onChangeNewTeamDescription,
  newTeamOpen,
  onChangeNewTeamOpen,
  onCreateTeam,
  isJoinModalOpen,
  onCloseJoinModal,
  isJoiningTeam,
  isJoinActionDisabled,
  joinTeamId,
  onChangeJoinTeamId,
  onJoinTeam,
  canUseSelfServiceTeams,
  isTeamDescriptionModalOpen,
  onCloseTeamDescriptionModal,
}) => (
  <>
    {selectedTeam ? (
      <Modal
        isOpen={isEditModalOpen}
        title={`Редактирование команды «${selectedTeam.name || 'Без названия'}»`}
        onClose={onCloseEditModal}
      >
        <fieldset
          disabled={!canManageSelectedTeam || isSaving}
          className="p-0 m-0 space-y-6 border-0"
        >
          <section className="p-6 space-y-5 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="team-name"
                  className="text-sm font-semibold text-primary"
                >
                  Название команды
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={selectedTeam.name}
                  onChange={(event) =>
                    onTeamFieldChange('name', event.target.value)
                  }
                  className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label
                  className="text-sm font-semibold text-primary"
                  htmlFor="team-open"
                >
                  Доступность команды
                </label>
                <div className="flex items-center gap-3 mt-3">
                  <input
                    id="team-open"
                    type="checkbox"
                    checked={Boolean(selectedTeam.open)}
                    onChange={(event) =>
                      onTeamFieldChange('open', event.target.checked)
                    }
                    className="w-4 h-4 rounded text-primary border-slate-300"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Разрешить новым участникам присоединяться к команде по id
                  </span>
                </div>
                {selectedTeam.open ? (
                  <button
                    type="button"
                    onClick={onCopyTeamId}
                    className="mt-2 inline-flex w-full items-center justify-between rounded-lg border border-dashed border-primary/40 bg-blue-50/70 px-3 py-2 text-xs font-medium text-primary transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:border-blue-300/30 dark:bg-blue-500/10 dark:text-blue-100 dark:hover:bg-blue-500/20"
                  >
                    <span>ID команды: {selectedTeam.id}</span>
                    <span className="text-[11px] font-normal uppercase tracking-wide">
                      {isTeamIdCopied ? 'Скопировано' : 'Нажмите, чтобы скопировать'}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label
                htmlFor="team-description"
                className="text-sm font-semibold text-primary"
              >
                Описание
              </label>
              <textarea
                id="team-description"
                value={selectedTeam.description}
                onChange={(event) =>
                  onTeamFieldChange('description', event.target.value)
                }
                rows={5}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>
          </section>

          <section className="p-6 space-y-5 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary">Состав команды</h2>
              {selectedTeam.captain && (
                <span className="text-xs text-slate-500">
                  Капитан: {selectedTeam.captain.name || 'не указан'}
                </span>
              )}
            </div>

            {selectedTeam.members?.length > 0 ? (
              <div className="space-y-3">
                {selectedTeam.members.map((member) => {
                  const phoneLink = normalizePhoneLink(member.phone)
                  const isProcessing = memberActionId === member.id

                  return (
                    <div
                      key={member.id}
                      className="p-4 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-primary">
                            {member.name || 'Без имени'}
                            {member.isCaptain ? ' · Капитан' : ''}
                          </p>
                          {member.username && (
                            <p className="mt-1 text-xs text-slate-500">
                              @{member.username}
                            </p>
                          )}
                          {member.userRole && (
                            <p className="mt-1 text-xs text-slate-400">
                              Роль в системе: {member.userRole}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {member.phone && (
                            <a
                              href={phoneLink ? `tel:${phoneLink}` : undefined}
                              className="block text-xs text-primary hover:underline"
                            >
                              {member.phone}
                            </a>
                          )}
                        </div>
                      </div>

                      {canManageSelectedTeam && (
                        <div className="flex flex-col gap-2 mt-3 md:flex-row">
                          {!member.isCaptain && (
                            <button
                              type="button"
                              onClick={() => onSetCaptain(member.id)}
                              disabled={isProcessing}
                              className={`inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                                isProcessing
                                  ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                                  : 'border-primary text-primary hover:bg-blue-50 dark:hover:bg-violet-500/10'
                              }`}
                            >
                              Назначить капитаном
                            </button>
                          )}
                          {!member.isCaptain && (
                            <button
                              type="button"
                              onClick={() => onRemoveMember(member.id)}
                              disabled={isProcessing}
                              className={`inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                                isProcessing
                                  ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                                  : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              Удалить из команды
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Пока нет участников. Пригласите игроков через телеграм-бота, чтобы они появились здесь.
              </p>
            )}
          </section>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              type="button"
              onClick={onModalPrimaryAction}
              disabled={
                isSaving ||
                (isDirty && (!canManageSelectedTeam || !location))
              }
              className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                isSaving ||
                (isDirty && (!canManageSelectedTeam || !location))
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-blue-700'
              }`}
            >
              {isDirty
                ? isSaving
                  ? 'Сохранение…'
                  : 'Сохранить и закрыть'
                : 'Закрыть'}
            </button>
            <button
              type="button"
              onClick={onResetTeam}
              disabled={!canManageSelectedTeam || !isDirty}
              className={`inline-flex justify-center px-5 py-3 text-sm font-semibold rounded-xl border transition ${
                !canManageSelectedTeam || !isDirty
                  ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                  : 'border-primary text-primary hover:bg-blue-50 dark:hover:bg-violet-500/10'
              }`}
            >
              Отменить изменения
            </button>
          </div>
        </fieldset>
      </Modal>
    ) : null}

    <Modal
      isOpen={isCreateModalOpen}
      title="Создание команды"
      onClose={onCloseCreateModal}
      footer={(
        <>
          <button
            type="button"
            onClick={onCloseCreateModal}
            disabled={isCreatingTeam}
            className={`inline-flex justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isCreatingTeam
                ? 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onCreateTeam}
            disabled={isCreateActionDisabled}
            className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
              isCreateActionDisabled
                ? 'bg-slate-400'
                : 'bg-primary hover:bg-blue-700'
            }`}
          >
            {isCreatingTeam ? 'Создание…' : 'Создать команду'}
          </button>
        </>
      )}
    >
      <fieldset
        disabled={isCreatingTeam}
        className="m-0 space-y-5 border-0 p-0"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Название команды можно изменить позже. Вы автоматически станете капитаном созданной команды.
        </p>
        <div className="space-y-2">
          <label
            htmlFor="new-team-name"
            className="text-sm font-semibold text-primary"
          >
            Название команды
          </label>
          <input
            id="new-team-name"
            type="text"
            value={newTeamName}
            onChange={(event) => onChangeNewTeamName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
            placeholder="Например, Стремительные"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="new-team-description"
            className="text-sm font-semibold text-primary"
          >
            Краткое описание (по желанию)
          </label>
          <textarea
            id="new-team-description"
            value={newTeamDescription}
            onChange={(event) => onChangeNewTeamDescription(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
            placeholder="Расскажите, для кого эта команда"
          />
        </div>
        <div className="flex items-start gap-3">
          <input
            id="new-team-open"
            type="checkbox"
            checked={newTeamOpen}
            onChange={(event) => onChangeNewTeamOpen(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary"
          />
          <div className="space-y-1">
            <label
              htmlFor="new-team-open"
              className="text-sm font-semibold text-primary"
            >
              Разрешить присоединяться по id
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Когда настройка включена, новые участники смогут вступить в команду, введя её id в личном кабинете.
            </p>
          </div>
        </div>
      </fieldset>
    </Modal>

    <Modal
      isOpen={isJoinModalOpen}
      title="Присоединиться к команде"
      onClose={onCloseJoinModal}
      footer={(
        <>
          <button
            type="button"
            onClick={onCloseJoinModal}
            disabled={isJoiningTeam}
            className={`inline-flex justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isJoiningTeam
                ? 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onJoinTeam}
            disabled={isJoinActionDisabled}
            className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
              isJoinActionDisabled
                ? 'bg-slate-400'
                : 'bg-primary hover:bg-blue-700'
            }`}
          >
            {isJoiningTeam ? 'Отправка…' : 'Вступить в команду'}
          </button>
        </>
      )}
    >
      <fieldset
        disabled={isJoiningTeam}
        className="m-0 space-y-5 border-0 p-0"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Введите идентификатор команды. Его можно получить у капитана, если в настройках команды разрешено присоединение по id.
        </p>
        <div className="space-y-2">
          <label
            htmlFor="join-team-id"
            className="text-sm font-semibold text-primary"
          >
            ID команды
          </label>
          <input
            id="join-team-id"
            type="text"
            value={joinTeamId}
            onChange={(event) => onChangeJoinTeamId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase tracking-wide focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
            placeholder="Например, 64ff0c2e12"
          />
        </div>
        {!canUseSelfServiceTeams ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Укажите площадку в профиле и привяжите Telegram, чтобы присоединяться к командам.
          </div>
        ) : null}
      </fieldset>
    </Modal>

    <Modal
      isOpen={isTeamDescriptionModalOpen}
      title={`Команда — ${selectedTeam?.name || 'Без названия'}`}
      onClose={onCloseTeamDescriptionModal}
    >
      {selectedTeam ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <h4 className="text-base font-semibold text-primary">Описание</h4>
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
            <h4 className="text-base font-semibold text-primary">Информация</h4>
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
            <h4 className="text-base font-semibold text-primary">Состав команды</h4>
            {selectedTeam.members?.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {selectedTeam.members.map((member) => (
                  <li
                    key={member.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                  >
                    <p className="font-semibold text-primary">
                      {member.name || 'Без имени'}
                      {member.isCaptain ? ' · Капитан' : ''}
                    </p>
                    {member.username && (
                      <p className="mt-1 text-xs text-slate-500">@{member.username}</p>
                    )}
                    {member.userRole && (
                      <p className="mt-1 text-xs text-slate-400">Роль в системе: {member.userRole}</p>
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
              <h4 className="text-base font-semibold text-primary">Участие в играх</h4>
              <ul className="mt-4 space-y-3">
                {selectedTeam.games.map((game) => (
                  <li
                    key={game.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                  >
                    <p className="font-semibold text-primary">{game.name || 'Без названия'}</p>
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
  </>
)

const teamMemberShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  telegramId: PropTypes.string,
  name: PropTypes.string,
  username: PropTypes.string,
  phone: PropTypes.string,
  role: PropTypes.string,
  isCaptain: PropTypes.bool,
  userRole: PropTypes.string,
})

const teamGameShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  status: PropTypes.string,
  dateStart: PropTypes.string,
  hidden: PropTypes.bool,
})

TeamsModals.propTypes = {
  selectedTeam: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    description: PropTypes.string,
    open: PropTypes.bool,
    members: PropTypes.arrayOf(teamMemberShape),
    membersCount: PropTypes.number,
    captain: teamMemberShape,
    games: PropTypes.arrayOf(teamGameShape),
    gamesCount: PropTypes.number,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  isEditModalOpen: PropTypes.bool.isRequired,
  onCloseEditModal: PropTypes.func.isRequired,
  canManageSelectedTeam: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  onTeamFieldChange: PropTypes.func.isRequired,
  onCopyTeamId: PropTypes.func.isRequired,
  isTeamIdCopied: PropTypes.bool.isRequired,
  onModalPrimaryAction: PropTypes.func.isRequired,
  isDirty: PropTypes.bool.isRequired,
  onResetTeam: PropTypes.func.isRequired,
  memberActionId: PropTypes.string,
  onSetCaptain: PropTypes.func.isRequired,
  onRemoveMember: PropTypes.func.isRequired,
  location: PropTypes.string,
  isCreateModalOpen: PropTypes.bool.isRequired,
  onCloseCreateModal: PropTypes.func.isRequired,
  isCreatingTeam: PropTypes.bool.isRequired,
  isCreateActionDisabled: PropTypes.bool.isRequired,
  newTeamName: PropTypes.string.isRequired,
  onChangeNewTeamName: PropTypes.func.isRequired,
  newTeamDescription: PropTypes.string.isRequired,
  onChangeNewTeamDescription: PropTypes.func.isRequired,
  newTeamOpen: PropTypes.bool.isRequired,
  onChangeNewTeamOpen: PropTypes.func.isRequired,
  onCreateTeam: PropTypes.func.isRequired,
  isJoinModalOpen: PropTypes.bool.isRequired,
  onCloseJoinModal: PropTypes.func.isRequired,
  isJoiningTeam: PropTypes.bool.isRequired,
  isJoinActionDisabled: PropTypes.bool.isRequired,
  joinTeamId: PropTypes.string.isRequired,
  onChangeJoinTeamId: PropTypes.func.isRequired,
  onJoinTeam: PropTypes.func.isRequired,
  canUseSelfServiceTeams: PropTypes.bool.isRequired,
  isTeamDescriptionModalOpen: PropTypes.bool.isRequired,
  onCloseTeamDescriptionModal: PropTypes.func.isRequired,
}

TeamsModals.defaultProps = {
  selectedTeam: null,
  memberActionId: null,
  location: null,
}

export default TeamsModals
