import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const normalizePhoneLink = (phone) => {
  if (!phone) {
    return ''
  }

  return phone.replace(/[^+\d]/g, '')
}

const TeamEditModal = ({
  selectedTeam,
  isOpen,
  onClose,
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
}) => {
  if (!selectedTeam) {
    return null
  }

  const modalFooter = (
    <>
      <button
        type="button"
        onClick={onModalPrimaryAction}
        disabled={
          isSaving || (isDirty && (!canManageSelectedTeam || !location))
        }
        className="aq-modal-btn aq-modal-btn-primary"
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
        className="aq-modal-btn aq-modal-btn-secondary"
      >
        Отменить изменения
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      title={`Редактирование команды «${selectedTeam.name || 'Без названия'}»`}
      onClose={onClose}
      footer={modalFooter}
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
                onChange={(event) => onTeamFieldChange('name', event.target.value)}
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
                  onChange={(event) => onTeamFieldChange('open', event.target.checked)}
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
              onChange={(event) => onTeamFieldChange('description', event.target.value)}
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
                          <p className="mt-1 text-xs text-slate-500">@{member.username}</p>
                        )}
                        {member.userRole && (
                          <p className="mt-1 text-xs text-slate-400">
                            Роль в системе: {member.userRole}
                          </p>
                        )}
                        {!member.hasLinkedUser && (
                          <p className="mt-1 text-xs text-amber-600">
                            Профиль пользователя не найден в глобальной базе.
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

      </fieldset>
    </Modal>
  )
}

TeamEditModal.propTypes = {
  selectedTeam: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    open: PropTypes.bool,
    captain: PropTypes.shape({
      name: PropTypes.string,
    }),
    members: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        username: PropTypes.string,
        phone: PropTypes.string,
        userRole: PropTypes.string,
        hasLinkedUser: PropTypes.bool,
        isCaptain: PropTypes.bool,
      })
    ),
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
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
}

TeamEditModal.defaultProps = {
  selectedTeam: null,
  memberActionId: null,
  location: null,
}

export default memo(TeamEditModal)
