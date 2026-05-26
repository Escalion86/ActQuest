'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PropTypes from 'prop-types'
import Modal from '@components/Modal'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import CabinetButton from '@components/cabinet/CabinetButton'
import ImagesInput from '@components/cabinet/ImagesInput'
import NeonCheckbox from '@components/NeonCheckbox'
import NoticeBanner from '@components/NoticeBanner'
import fetchCabinetUserDetails from '@helpers/fetchCabinetUserDetails'
import requestApiJson from '@helpers/requestApiJson'
import useOptimisticMutation from '@helpers/useOptimisticMutation'
import {
  formatPhoneInput,
  normalizePhoneForSubmit,
} from '@helpers/phoneInputMask'
import { LOCATIONS } from '@server/serverConstants'

const modalItemSmallTitleClass = 'aq-modal-item-title text-sm font-semibold'

const cloneUser = (user) => JSON.parse(JSON.stringify(user))

const UserEditModal = ({ userId, isOpen, onClose }) => {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchCabinetUserDetails({ userId }),
    enabled: isOpen && !!userId,
    staleTime: 1000 * 60 * 5, // 5 минут
  })

  const [editingUser, setEditingUser] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [banPreview, setBanPreview] = useState(null)
  const [pendingBanPayload, setPendingBanPayload] = useState(null)
  const [isBanPreviewLoading, setIsBanPreviewLoading] = useState(false)
  const [isBanApplying, setIsBanApplying] = useState(false)

  const initializedEditingUser = editingUser ?? (user ? cloneUser(user) : null)

  const handleFieldChange = useCallback(
    (field, value) => {
      setEditingUser((prev) => {
        const base = prev ?? (user ? cloneUser(user) : null)
        return base ? { ...base, [field]: value } : null
      })
      setFeedback(null)
    },
    [user],
  )

  const updateUserMutation = useOptimisticMutation({
    queryKey: ['user', userId],
    mutationFn: async (payload) => {
      const { json } = await requestApiJson(
        `/api/cabinet/admin/users/${userId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          fallbackMessage: 'Не удалось сохранить изменения',
        },
      )
      return json?.data || payload
    },
    updateCache: (oldUser, payload) => {
      if (!oldUser) return oldUser
      return { ...oldUser, ...payload }
    },
    onSuccess: () => {
      setEditingUser(null)
      setFeedback(null)
      onClose()
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        message: err?.message || 'Не удалось сохранить изменения',
      })
    },
  })

  const buildPayload = useCallback((sourceUser) => {
    const phone = sourceUser?.phone || ''
    const normalizedPhone = phone.trim() ? normalizePhoneForSubmit(phone) : ''

    return {
      name: typeof sourceUser?.name === 'string' ? sourceUser.name.trim() : '',
      username:
        typeof sourceUser?.username === 'string'
          ? sourceUser.username.trim()
          : '',
      phone: normalizedPhone,
      currentLocation:
        typeof sourceUser?.currentLocation === 'string'
          ? sourceUser.currentLocation.trim()
          : '',
      photoUrl:
        typeof sourceUser?.photoUrl === 'string' ? sourceUser.photoUrl : '',
      about:
        typeof sourceUser?.about === 'string' ? sourceUser.about.trim() : '',
      role:
        typeof sourceUser?.role === 'string' ? sourceUser.role.trim() : 'client',
      canBeGameModerator: Boolean(sourceUser?.canBeGameModerator),
      canBeGameAgent: Boolean(sourceUser?.canBeGameAgent),
    }
  }, [])

  const closeBanPreview = useCallback(() => {
    setBanPreview(null)
    setPendingBanPayload(null)
  }, [])

  const handleCloseBanPreview = useCallback(() => {
    if (isBanApplying) {
      return
    }

    closeBanPreview()
  }, [closeBanPreview, isBanApplying])

  const handleConfirmBan = useCallback(async () => {
    if (!pendingBanPayload || !userId) {
      return
    }

    setIsBanApplying(true)
    setFeedback(null)

    try {
      await requestApiJson(`/api/cabinet/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingBanPayload),
        fallbackMessage: 'Не удалось заблокировать пользователя',
      })

      setEditingUser(null)
      closeBanPreview()
      onClose()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Не удалось заблокировать пользователя',
      })
    } finally {
      setIsBanApplying(false)
    }
  }, [closeBanPreview, onClose, pendingBanPayload, userId])

  const handleSave = useCallback(async () => {
    if (!initializedEditingUser || !user) {
      return
    }

    const payload = buildPayload(initializedEditingUser)
    const currentRole =
      typeof user?.role === 'string' ? user.role.trim().toLowerCase() : 'client'
    const nextRole =
      typeof payload.role === 'string'
        ? payload.role.trim().toLowerCase()
        : 'client'

    if (currentRole !== 'ban' && nextRole === 'ban') {
      setIsBanPreviewLoading(true)
      setFeedback(null)

      try {
        const { json } = await requestApiJson(
          `/api/cabinet/admin/users/${userId}/ban-preview`,
          {
            method: 'POST',
            fallbackMessage: 'Не удалось подготовить подтверждение бана',
          },
        )

        setPendingBanPayload(payload)
        setBanPreview(json?.data || null)
      } catch (err) {
        setFeedback({
          type: 'error',
          message:
            err?.message || 'Не удалось подготовить подтверждение бана',
        })
      } finally {
        setIsBanPreviewLoading(false)
      }
      return
    }

    updateUserMutation.mutate(payload)
  }, [buildPayload, initializedEditingUser, updateUserMutation, user, userId])

  const handleReset = useCallback(() => {
    setEditingUser(null)
    setFeedback(null)
    closeBanPreview()
  }, [closeBanPreview])

  const locationOptions = useMemo(
    () =>
      Object.entries(LOCATIONS || {}).map(([key, location]) => ({
        value: key,
        name: location?.townRu || key,
      })),
    [],
  )

  const handleClose = useCallback(() => {
    setEditingUser(null)
    setFeedback(null)
    closeBanPreview()
    onClose()
  }, [closeBanPreview, onClose])

  const displayName = initializedEditingUser?.name || 'Без имени'
  const isSubmitting =
    updateUserMutation.isPending || isBanPreviewLoading || isBanApplying

  return (
    <>
      <Modal
        isOpen={isOpen && (isLoading || initializedEditingUser)}
        onClose={handleClose}
        title={`Редактирование — ${displayName}`}
        footer={
          initializedEditingUser && !isLoading && !error ? (
            <>
              <CabinetButton
                onClick={handleReset}
                disabled={isSubmitting}
                variant="secondary"
                tone="brand"
              >
                Отменить
              </CabinetButton>
              <CabinetButton
                onClick={handleSave}
                disabled={isSubmitting}
                variant="primary"
                className={isSubmitting ? 'cursor-wait' : ''}
              >
                {isBanApplying
                  ? 'Блокировка…'
                  : isBanPreviewLoading || updateUserMutation.isPending
                    ? 'Сохранение…'
                    : 'Сохранить и закрыть'}
              </CabinetButton>
            </>
          ) : null
        }
      >
        {isLoading ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Загружаем данные пользователя...
            </p>
          </div>
        ) : error ? (
          <NoticeBanner tone="error" variant="neon">
            {error instanceof Error
              ? error.message
              : 'Не удалось загрузить данные'}
          </NoticeBanner>
        ) : initializedEditingUser ? (
          <div className="space-y-6">
            {feedback && (
              <NoticeBanner
                tone={feedback.type === 'success' ? 'success' : 'error'}
                variant="neon"
              >
                {feedback.message}
              </NoticeBanner>
            )}

            <FormSectionCard className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <CabinetInputField
                  id="user-edit-name"
                  label="Имя и фамилия"
                  value={initializedEditingUser.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                />
                <CabinetInputField
                  id="user-edit-username"
                  label="Никнейм в ActQuest"
                  value={initializedEditingUser.username || ''}
                  onChange={(e) =>
                    handleFieldChange('username', e.target.value)
                  }
                  placeholder="Например, quest_master"
                />
                <CabinetInputField
                  id="user-edit-phone"
                  label="Телефон"
                  type="tel"
                  value={formatPhoneInput(initializedEditingUser.phone || '')}
                  onChange={(e) =>
                    handleFieldChange('phone', formatPhoneInput(e.target.value))
                  }
                  placeholder="+7"
                />
              </div>

              <CabinetSelectField
                id="user-edit-location"
                label="Город пользователя"
                value={initializedEditingUser.currentLocation || ''}
                onChange={(e) =>
                  handleFieldChange('currentLocation', e.target.value)
                }
                labelClassName={modalItemSmallTitleClass}
                selectClassName="w-full px-4 py-3 text-sm border rounded-xl border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Не указан</option>
                {locationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.name}
                  </option>
                ))}
              </CabinetSelectField>

              <div>
                <label className={modalItemSmallTitleClass}>Фото профиля</label>
                <ImagesInput
                  images={
                    initializedEditingUser.photoUrl
                      ? [initializedEditingUser.photoUrl]
                      : []
                  }
                  onChange={(images) =>
                    handleFieldChange('photoUrl', images?.[0] ?? '')
                  }
                  directory="users"
                  imageName={initializedEditingUser.id || 'user'}
                  maxImages={1}
                  previewShape="circle"
                />
              </div>

              <CabinetTextareaField
                id="user-edit-about"
                label="О себе"
                value={initializedEditingUser.about || ''}
                onChange={(e) => handleFieldChange('about', e.target.value)}
                rows={5}
                placeholder="Расскажите об опыте, любимых форматах и роли в команде."
              />

              <CabinetSelectField
                id="user-role"
                label="Роль в системе"
                value={initializedEditingUser.role || 'client'}
                onChange={(e) => handleFieldChange('role', e.target.value)}
                labelClassName={modalItemSmallTitleClass}
                selectClassName="w-full px-4 py-3 text-sm border rounded-xl border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="client">Участник</option>
                <option value="admin">Администратор</option>
                <option value="ban">Бан</option>
              </CabinetSelectField>

              <div className="grid gap-3 md:grid-cols-2">
                <NeonCheckbox
                  id="user-can-be-game-moderator"
                  checked={Boolean(initializedEditingUser.canBeGameModerator)}
                  onChange={(eventOrChecked) =>
                    handleFieldChange(
                      'canBeGameModerator',
                      typeof eventOrChecked === 'boolean'
                        ? eventOrChecked
                        : Boolean(eventOrChecked?.target?.checked),
                    )
                  }
                  label="Можно назначить модератором"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
                <NeonCheckbox
                  id="user-can-be-game-agent"
                  checked={Boolean(initializedEditingUser.canBeGameAgent)}
                  onChange={(eventOrChecked) =>
                    handleFieldChange(
                      'canBeGameAgent',
                      typeof eventOrChecked === 'boolean'
                        ? eventOrChecked
                        : Boolean(eventOrChecked?.target?.checked),
                    )
                  }
                  label="Можно назначить агентом"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
              </div>
            </FormSectionCard>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(banPreview)}
        onClose={handleCloseBanPreview}
        title="Подтверждение блокировки"
        footer={
          banPreview ? (
            <>
              <CabinetButton
                onClick={handleCloseBanPreview}
                disabled={isBanApplying}
                variant="secondary"
                tone="brand"
              >
                Отмена
              </CabinetButton>
              <CabinetButton
                onClick={handleConfirmBan}
                disabled={isBanApplying}
                variant="primary"
                tone="danger"
                className={isBanApplying ? 'cursor-wait' : ''}
              >
                {isBanApplying ? 'Блокировка…' : 'Подтвердить бан'}
              </CabinetButton>
            </>
          ) : null
        }
      >
        {banPreview ? (
          <div className="space-y-4">
            <NoticeBanner tone="warning" variant="neon">
              Пользователь будет удалён из всех команд. Если он капитан,
              капитанство будет передано другому участнику, а пустые команды
              будут удалены.
            </NoticeBanner>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
              <p>Команд всего: {banPreview?.summary?.teamsCount ?? 0}</p>
              <p>Команд с капитанством: {banPreview?.summary?.captainTeamsCount ?? 0}</p>
              <p>Передач капитанства: {banPreview?.summary?.transferTeamsCount ?? 0}</p>
              <p>Удаляемых команд: {banPreview?.summary?.deletedTeamsCount ?? 0}</p>
            </div>

            <div className="space-y-3">
              {(Array.isArray(banPreview?.teams) ? banPreview.teams : []).map(
                (team) => (
                  <div
                    key={team.teamId}
                    className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {team.teamName}
                    </p>
                    {team.action === 'remove_member' ? (
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        Пользователь будет исключён из команды.
                      </p>
                    ) : null}
                    {team.action === 'transfer_captaincy' ? (
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        Капитанство будет передано:{' '}
                        {team?.nextCaptain?.name || team?.nextCaptain?.userId || 'другому участнику'}.
                      </p>
                    ) : null}
                    {team.action === 'delete_team' ? (
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        Команда будет удалена, потому что других участников нет.
                      </p>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

UserEditModal.propTypes = {
  userId: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

UserEditModal.defaultProps = {
  userId: null,
}

export default UserEditModal
