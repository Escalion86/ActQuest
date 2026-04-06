'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  formatPhoneInput,
  normalizePhoneForSubmit,
} from '@helpers/phoneInputMask'
import { LOCATIONS } from '@server/serverConstants'

const modalItemSmallTitleClass = 'aq-modal-item-title text-sm font-semibold'

const UserEditModal = ({ userId, isOpen, onClose, onUserUpdated, user: userProp }) => {
  const [user, setUser] = useState(userProp || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // Загрузить данные пользователя при открытии или изменении userId
  useEffect(() => {
    // Если пользователь передан пропсом, использовать его сразу (без загрузки)
    if (userProp) {
      console.log('[UserEditModal] Using user from prop, no loading needed')
      setUser(userProp)
      setIsLoading(false)
      return
    }
    
    if (!isOpen || !userId) {
      return undefined
    }

    let cancelled = false

    const loadUser = async () => {
      setIsLoading(true)
      setError(null)
      setUser(null)
      setFeedback(null)

      try {
        const userData = await fetchCabinetUserDetails({ userId })

        if (!cancelled) {
          setUser(userData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Не удалось загрузить пользователя')
          console.error('Failed to load user:', err)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [isOpen, userId, userProp])

  const handleFieldChange = useCallback((field, value) => {
    setUser((prev) => (prev ? { ...prev, [field]: value } : null))
    setFeedback(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!user) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const phone = user.phone || ''
      const normalizedPhone = phone.trim() ? normalizePhoneForSubmit(phone) : ''

      const payload = {
        name: typeof user.name === 'string' ? user.name.trim() : '',
        username: typeof user.username === 'string' ? user.username.trim() : '',
        phone: normalizedPhone,
        currentLocation:
          typeof user.currentLocation === 'string'
            ? user.currentLocation.trim()
            : '',
        photoUrl: typeof user.photoUrl === 'string' ? user.photoUrl : '',
        about: typeof user.about === 'string' ? user.about.trim() : '',
        role: typeof user.role === 'string' ? user.role.trim() : 'client',
      }

      const { json } = await requestApiJson(
        `/api/cabinet/admin/users/${user.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          fallbackMessage: 'Не удалось сохранить изменения',
        },
      )

      setFeedback({
        type: 'success',
        message: 'Пользователь успешно обновлен',
      })

      if (onUserUpdated) {
        onUserUpdated(json?.data || user)
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Не удалось сохранить изменения',
      })
      console.error('Failed to save user:', err)
    } finally {
      setIsSaving(false)
    }
  }, [user, onUserUpdated])

  const handleReset = useCallback(async () => {
    if (!userId) {
      return
    }

    setIsLoading(true)
    try {
      const userData = await fetchCabinetUserDetails({ userId })
      setUser(userData)
      setFeedback(null)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Не удалось перезагрузить данные',
      })
      console.error('Failed to reload user:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const locationOptions = useMemo(
    () =>
      Object.entries(LOCATIONS || {}).map(([key, location]) => ({
        value: key,
        name: location?.townRu || key,
      })),
    [],
  )

  if (!user && !isLoading && error) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Ошибка загрузки">
        <NoticeBanner tone="error" variant="neon">
          {error}
        </NoticeBanner>
      </Modal>
    )
  }

  const displayName = user?.name || 'Без имени'

  return (
    <Modal
      isOpen={isOpen && (isLoading || user)}
      onClose={onClose}
      title={`Редактирование — ${displayName}`}
    >
      {isLoading ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Загружаем данные пользователя...
          </p>
        </div>
      ) : user ? (
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
                value={user.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
              <CabinetInputField
                id="user-edit-username"
                label="Никнейм в ActQuest"
                value={user.username || ''}
                onChange={(e) => handleFieldChange('username', e.target.value)}
                placeholder="Например, quest_master"
              />
              <CabinetInputField
                id="user-edit-phone"
                label="Телефон"
                type="tel"
                value={formatPhoneInput(user.phone || '')}
                onChange={(e) =>
                  handleFieldChange('phone', formatPhoneInput(e.target.value))
                }
                placeholder="+7"
              />
            </div>

            <CabinetSelectField
              id="user-edit-location"
              label="Город пользователя"
              value={user.currentLocation || ''}
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
                images={user.photoUrl ? [user.photoUrl] : []}
                onChange={(images) =>
                  handleFieldChange('photoUrl', images?.[0] ?? '')
                }
                directory="users"
                imageName={user.id || 'user'}
                maxImages={1}
                previewShape="circle"
              />
            </div>

            <CabinetTextareaField
              id="user-edit-about"
              label="О себе"
              value={user.about || ''}
              onChange={(e) => handleFieldChange('about', e.target.value)}
              rows={5}
              placeholder="Расскажите об опыте, любимых форматах и роли в команде."
            />

            <CabinetSelectField
              id="user-role"
              label="Роль в системе"
              value={user.role || 'client'}
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
                disabled={isSaving}
                variant="primary"
                className={isSaving ? 'cursor-wait' : ''}
              >
                {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
              </CabinetButton>
              <CabinetButton
                onClick={handleReset}
                disabled={isSaving}
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
  onUserUpdated: PropTypes.func,
  user: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    phone: PropTypes.string,
    photoUrl: PropTypes.string,
  }),
}

UserEditModal.defaultProps = {
  userId: null,
  onUserUpdated: null,
  user: null,
}

export default UserEditModal
