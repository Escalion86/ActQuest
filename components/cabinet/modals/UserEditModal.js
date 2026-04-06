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

  const initializedEditingUser = editingUser ?? (user ? cloneUser(user) : null)

  const handleFieldChange = useCallback((field, value) => {
    setEditingUser((prev) => (prev ? { ...prev, [field]: value } : null))
    setFeedback(null)
  }, [])

  const updateUserMutation = useOptimisticMutation({
    queryKey: ['user', userId],
    mutationFn: async (payload) => {
      const { json } = await requestApiJson(
        `/api/cabinet/admin/users/${userId}`,
        {
          method: 'PATCH',
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
      setFeedback({
        type: 'success',
        message: 'Пользователь успешно обновлен',
      })
      setEditingUser(null)
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        message: err?.message || 'Не удалось сохранить изменения',
      })
    },
  })

  const handleSave = useCallback(async () => {
    if (!initializedEditingUser || !user) {
      return
    }

    const phone = initializedEditingUser.phone || ''
    const normalizedPhone = phone.trim() ? normalizePhoneForSubmit(phone) : ''

    const payload = {
      name:
        typeof initializedEditingUser.name === 'string'
          ? initializedEditingUser.name.trim()
          : '',
      username:
        typeof initializedEditingUser.username === 'string'
          ? initializedEditingUser.username.trim()
          : '',
      phone: normalizedPhone,
      currentLocation:
        typeof initializedEditingUser.currentLocation === 'string'
          ? initializedEditingUser.currentLocation.trim()
          : '',
      photoUrl:
        typeof initializedEditingUser.photoUrl === 'string'
          ? initializedEditingUser.photoUrl
          : '',
      about:
        typeof initializedEditingUser.about === 'string'
          ? initializedEditingUser.about.trim()
          : '',
      role:
        typeof initializedEditingUser.role === 'string'
          ? initializedEditingUser.role.trim()
          : 'client',
    }

    updateUserMutation.mutate(payload)
  }, [initializedEditingUser, user, updateUserMutation])

  const handleReset = useCallback(() => {
    setEditingUser(null)
    setFeedback(null)
  }, [])

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
    onClose()
  }, [onClose])

  const displayName = initializedEditingUser?.name || 'Без имени'

  return (
    <Modal
      isOpen={isOpen && (isLoading || initializedEditingUser)}
      onClose={handleClose}
      title={`Редактирование — ${displayName}`}
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
                onChange={(e) => handleFieldChange('username', e.target.value)}
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
              <option value="moder">Модератор</option>
              <option value="admin">Администратор</option>
            </CabinetSelectField>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <CabinetButton
                onClick={handleSave}
                disabled={updateUserMutation.isPending}
                variant="primary"
                className={updateUserMutation.isPending ? 'cursor-wait' : ''}
              >
                {updateUserMutation.isPending
                  ? 'Сохранение…'
                  : 'Сохранить изменения'}
              </CabinetButton>
              <CabinetButton
                onClick={handleReset}
                disabled={updateUserMutation.isPending}
                variant="secondary"
                tone="brand"
              >
                Отменить
              </CabinetButton>
            </div>
          </FormSectionCard>
        </div>
      ) : null}
    </Modal>
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
