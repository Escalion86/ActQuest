'use client'

import { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'

import Modal from '@components/Modal'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import NoticeBanner from '@components/NoticeBanner'
import ImagesInput from '@components/cabinet/ImagesInput'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import requestApiJson from '@helpers/requestApiJson'
import useOptimisticMutation from '@helpers/useOptimisticMutation'
import CABINET_ADMIN_API_BASE from '@helpers/constants'

const modalItemSmallTitleClass =
  'font-semibold text-sm text-slate-700 dark:text-slate-200'

const cloneTeam = (team) => JSON.parse(JSON.stringify(team))

const TeamEditModal = ({ teamId, isOpen, onClose }) => {
  const {
    data: team,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => fetchCabinetTeamDetails({ teamId }),
    enabled: isOpen && !!teamId,
    staleTime: 1000 * 60 * 5,
  })

  const [editingTeam, setEditingTeam] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // Инициализируем editingTeam при загрузке команды
  const initializedEditingTeam = editingTeam ?? (team ? cloneTeam(team) : null)

  const isDirty = useMemo(() => {
    if (!team || !initializedEditingTeam) {
      return false
    }

    return (
      JSON.stringify({
        name: team.name,
        description: team.description,
        image: team.image,
      }) !==
      JSON.stringify({
        name: initializedEditingTeam.name,
        description: initializedEditingTeam.description,
        image: initializedEditingTeam.image,
      })
    )
  }, [team, initializedEditingTeam])

  const handleFieldChange = useCallback((field, value) => {
    setEditingTeam((prev) => ({
      ...prev,
      [field]: value,
    }))
    setFeedback(null)
  }, [])

  const handleReset = useCallback(() => {
    if (!team) {
      return
    }

    setEditingTeam(cloneTeam(team))
    setFeedback(null)
  }, [team])

  const updateTeamMutation = useOptimisticMutation({
    queryKey: ['team', teamId],
    mutationFn: async (payload) => {
      const { json } = await requestApiJson(
        `${CABINET_ADMIN_API_BASE}/teams/${teamId}`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          fallbackMessage: 'Не удалось сохранить изменения',
        },
      )
      return json?.data || payload
    },
    updateCache: (oldTeam, payload) => {
      if (!oldTeam) return oldTeam
      return { ...oldTeam, ...payload }
    },
    onSuccess: () => {
      setFeedback({
        type: 'success',
        message: 'Данные команды обновлены',
      })
      setEditingTeam(null)
    },
    onError: (err) => {
      console.error('Failed to update team', err)
      setFeedback({
        type: 'error',
        message: err?.message || 'Не удалось сохранить изменения',
      })
    },
  })

  const handleSave = useCallback(async () => {
    if (!initializedEditingTeam || !team) {
      return
    }

    if (!isDirty) {
      return
    }

    const payload = {
      name:
        typeof initializedEditingTeam.name === 'string'
          ? initializedEditingTeam.name.trim()
          : '',
      description:
        typeof initializedEditingTeam.description === 'string'
          ? initializedEditingTeam.description.trim()
          : '',
      image:
        typeof initializedEditingTeam.image === 'string'
          ? initializedEditingTeam.image.trim()
          : null,
    }

    updateTeamMutation.mutate(payload)
  }, [initializedEditingTeam, team, isDirty, updateTeamMutation])

  const handleClose = useCallback(() => {
    setEditingTeam(null)
    setFeedback(null)
    onClose()
  }, [onClose])

  return (
    <Modal
      isOpen={isOpen && Boolean(editingTeam)}
      onClose={handleClose}
      title={`Редактирование — ${editingTeam?.name || 'Без имени'}`}
    >
      {isLoading ? (
        <p className="text-sm text-slate-500">
          Загружаем информацию о команде...
        </p>
      ) : error ? (
        <NoticeBanner tone="error" variant="neon">
          {error}
        </NoticeBanner>
      ) : initializedEditingTeam ? (
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
            <CabinetInputField
              id="team-edit-name"
              label="Название команды"
              value={initializedEditingTeam.name || ''}
              onChange={(event) =>
                handleFieldChange('name', event.target.value)
              }
              placeholder="Название"
            />

            <div>
              <label className={modalItemSmallTitleClass}>
                Логотип команды
              </label>
              <ImagesInput
                images={
                  initializedEditingTeam.image
                    ? [initializedEditingTeam.image]
                    : []
                }
                onChange={(nextImages) =>
                  handleFieldChange('image', nextImages?.[0] ?? null)
                }
                directory="teams"
                imageName={initializedEditingTeam.id || 'team'}
                maxImages={1}
                previewShape="round"
              />
            </div>

            <CabinetTextareaField
              id="team-edit-description"
              label="Описание команды"
              value={initializedEditingTeam.description || ''}
              onChange={(event) =>
                handleFieldChange('description', event.target.value)
              }
              rows={5}
              placeholder="Расскажите о команде, её истории и участниках."
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <CabinetButton
                onClick={handleSave}
                disabled={!isDirty || updateTeamMutation.isPending}
                variant="primary"
                className={updateTeamMutation.isPending ? 'cursor-wait' : ''}
              >
                {updateTeamMutation.isPending
                  ? 'Сохранение…'
                  : 'Сохранить изменения'}
              </CabinetButton>
              <CabinetButton
                onClick={handleReset}
                disabled={!isDirty}
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

TeamEditModal.propTypes = {
  teamId: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

TeamEditModal.defaultProps = {
  teamId: null,
}

export default TeamEditModal
