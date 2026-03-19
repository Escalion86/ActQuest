import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ImagesInput from '@components/cabinet/ImagesInput'
import NeonCheckbox from '@components/NeonCheckbox'
import {
  TEAM_CAR_SKIN_OPTIONS,
  normalizeTeamCarSkin,
} from '@helpers/teamCarSkins'

const normalizePhoneLink = (phone) => {
  if (!phone) {
    return ''
  }

  return phone.replace(/[^+\d]/g, '')
}

const TeamCarSkinPreview = ({ skin }) => {
  const resolvedSkin = normalizeTeamCarSkin(skin)

  return (
    <div className="w-[132px] rounded-xl border border-cyan-300/45 bg-cyan-50/65 p-2 dark:border-cyan-500/30 dark:bg-[#04112a]/85">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="116"
        height="52"
        viewBox="0 0 92 46"
        preserveAspectRatio="xMidYMid meet"
        className="h-10 w-full"
        style={{
          filter: 'drop-shadow(0 0 8px rgba(14,165,233,0.24))',
        }}
      >
        {resolvedSkin === 'classic' && (
          <>
            <rect x="12" y="18" width="68" height="14" rx="7" fill="#5dd3ff" stroke="#0f172a" strokeWidth="1.4" />
            <rect x="25" y="10" width="30" height="12" rx="6" fill="#5dd3ff" stroke="#0f172a" strokeWidth="1.2" />
            <rect x="29" y="12" width="11" height="7" rx="2" fill="rgba(191,219,254,0.38)" />
            <rect x="42.5" y="12" width="10" height="7" rx="2" fill="rgba(191,219,254,0.38)" />
          </>
        )}
        {resolvedSkin === 'sport' && (
          <>
            <rect x="9" y="20" width="74" height="11" rx="6" fill="#f472b6" stroke="#0f172a" strokeWidth="1.3" />
            <path d="M26 20 L35 11 H57 L66 20 Z" fill="#f472b6" stroke="#0f172a" strokeWidth="1.2" />
            <path d="M81 21 L86 21 L84 17 Z" fill="#f472b6" stroke="#0f172a" strokeWidth="1" />
            <rect x="38" y="13" width="16" height="5.8" rx="2" fill="rgba(191,219,254,0.38)" />
          </>
        )}
        {resolvedSkin === 'suv' && (
          <>
            <rect x="11" y="18" width="70" height="15.5" rx="7" fill="#4ade80" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="22" y="8.5" width="36" height="13" rx="6" fill="#4ade80" stroke="#0f172a" strokeWidth="1.3" />
            <rect x="24" y="7" width="32" height="2.2" rx="1.1" fill="#0f172a" opacity="0.8" />
            <rect x="27" y="11" width="11.5" height="8" rx="2.4" fill="rgba(191,219,254,0.38)" />
            <rect x="41.5" y="11" width="13" height="8" rx="2.4" fill="rgba(191,219,254,0.38)" />
          </>
        )}
        {resolvedSkin === 'van' && (
          <>
            <rect x="8" y="16" width="77" height="17" rx="5.5" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="16" y="9.5" width="46" height="10.5" rx="3.8" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.2" />
            <rect x="19" y="12" width="13" height="7" rx="2" fill="rgba(191,219,254,0.38)" />
            <rect x="34" y="12" width="11.5" height="7" rx="2" fill="rgba(191,219,254,0.38)" />
            <rect x="47.5" y="12" width="11.5" height="7" rx="2" fill="rgba(191,219,254,0.38)" />
          </>
        )}
        <circle cx="28" cy="33.7" r="5.4" fill="#020617" stroke="#38bdf8" strokeWidth="1.3" />
        <circle cx="66.2" cy="33.7" r="5.4" fill="#020617" stroke="#38bdf8" strokeWidth="1.3" />
        <circle cx="28" cy="33.7" r="2.4" fill="#0ea5e9" opacity="0.75" />
        <circle cx="66.2" cy="33.7" r="2.4" fill="#0ea5e9" opacity="0.75" />
      </svg>
      <p className="mt-1 text-center text-[11px] font-medium text-cyan-700 dark:text-cyan-200">
        Превью
      </p>
    </div>
  )
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
  canEditCarSkin,
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
              <div className="mt-3">
                <NeonCheckbox
                  id="team-open"
                  checked={Boolean(selectedTeam.open)}
                  onChange={(event) => onTeamFieldChange('open', event.target.checked)}
                  label="Разрешить новым участникам присоединяться к команде по id"
                  labelClassName="text-sm text-slate-600 dark:text-slate-300"
                />
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
            {canEditCarSkin && (
              <div>
                <label
                  htmlFor="team-car-skin"
                  className="text-sm font-semibold text-primary"
                >
                  Вид машинки в интерактивной таблице
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <select
                    id="team-car-skin"
                    value={selectedTeam.carSkin || 'classic'}
                    onChange={(event) => onTeamFieldChange('carSkin', event.target.value)}
                    className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  >
                    {TEAM_CAR_SKIN_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <TeamCarSkinPreview skin={selectedTeam.carSkin} />
                </div>
              </div>
            )}
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

          <ImagesInput
            images={selectedTeam.image ? [selectedTeam.image] : []}
            onChange={(next) =>
              onTeamFieldChange('image', Array.isArray(next) ? next[0] ?? '' : '')
            }
            directory="teams"
            imageName={selectedTeam.id || 'team-avatar'}
            label="Иконка команды"
            maxImages={1}
            disabled={!canManageSelectedTeam || isSaving}
          />
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
    image: PropTypes.string,
    open: PropTypes.bool,
    carSkin: PropTypes.string,
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
  canEditCarSkin: PropTypes.bool,
}

TeamEditModal.defaultProps = {
  selectedTeam: null,
  memberActionId: null,
  location: null,
  canEditCarSkin: false,
}

TeamCarSkinPreview.propTypes = {
  skin: PropTypes.string,
}

TeamCarSkinPreview.defaultProps = {
  skin: 'classic',
}

export default memo(TeamEditModal)
