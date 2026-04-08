import { memo, useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import ModalSection from '@components/modals/ModalSection'
import ModalSectionTitle from '@components/modals/ModalSectionTitle'
import ImagesInput from '@components/cabinet/ImagesInput'
import UserSelectField from '@components/cabinet/UserSelectField'
import NeonCheckbox from '@components/NeonCheckbox'
import ClassicCar from '@components/cars/ClassicCar'
import SportCar from '@components/cars/SportCar'
import SuvCar from '@components/cars/SuvCar'
import VanCar from '@components/cars/VanCar'
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
      {resolvedSkin === 'classic' && (
        <ClassicCar
          showName={false}
          color="#5dd3ff"
          rowHeight={40}
          containerWidth={116}
          svgWidth="82.000000px"
          svgHeight="40.000000px"
          className="!items-center"
          isDarkTheme
        />
      )}
      {resolvedSkin === 'sport' && (
        <SportCar
          showName={false}
          color="#f472b6"
          rowHeight={40}
          containerWidth={116}
          svgWidth="116px"
          svgHeight="40px"
          className="!items-center"
          isDarkTheme
        />
      )}
      {resolvedSkin === 'suv' && (
        <SuvCar
          showName={false}
          color="#4ade80"
          rowHeight={40}
          containerWidth={116}
          svgWidth="116px"
          svgHeight="40px"
          className="!items-center"
          isDarkTheme
        />
      )}
      {resolvedSkin === 'van' && (
        <VanCar
          showName={false}
          color="#fbbf24"
          rowHeight={40}
          containerWidth={116}
          svgWidth="116px"
          svgHeight="40px"
          className="!items-center"
          isDarkTheme
        />
      )}
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
  canEditCarSkin,
  canDeleteTeam,
  isDeletingTeam,
  onDeleteTeam,
  locationOptions,
  onAddMember,
  isAddingMember,
}) => {
  const [addMemberUser, setAddMemberUser] = useState(null)

  useEffect(() => {
    setAddMemberUser(null)
  }, [selectedTeam?.id, isOpen])

  const handleAddMemberClick = () => {
    if (!addMemberUser || !onAddMember) {
      return
    }
    onAddMember(addMemberUser.id, addMemberUser)
    setAddMemberUser(null)
  }

  if (!selectedTeam) {
    return null
  }

  const fieldLabelClassName = 'text-sm font-semibold text-slate-700 dark:text-white'
  const fieldInputClassName =
    'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
  const sectionTitleClassName = 'text-lg text-slate-800 dark:text-white'

  const modalFooter = (
    <>
      <CabinetButton
        onClick={onModalPrimaryAction}
        disabled={
          isSaving || (isDirty && !canManageSelectedTeam)
        }
        variant="primary"
      >
        {isDirty
          ? isSaving
            ? 'Сохранение…'
            : 'Сохранить и закрыть'
          : 'Закрыть'}
      </CabinetButton>
      <CabinetButton
        onClick={onResetTeam}
        disabled={!canManageSelectedTeam || !isDirty}
        variant="secondary"
      >
        Отменить изменения
      </CabinetButton>
      {canDeleteTeam && (
        <CabinetButton
          onClick={onDeleteTeam}
          disabled={isDeletingTeam || isSaving}
          variant="secondary"
          tone="danger"
          className={isDeletingTeam ? 'cursor-wait' : ''}
        >
          {isDeletingTeam ? 'Удаление…' : 'Удалить команду'}
        </CabinetButton>
      )}
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
        <ModalSection>
          <div className="grid gap-4 md:grid-cols-2">
            <CabinetInputField
              id="team-name"
              label="Название команды"
              value={selectedTeam.name}
              onChange={(event) =>
                onTeamFieldChange('name', event.target.value)
              }
              labelClassName={fieldLabelClassName}
              inputClassName={fieldInputClassName}
            />
            {canEditCarSkin && (
              <div>
                <label
                  htmlFor="team-car-skin"
                  className={fieldLabelClassName}
                >
                  Вид машинки в интерактивной таблице
                </label>
                <div className="flex flex-col gap-3 mt-2 sm:flex-row sm:items-end">
                  <select
                    id="team-car-skin"
                    value={selectedTeam.carSkin || 'classic'}
                    onChange={(event) =>
                      onTeamFieldChange('carSkin', event.target.value)
                    }
                    className={fieldInputClassName}
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
          <CabinetSelectField
            id="team-location"
            label="Город команды"
            value={selectedTeam.location || ''}
            onChange={(event) => onTeamFieldChange('location', event.target.value)}
            labelClassName={fieldLabelClassName}
            selectClassName={fieldInputClassName}
          >
            <option value="">Не указан</option>
            {locationOptions.map((locationOption) => (
              <option key={locationOption.value} value={locationOption.value}>
                {locationOption.label}
              </option>
            ))}
          </CabinetSelectField>

          <CabinetTextareaField
            id="team-description"
            label="Описание"
            value={selectedTeam.description}
            onChange={(event) =>
              onTeamFieldChange('description', event.target.value)
            }
            rows={5}
            labelClassName={fieldLabelClassName}
            textareaClassName={fieldInputClassName}
          />

          <ImagesInput
            images={selectedTeam.image ? [selectedTeam.image] : []}
            onChange={(next) =>
              onTeamFieldChange(
                'image',
                Array.isArray(next) ? (next[0] ?? '') : '',
              )
            }
            directory={`teams/${selectedTeam.id || 'draft'}`}
            imageName="cover"
            label="Аватарка команды"
            maxImages={1}
            disabled={!canManageSelectedTeam || isSaving}
            previewShape="circle"
          />
        </ModalSection>

        <ModalSection>
          <ModalSectionTitle as="h2" className={sectionTitleClassName}>
            Доступность команды
          </ModalSectionTitle>
          <div className="mt-3">
            <NeonCheckbox
              id="team-open"
              checked={Boolean(selectedTeam.open)}
              onChange={(event) =>
                onTeamFieldChange('open', event.target.checked)
              }
              label="Разрешить новым участникам присоединяться к команде по id"
              labelClassName="text-sm text-slate-600 dark:text-slate-300"
            />
          </div>
          {selectedTeam.open ? (
            <button
              type="button"
              onClick={onCopyTeamId}
              className="inline-flex items-center justify-between w-full px-3 py-2 mt-2 text-xs font-medium transition border border-dashed rounded-lg border-primary/40 bg-blue-50/70 text-primary hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:border-blue-300/30 dark:bg-blue-500/10 dark:text-blue-100 dark:hover:bg-blue-500/20"
            >
              <span>ID команды: {selectedTeam.id}</span>
              <span className="text-[11px] font-normal uppercase tracking-wide">
                {isTeamIdCopied
                  ? 'Скопировано'
                  : 'Нажмите, чтобы скопировать'}
              </span>
            </button>
          ) : null}
        </ModalSection>

        <ModalSection>
          <div className="flex items-center justify-between">
            <ModalSectionTitle as="h2" className={sectionTitleClassName}>
              Состав команды
            </ModalSectionTitle>
            {selectedTeam.captain && (
              <span className="text-xs text-slate-500">
                Капитан: {selectedTeam.captain.name || 'не указан'}
              </span>
            )}
          </div>

          {canManageSelectedTeam && (
            <div className="flex flex-col gap-2 mt-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <UserSelectField
                  label="Добавить игрока"
                  selectedOption={addMemberUser}
                  onSelect={setAddMemberUser}
                  onClear={() => setAddMemberUser(null)}
                  disabled={isAddingMember || isSaving}
                />
              </div>
              <CabinetButton
                onClick={handleAddMemberClick}
                disabled={!addMemberUser || isAddingMember || isSaving}
                variant="secondary"
                tone="brand"
                size="sm"
                className="shrink-0 sm:mb-0"
              >
                {isAddingMember ? 'Добавление…' : 'Добавить'}
              </CabinetButton>
            </div>
          )}

          {selectedTeam.members?.length > 0 ? (
            <div className="space-y-3">
              {selectedTeam.members.map((member) => {
                const phoneLink = normalizePhoneLink(member.phone)
                const isProcessing = memberActionId === member.id

                return (
                  <div
                    key={member.id}
                    className="p-4 bg-white border shadow-sm dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 rounded-2xl"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
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
                            className="block text-xs text-cyan-700 hover:underline dark:text-cyan-200"
                          >
                            {member.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    {canManageSelectedTeam && (
                      <div className="flex flex-col gap-2 mt-3 md:flex-row">
                        {!member.isCaptain && (
                          <CabinetButton
                            onClick={() => onSetCaptain(member.id)}
                            disabled={isProcessing}
                            variant="secondary"
                            tone={isProcessing ? 'neutral' : 'brand'}
                            size="sm"
                            className="inline-flex justify-center"
                          >
                            Назначить капитаном
                          </CabinetButton>
                        )}
                        {!member.isCaptain && (
                          <CabinetButton
                            onClick={() => onRemoveMember(member.id)}
                            disabled={isProcessing}
                            variant="secondary"
                            tone={isProcessing ? 'neutral' : 'danger'}
                            size="sm"
                            className="inline-flex justify-center"
                          >
                            Удалить из команды
                          </CabinetButton>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Пока нет участников. Пригласите игроков через телеграм-бота, чтобы
              они появились здесь.
            </p>
          )}
        </ModalSection>
      </fieldset>
    </Modal>
  )
}

TeamEditModal.propTypes = {
  onAddMember: PropTypes.func,
  isAddingMember: PropTypes.bool,
  selectedTeam: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    open: PropTypes.bool,
    location: PropTypes.string,
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
      }),
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
  canEditCarSkin: PropTypes.bool,
  canDeleteTeam: PropTypes.bool,
  isDeletingTeam: PropTypes.bool,
  onDeleteTeam: PropTypes.func,
  locationOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
}

TeamEditModal.defaultProps = {
  selectedTeam: null,
  memberActionId: null,
  canEditCarSkin: false,
  canDeleteTeam: false,
  isDeletingTeam: false,
  onDeleteTeam: undefined,
  locationOptions: [],
  onAddMember: undefined,
  isAddingMember: false,
}

TeamCarSkinPreview.propTypes = {
  skin: PropTypes.string,
}

TeamCarSkinPreview.defaultProps = {
  skin: 'classic',
}

export default memo(TeamEditModal)
