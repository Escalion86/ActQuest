'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import NoticeBanner from '@components/NoticeBanner'
import ImagesInput from '@components/cabinet/ImagesInput'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import requestApiJson from '@helpers/requestApiJson'
import CABINET_ADMIN_API_BASE from '@helpers/constants'

const modalItemSmallTitleClass =
  'font-semibold text-sm text-slate-700 dark:text-slate-200'

const cloneTeam = (team) => JSON.parse(JSON.stringify(team))

const TeamEditModal = ({ teamId, isOpen, onClose, onTeamUpdated }) => {
  const [team, setTeam] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (!isOpen || !teamId) {
      return
    }

    let cancelled = false

    const loadTeam = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const detailedTeam = await fetchCabinetTeamDetails({ teamId })

        if (!cancelled) {
          setTeam(detailedTeam)
          setEditingTeam(cloneTeam(detailedTeam))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Не удалось загрузить команду')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadTeam()

    return () => {
      cancelled = true
    }
  }, [isOpen, teamId])

  const isDirty = useMemo(() => {
    if (!team || !editingTeam) {
      return false
    }

    return (
      JSON.stringify({
        name: team.name,
        description: team.description,
        image: team.image,
      }) !==
      JSON.stringify({
        name: editingTeam.name,
        description: editingTeam.description,
        image: editingTeam.image,
      })
    )
  }, [team, editingTeam])

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

  const handleSave = useCallback(async () => {
    if (!editingTeam || !team) {
      return
    }

    if (!isDirty) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const payload = {
        name:
          typeof editingTeam.name === 'string' ? editingTeam.name.trim() : '',
        description:
          typeof editingTeam.description === 'string'
            ? editingTeam.description.trim()
            : '',
        image:
          typeof editingTeam.image === 'string'
            ? editingTeam.image.trim()
            : null,
      }

      const { json } = await requestApiJson(
        `${CABINET_ADMIN_API_BASE}/teams/${editingTeam.id}`,
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

      const updatedDoc = json.data ?? {}
      const updatedTeam = {
        ...editingTeam,
        ...updatedDoc,
      }

      setTeam(updatedTeam)
      setEditingTeam(cloneTeam(updatedTeam))
      setFeedback({
        type: 'success',
        message: 'Данные команды обновлены',
      })

      if (onTeamUpdated) {
        onTeamUpdated(updatedTeam)
      }
    } catch (err) {
      console.error('Failed to update team', err)
      setFeedback({
        type: 'error',
        message: err?.message || 'Не удалось сохранить изменения',
      })
    } finally {
      setIsSaving(false)
    }
  }, [editingTeam, team, isDirty, onTeamUpdated])

  const handleClose = useCallback(() => {
    setTeam(null)
    setEditingTeam(null)
    setError(null)
    setFeedback(null)
    setIsLoading(false)
    setIsSaving(false)
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
      ) : editingTeam ? (
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
              value={editingTeam.name || ''}
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
                images={editingTeam.image ? [editingTeam.image] : []}
                onChange={(nextImages) =>
                  handleFieldChange('image', nextImages?.[0] ?? null)
                }
                directory="teams"
                imageName={editingTeam.id || 'team'}
                maxImages={1}
                previewShape="round"
              />
            </div>

            <CabinetTextareaField
              id="team-edit-description"
              label="Описание команды"
              value={editingTeam.description || ''}
              onChange={(event) =>
                handleFieldChange('description', event.target.value)
              }
              rows={5}
              placeholder="Расскажите о команде, её истории и участниках."
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <CabinetButton
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                variant="primary"
                className={isSaving ? 'cursor-wait' : ''}
              >
                {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
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
  onTeamUpdated: PropTypes.func,
}

TeamEditModal.defaultProps = {
  teamId: null,
  onTeamUpdated: null,
}

export default TeamEditModal
