import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import Modal from '@components/Modal'
import getSessionSafe from '@helpers/getSessionSafe'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { getNounUsers } from '@helpers/getNoun'
import normalizeTeamForCabinet from '@helpers/normalizeTeamForCabinet'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import dbConnect from '@utils/dbConnect'

const serializeTeamForComparison = (team) => {
  if (!team) {
    return null
  }

  return JSON.stringify({
    name: team.name ?? '',
    description: team.description ?? '',
    open: Boolean(team.open),
  })
}

const buildTeamUpdatePayload = (team) => {
  const name = team.name ?? ''

  return {
    name,
    name_lowered: name.toLowerCase(),
    description: team.description ?? '',
    open: Boolean(team.open),
  }
}

const normalizePhoneLink = (phone) => {
  if (!phone) {
    return ''
  }

  return phone.replace(/[^+\d]/g, '')
}

const getErrorMessage = (value, fallbackMessage) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  if (value && typeof value.message === 'string' && value.message.trim().length > 0) {
    return value.message
  }

  return fallbackMessage
}

const TeamsPage = ({
  initialTeams,
  initialLocation,
  session: initialSession,
}) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const userRole = activeSession?.user?.role ?? 'client'
  const currentTelegramId = activeSession?.user?.telegramId ?? null
  const currentTelegramIdString =
    currentTelegramId === null || currentTelegramId === undefined
      ? null
      : String(currentTelegramId)
  const currentTelegramIdNumber =
    currentTelegramId === null || currentTelegramId === undefined
      ? null
      : Number(currentTelegramId)

  const [teams, setTeams] = useState(initialTeams)
  const [persistedTeams, setPersistedTeams] = useState(initialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(
    initialTeams[0]?.id ?? null
  )
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [newTeamOpen, setNewTeamOpen] = useState(true)
  const [createFeedback, setCreateFeedback] = useState(null)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [joinTeamId, setJoinTeamId] = useState('')
  const [joinFeedback, setJoinFeedback] = useState(null)
  const [isJoiningTeam, setIsJoiningTeam] = useState(false)
  const [isTeamIdCopied, setIsTeamIdCopied] = useState(false)
  const copyTimeoutRef = useRef(null)
  const [teamDescriptionModal, setTeamDescriptionModal] = useState({
    isOpen: false,
    title: '',
    description: '',
  })

  useEffect(() => {
    setTeams(initialTeams)
    setPersistedTeams(initialTeams)
    setSelectedTeamId((prev) => {
      if (prev && initialTeams.some((team) => team.id === prev)) {
        return prev
      }

      return initialTeams[0]?.id ?? null
    })
  }, [initialTeams])

  useEffect(() => {
    setFeedback(null)
    setMemberActionId(null)
    setIsEditModalOpen(false)
  }, [selectedTeamId])

  useEffect(() => {
    if (!isEditModalOpen) {
      setIsTeamIdCopied(false)
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
    }
  }, [isEditModalOpen])

  const closeTeamDescriptionModal = useCallback(() => {
    setTeamDescriptionModal({ isOpen: false, title: '', description: '' })
  }, [])

  useEffect(() => () => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = null
    }
  }, [])

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  )

  const persistedSelectedTeam = useMemo(
    () => persistedTeams.find((team) => team.id === selectedTeamId) ?? null,
    [persistedTeams, selectedTeamId]
  )

  const isDirty = useMemo(() => {
    if (!selectedTeam || !persistedSelectedTeam) {
      return false
    }

    return (
      serializeTeamForComparison(selectedTeam) !==
      serializeTeamForComparison(persistedSelectedTeam)
    )
  }, [persistedSelectedTeam, selectedTeam])

  const isAdmin = userRole === 'admin' || userRole === 'dev'
  const isTeamCaptain = useMemo(() => {
    if (!selectedTeam || !currentTelegramIdString) {
      return false
    }

    return selectedTeam.members?.some(
      (member) =>
        member.isCaptain && member.telegramId === currentTelegramIdString
    )
  }, [currentTelegramIdString, selectedTeam])

  const canManageSelectedTeam = isAdmin || isTeamCaptain
  const canUseSelfServiceTeams =
    Boolean(location) && Number.isFinite(currentTelegramIdNumber)

  const sortTeamsByUpdatedAt = useCallback((items) => {
    if (!Array.isArray(items)) {
      return []
    }

    return [...items].sort((first, second) => {
      const firstTime = first?.updatedAt ? new Date(first.updatedAt).getTime() : 0
      const secondTime = second?.updatedAt
        ? new Date(second.updatedAt).getTime()
        : 0

      if (Number.isNaN(secondTime) && Number.isNaN(firstTime)) {
        return 0
      }

      if (Number.isNaN(firstTime)) {
        return 1
      }

      if (Number.isNaN(secondTime)) {
        return -1
      }

      return secondTime - firstTime
    })
  }, [])

  const fetchTeamsSnapshot = useCallback(
    async (teamIds) => {
      if (!location || !Array.isArray(teamIds) || teamIds.length === 0) {
        return []
      }

      const params = new URLSearchParams({ location })
      teamIds
        .map((id) => (typeof id === 'string' ? id : id?.toString?.() ?? ''))
        .filter((id) => id.length > 0)
        .forEach((id) => params.append('teamIds', id))

      if ([...params.keys()].filter((key) => key === 'teamIds').length === 0) {
        return []
      }

      const response = await fetch(`/api/cabinet/teams?${params.toString()}`)
      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(
          getErrorMessage(json?.error, 'Не удалось загрузить данные команды')
        )
      }

      return Array.isArray(json?.data) ? json.data : []
    },
    [location]
  )

  const updateSelectedTeam = useCallback(
    (updater) => {
      if (!selectedTeamId || !canManageSelectedTeam) {
        return
      }

      setTeams((prevTeams) =>
        prevTeams.map((team) => {
          if (team.id !== selectedTeamId) {
            return team
          }

          const patch = typeof updater === 'function' ? updater(team) : updater
          return { ...team, ...patch }
        })
      )
    },
    [canManageSelectedTeam, selectedTeamId]
  )

  const handleTeamFieldChange = useCallback(
    (field, value) => {
      if (!canManageSelectedTeam) {
        return
      }

      setFeedback(null)
      updateSelectedTeam({ [field]: value })
    },
    [canManageSelectedTeam, updateSelectedTeam]
  )

  const handleResetTeam = useCallback(() => {
    if (!selectedTeamId || !canManageSelectedTeam) {
      return
    }

    setTeams((prevTeams) =>
      prevTeams.map((team) => {
        if (team.id !== selectedTeamId) {
          return team
        }

        const original = persistedTeams.find(
          (item) => item.id === selectedTeamId
        )
        return original ? { ...original } : team
      })
    )
    setFeedback(null)
  }, [canManageSelectedTeam, persistedTeams, selectedTeamId])

  const handleOpenCreateModal = useCallback(() => {
    setCreateFeedback(null)
    setIsCreateModalOpen(true)
  }, [])

  const handleCloseCreateModal = useCallback(() => {
    if (isCreatingTeam) {
      return
    }

    setIsCreateModalOpen(false)
    setCreateFeedback(null)
    setNewTeamName('')
    setNewTeamDescription('')
    setNewTeamOpen(true)
  }, [isCreatingTeam])

  const handleOpenJoinModal = useCallback(() => {
    setJoinFeedback(null)
    setIsJoinModalOpen(true)
  }, [])

  const handleCloseJoinModal = useCallback(() => {
    if (isJoiningTeam) {
      return
    }

    setIsJoinModalOpen(false)
    setJoinFeedback(null)
    setJoinTeamId('')
  }, [isJoiningTeam])

  const handleOpenEditModal = useCallback(() => {
    if (!canManageSelectedTeam) {
      return
    }

    setFeedback(null)
    closeTeamDescriptionModal()
    setIsEditModalOpen(true)
  }, [canManageSelectedTeam, closeTeamDescriptionModal])

  const handleCloseEditModal = useCallback(() => {
    if (isSaving) {
      return
    }

    setIsEditModalOpen(false)
  }, [isSaving])


  const handleCopyTeamId = useCallback(() => {
    const value = selectedTeam?.id

    if (!value || typeof window === 'undefined') {
      return
    }

    const copyText = value.toString()

    const copyPromise = navigator?.clipboard?.writeText
      ? navigator.clipboard.writeText(copyText)
      : new Promise((resolve, reject) => {
          try {
            const textarea = document.createElement('textarea')
            textarea.value = copyText
            textarea.setAttribute('readonly', '')
            textarea.style.position = 'absolute'
            textarea.style.left = '-9999px'
            document.body.appendChild(textarea)
            textarea.select()
            const successful = document.execCommand('copy')
            document.body.removeChild(textarea)
            if (successful) {
              resolve()
            } else {
              reject(new Error('Copy command failed'))
            }
          } catch (error) {
            reject(error)
          }
        })

    copyPromise
      .then(() => {
        setIsTeamIdCopied(true)
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current)
        }
        copyTimeoutRef.current = setTimeout(() => {
          setIsTeamIdCopied(false)
          copyTimeoutRef.current = null
        }, 2000)
      })
      .catch(() => {
        setIsTeamIdCopied(false)
      })
  }, [copyTimeoutRef, selectedTeam])

  const handleCreateTeam = useCallback(async () => {
    const trimmedName = newTeamName.trim()
    const trimmedDescription = newTeamDescription.trim()

    if (!trimmedName) {
      setCreateFeedback({
        type: 'error',
        message: 'Введите название команды',
      })
      return
    }

    if (!location) {
      setCreateFeedback({
        type: 'error',
        message:
          'Не удалось определить площадку пользователя. Создание команды недоступно.',
      })
      return
    }

    if (!Number.isFinite(currentTelegramIdNumber)) {
      setCreateFeedback({
        type: 'error',
        message:
          'Чтобы управлять командами, привяжите Telegram-аккаунт в профиле.',
      })
      return
    }

    setIsCreatingTeam(true)
    setCreateFeedback(null)

    try {
      const createPayload = buildTeamUpdatePayload({
        name: trimmedName,
        description: trimmedDescription,
        open: Boolean(newTeamOpen),
      })

      const response = await fetch(
        `/api/${location}/custom?collection=teams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: createPayload }),
        }
      )

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(
          getErrorMessage(json?.error, 'Не удалось создать команду')
        )
      }

      const createdTeamIdRaw = json?.data?._id ?? json?.data?.id
      const createdTeamId =
        typeof createdTeamIdRaw === 'string'
          ? createdTeamIdRaw
          : createdTeamIdRaw?.toString?.() ?? null

      if (!createdTeamId) {
        throw new Error('Не удалось получить идентификатор новой команды')
      }

      const membershipResponse = await fetch(
        `/api/${location}/custom?collection=teamsusers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              teamId: createdTeamId,
              userTelegramId: currentTelegramIdNumber,
              role: 'capitan',
            },
          }),
        }
      )

      const membershipJson = await membershipResponse.json()

      if (!membershipResponse.ok || membershipJson?.success === false) {
        throw new Error(
          getErrorMessage(
            membershipJson?.error,
            'Не удалось добавить вас в новую команду'
          )
        )
      }

      const [freshTeam] = await fetchTeamsSnapshot([createdTeamId])

      if (!freshTeam) {
        throw new Error(
          'Команда создана, но не удалось обновить список. Обновите страницу.'
        )
      }

      setTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ])
      )
      setPersistedTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ])
      )
      setSelectedTeamId(freshTeam.id)

      setIsCreateModalOpen(false)
      setNewTeamName('')
      setNewTeamDescription('')
      setNewTeamOpen(true)
      setFeedback({
        type: 'success',
        message: `Команда «${freshTeam.name || trimmedName}» создана. Вы назначены капитаном.`,
      })
    } catch (error) {
      console.error('Failed to create team', error)
      setCreateFeedback({
        type: 'error',
        message: error?.message || 'Не удалось создать команду',
      })
    } finally {
      setIsCreatingTeam(false)
    }
  }, [
    currentTelegramIdNumber,
    fetchTeamsSnapshot,
    location,
    newTeamDescription,
    newTeamName,
    newTeamOpen,
    sortTeamsByUpdatedAt,
  ])

  const handleJoinTeam = useCallback(async () => {
    const trimmedTeamId = joinTeamId.trim()

    if (!trimmedTeamId) {
      setJoinFeedback({
        type: 'error',
        message: 'Введите идентификатор команды',
      })
      return
    }

    if (!location) {
      setJoinFeedback({
        type: 'error',
        message:
          'Не удалось определить площадку пользователя. Вступление в команду недоступно.',
      })
      return
    }

    if (!Number.isFinite(currentTelegramIdNumber)) {
      setJoinFeedback({
        type: 'error',
        message:
          'Чтобы присоединяться к командам, привяжите Telegram-аккаунт в профиле.',
      })
      return
    }

    if (teams.some((team) => team.id === trimmedTeamId)) {
      setJoinFeedback({
        type: 'error',
        message: 'Вы уже состоите в этой команде',
      })
      return
    }

    setIsJoiningTeam(true)
    setJoinFeedback(null)

    try {
      const teamResponse = await fetch(
        `/api/${location}/teams/${trimmedTeamId}`
      )
      const teamJson = await teamResponse.json()

      if (!teamResponse.ok || teamJson?.success === false) {
        throw new Error(
          getErrorMessage(teamJson?.error, 'Команда не найдена')
        )
      }

      const rawOpen = teamJson?.data?.open
      const isTeamOpen =
        rawOpen === true || rawOpen === 'true' || rawOpen === 1 || rawOpen === '1'

      if (!isTeamOpen) {
        throw new Error(
          'В этой команде закрыт набор. Попросите капитана добавить вас вручную.'
        )
      }

      const membershipResponse = await fetch(
        `/api/${location}/custom?collection=teamsusers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              teamId: trimmedTeamId,
              userTelegramId: currentTelegramIdNumber,
              role: 'participant',
            },
          }),
        }
      )

      const membershipJson = await membershipResponse.json()

      if (!membershipResponse.ok || membershipJson?.success === false) {
        throw new Error(
          getErrorMessage(
            membershipJson?.error,
            'Не удалось присоединиться к команде'
          )
        )
      }

      const [freshTeam] = await fetchTeamsSnapshot([trimmedTeamId])

      if (!freshTeam) {
        throw new Error(
          'Вы вступили в команду, но не удалось обновить список. Обновите страницу.'
        )
      }

      setTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ])
      )
      setPersistedTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ])
      )
      setSelectedTeamId(freshTeam.id)

      setIsJoinModalOpen(false)
      setJoinTeamId('')
      setFeedback({
        type: 'success',
        message: `Вы присоединились к команде «${freshTeam.name || 'без названия'}».`,
      })
    } catch (error) {
      console.error('Failed to join team', error)
      setJoinFeedback({
        type: 'error',
        message: error?.message || 'Не удалось присоединиться к команде',
      })
    } finally {
      setIsJoiningTeam(false)
    }
  }, [
    currentTelegramIdNumber,
    fetchTeamsSnapshot,
    location,
    joinTeamId,
    sortTeamsByUpdatedAt,
    teams,
  ])

  const handleSaveTeam = useCallback(async () => {
    if (!selectedTeam || !location || !canManageSelectedTeam) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const response = await fetch(
        `/api/${location}/teams/${selectedTeam.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: buildTeamUpdatePayload(selectedTeam) }),
        }
      )

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(
          getErrorMessage(json?.error, 'Не удалось сохранить команду')
        )
      }

      const updatedTeam = {
        ...selectedTeam,
        name: json.data?.name ?? selectedTeam.name,
        description: json.data?.description ?? selectedTeam.description,
        open: Boolean(json.data?.open ?? selectedTeam.open),
        updatedAt: json.data?.updatedAt
          ? new Date(json.data.updatedAt).toISOString()
          : selectedTeam.updatedAt,
      }

      setTeams((prevTeams) =>
        prevTeams.map((team) =>
          team.id === selectedTeamId ? updatedTeam : team
        )
      )
      setPersistedTeams((prevTeams) =>
        prevTeams.map((team) =>
          team.id === selectedTeamId ? updatedTeam : team
        )
      )
      setFeedback({ type: 'success', message: 'Изменения сохранены' })
      setIsEditModalOpen(false)
    } catch (error) {
      console.error('Failed to update team', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить команду',
      })
    } finally {
      setIsSaving(false)
    }
  }, [canManageSelectedTeam, location, selectedTeam, selectedTeamId])

  const handleModalPrimaryAction = useCallback(() => {
    if (isSaving) {
      return
    }

    if (isDirty && canManageSelectedTeam) {
      handleSaveTeam()
    } else {
      handleCloseEditModal()
    }
  }, [canManageSelectedTeam, handleCloseEditModal, handleSaveTeam, isDirty, isSaving])

  const handleRemoveMember = useCallback(
    async (memberId) => {
      if (!selectedTeam || !canManageSelectedTeam || !location) {
        return
      }

      const member = selectedTeam.members.find((item) => item.id === memberId)
      if (!member) {
        return
      }

      if (member.isCaptain) {
        setFeedback({
          type: 'error',
          message:
            'Нельзя удалить капитана команды. Назначьте нового капитана и повторите действие.',
        })
        return
      }

      setMemberActionId(memberId)
      setFeedback(null)

      try {
        const response = await fetch(
          `/api/${location}/teamsusers/${memberId}`,
          {
            method: 'DELETE',
          }
        )
        const json = await response.json()

        if (!response.ok || json?.success === false) {
          throw new Error(
            getErrorMessage(json?.error, 'Не удалось удалить участника')
          )
        }

        const updatedMembers = (selectedTeam.members ?? []).filter(
          (item) => item.id !== memberId
        )
        const updatedTeam = {
          ...selectedTeam,
          members: updatedMembers,
          membersCount: updatedMembers.length,
          captain: updatedMembers.find((item) => item.isCaptain) ?? null,
        }

        setTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
        )

        setFeedback({
          type: 'success',
          message: `Участник «${member.name || 'Без имени'}» удалён из команды`,
        })
      } catch (error) {
        console.error('Failed to remove team member', error)
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось удалить участника',
        })
      } finally {
        setMemberActionId(null)
      }
    },
    [canManageSelectedTeam, location, selectedTeam, selectedTeamId]
  )

  const handleSetCaptain = useCallback(
    async (memberId) => {
      if (!selectedTeam || !canManageSelectedTeam || !location) {
        return
      }

      const member = selectedTeam.members.find((item) => item.id === memberId)
      if (!member || member.isCaptain) {
        return
      }

      const currentCaptain = selectedTeam.members.find((item) => item.isCaptain)

      setMemberActionId(memberId)
      setFeedback(null)

      try {
        const requests = [
          fetch(`/api/${location}/teamsusers/${memberId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { role: 'capitan' } }),
          }),
        ]

        if (currentCaptain) {
          requests.push(
            fetch(`/api/${location}/teamsusers/${currentCaptain.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: { role: 'participant' } }),
            })
          )
        }

        const responses = await Promise.all(requests)
        const payloads = await Promise.all(responses.map((res) => res.json()))

        responses.forEach((res, index) => {
          if (!res.ok || payloads[index]?.success === false) {
            throw new Error(
              payloads[index]?.error || 'Не удалось обновить роль участника'
            )
          }
        })

        const updatedMembers = (selectedTeam.members ?? []).map((item) => {
          if (item.id === memberId) {
            return { ...item, role: 'capitan', isCaptain: true }
          }

          if (item.id === currentCaptain?.id) {
            return { ...item, role: 'participant', isCaptain: false }
          }

          return item
        })

        const updatedTeam = {
          ...selectedTeam,
          members: updatedMembers,
          captain: updatedMembers.find((item) => item.isCaptain) ?? null,
        }

        setTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
        )

        setFeedback({
          type: 'success',
          message: `«${member.name || 'Участник'}» назначен капитаном команды`,
        })
      } catch (error) {
        console.error('Failed to promote team member', error)
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось изменить роль участника',
        })
      } finally {
        setMemberActionId(null)
      }
    },
    [canManageSelectedTeam, location, selectedTeam, selectedTeamId]
  )

  const teamRestrictionMessage = useMemo(() => {
    if (!selectedTeam || canManageSelectedTeam) {
      return null
    }

    if (
      selectedTeam.captain &&
      selectedTeam.captain.telegramId === currentTelegramIdString
    ) {
      return null
    }

    return 'Изменять данные может только администратор или капитан команды. Вы можете просматривать информацию.'
  }, [canManageSelectedTeam, currentTelegramIdString, selectedTeam])

  const isCreateActionDisabled =
    isCreatingTeam || !canUseSelfServiceTeams || newTeamName.trim().length === 0

  const isJoinActionDisabled =
    isJoiningTeam || !canUseSelfServiceTeams || joinTeamId.trim().length === 0

  const teamsForList = useMemo(() => {
    if (!Array.isArray(teams)) {
      return []
    }

    return teams.map((team) => {
      const updatedLabel = team.updatedAt
        ? formatRelativeTimeFromNow(team.updatedAt)
        : '—'

      return {
        id: team.id,
        name: team.name || 'Без названия',
        membersCount: getNounUsers(team.membersCount ?? 0),
        gamesCount: team.gamesCount ?? 0,
        updatedLabel,
        open: Boolean(team.open),
      }
    })
  }, [teams])

  const handleTeamCardClick = useCallback(
    (team) => {
      if (!team) {
        return
      }

      setSelectedTeamId(team.id)
      const fullTeam = teams.find((item) => item.id === team.id) ?? null
      const description =
        typeof fullTeam?.description === 'string'
          ? fullTeam.description.trim()
          : ''
      const title = fullTeam?.name || team.name || 'Без названия'

      setTeamDescriptionModal({
        isOpen: true,
        title,
        description,
      })
    },
    [teams]
  )

  return (
    <>
      <Head>
        <title>ActQuest — Мои команды</title>
      </Head>
      <CabinetLayout
        title="Мои команды"
        description="Следите за составом, назначайте капитанов и контролируйте участие в играх."
        activePage="teams"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-start gap-3 p-4 bg-violet-50 border border-violet-100 shadow-sm rounded-2xl dark:bg-violet-500/10 dark:border-violet-500/40">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-violet-600 font-semibold shadow-sm dark:bg-violet-500/40 dark:text-violet-100"
                aria-hidden="true"
              >
                i
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-violet-900 dark:text-violet-50">Ваши команды</p>
                <p className="text-xs leading-5 text-violet-700 dark:text-violet-200">
                  Выберите команду, чтобы посмотреть состав, управлять статусом и назначить капитана.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                disabled={!canUseSelfServiceTeams}
                title={
                  canUseSelfServiceTeams
                    ? undefined
                    : 'Функция доступна после привязки Telegram и выбора площадки'
                }
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                  canUseSelfServiceTeams
                    ? 'bg-primary text-white hover:bg-blue-700'
                    : 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                Создать команду
              </button>
              <button
                type="button"
                onClick={handleOpenJoinModal}
                disabled={!canUseSelfServiceTeams}
                title={
                  canUseSelfServiceTeams
                    ? undefined
                    : 'Функция доступна после привязки Telegram и выбора площадки'
                }
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  canUseSelfServiceTeams
                    ? 'border border-primary text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10'
                    : 'border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                Присоединиться по id
              </button>
            </div>

            {teamsForList.length > 0 ? (
              <ul className="space-y-3">
                {teamsForList.map((team) => (
                  <li key={team.id}>
                    <button
                      type="button"
                      onClick={() => handleTeamCardClick(team)}
                      className={`w-full text-left p-4 border rounded-2xl transition hover:border-primary hover:bg-blue-50 dark:hover:bg-violet-500/10 ${
                        selectedTeamId === team.id
                          ? 'border-primary bg-blue-50 shadow-sm dark:border-violet-400 dark:bg-violet-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-primary">
                          {team.name}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            team.open
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {team.open ? 'Открыта' : 'Закрыта'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {team.membersCount}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {team.gamesCount > 0
                          ? `Игр: ${team.gamesCount} · Обновлено ${team.updatedLabel}`
                          : `Обновлено ${team.updatedLabel}`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center bg-white dark:bg-slate-900/80 border shadow-sm text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-2xl">
                У вас пока нет команд. Нажмите «Создать команду», чтобы сформировать новую, или используйте кнопку вступления, если знаете id команды.
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            {selectedTeam ? (
              <div className="space-y-6">
                <div className="p-5 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            selectedTeam.open
                              ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                              : 'text-slate-600 bg-slate-100 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {selectedTeam.open
                            ? 'Открыта для заявок'
                            : 'Закрытый состав'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Участников: {selectedTeam.membersCount ?? 0}
                        </span>
                        <span className="text-xs text-slate-500">
                          Участвует в играх: {selectedTeam.gamesCount ?? 0}
                        </span>
                        {selectedTeam.updatedAt && (
                          <span className="text-xs text-slate-500">
                            Обновлено {formatRelativeTimeFromNow(selectedTeam.updatedAt)}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-4 text-xl font-semibold text-primary">
                        {selectedTeam.name || 'Без названия'}
                      </h2>
                    </div>
                    {canManageSelectedTeam && (
                      <button
                        type="button"
                        onClick={handleOpenEditModal}
                        className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Редактировать команду
                      </button>
                    )}
                  </div>
                </div>

                {!location && (
                  <div className="p-4 text-sm border text-amber-700 bg-amber-50 border-amber-200 rounded-2xl">
                    Не удалось определить площадку пользователя. Сохранение
                    изменений недоступно.
                  </div>
                )}

                {feedback && !isEditModalOpen && (
                  <div
                    className={`p-4 text-sm border rounded-2xl ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                {teamRestrictionMessage && (
                  <div className="p-4 text-sm border text-amber-700 bg-amber-50 border-amber-200 rounded-2xl">
                    {teamRestrictionMessage}
                  </div>
                )}

                <section className="p-6 space-y-4 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                  <h3 className="text-lg font-semibold text-primary">Информация о команде</h3>
                  <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Статус набора
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {selectedTeam.open ? 'Открыта для заявок' : 'Закрытый состав'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Участников
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {selectedTeam.membersCount ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Участие в играх
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {selectedTeam.gamesCount ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Капитан
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {selectedTeam.captain?.name || 'Не назначен'}
                        {selectedTeam.captain?.username
                          ? ` (@${selectedTeam.captain.username})`
                          : ''}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                    Описание команды отображается в карточке при выборе в списке.
                  </p>
                </section>

                <section className="p-6 space-y-4 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-primary">Состав команды</h3>
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

                <section className="p-6 space-y-4 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                  <h3 className="text-lg font-semibold text-primary">Игры команды</h3>
                  {selectedTeam.games?.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedTeam.games.map((game) => (
                        <li
                          key={game.id}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/80"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-primary">
                              {game.name || 'Без названия'}
                            </p>
                            <span className="text-xs text-slate-500">
                              {getGameStatusLabel(game.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {game.dateStart
                              ? new Date(game.dateStart).toLocaleString('ru-RU', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : 'Дата не назначена'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Команда пока не участвовала в играх.
                    </p>
                  )}
                </section>

                <Modal
                  isOpen={isEditModalOpen}
                  title={`Редактирование команды «${selectedTeam.name || 'Без названия'}»`}
                  onClose={handleCloseEditModal}
                >
                <>
                  {feedback && (
                    <div
                      className={`mb-6 rounded-2xl border p-4 text-sm ${
                        feedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      {feedback.message}
                    </div>
                  )}
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
                            handleTeamFieldChange('name', event.target.value)
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
                              handleTeamFieldChange(
                                'open',
                                event.target.checked
                              )
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
                            onClick={handleCopyTeamId}
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
                          handleTeamFieldChange(
                            'description',
                            event.target.value
                          )
                        }
                        rows={5}
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </section>

                  <section className="p-6 space-y-5 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-primary">
                        Состав команды
                      </h2>
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
                                      href={
                                        phoneLink
                                          ? `tel:${phoneLink}`
                                          : undefined
                                      }
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
                                      onClick={() =>
                                        handleSetCaptain(member.id)
                                      }
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
                                      onClick={() =>
                                        handleRemoveMember(member.id)
                                      }
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
                        Пока нет участников. Пригласите игроков через
                        телеграм-бота, чтобы они появились здесь.
                      </p>
                    )}
                  </section>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={handleModalPrimaryAction}
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
                      onClick={handleResetTeam}
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
                </>
                </Modal>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-white dark:bg-slate-900/80 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <p className="text-sm text-slate-500">
                  Выберите команду из списка слева, чтобы просмотреть детали.
                </p>
              </div>
            )}
          </div>
        </section>
        <Modal
          isOpen={isCreateModalOpen}
          title="Создание команды"
          onClose={handleCloseCreateModal}
          footer={(
            <>
              <button
                type="button"
                onClick={handleCloseCreateModal}
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
                onClick={handleCreateTeam}
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
            {createFeedback ? (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  createFeedback.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {createFeedback.message}
              </div>
            ) : null}
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
                onChange={(event) => setNewTeamName(event.target.value)}
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
                onChange={(event) => setNewTeamDescription(event.target.value)}
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
                onChange={(event) => setNewTeamOpen(event.target.checked)}
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
          onClose={handleCloseJoinModal}
          footer={(
            <>
              <button
                type="button"
                onClick={handleCloseJoinModal}
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
                onClick={handleJoinTeam}
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
            {joinFeedback ? (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  joinFeedback.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {joinFeedback.message}
              </div>
            ) : null}
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
                onChange={(event) => setJoinTeamId(event.target.value)}
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
          isOpen={teamDescriptionModal.isOpen}
          title={`Описание команды — ${teamDescriptionModal.title || 'Без названия'}`}
          onClose={closeTeamDescriptionModal}
        >
          {teamDescriptionModal.description ? (
            <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
              {teamDescriptionModal.description}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Капитан ещё не добавил описание команды.
            </p>
          )}
        </Modal>
      </CabinetLayout>
    </>
  )
}

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

TeamsPage.propTypes = {
  initialTeams: PropTypes.arrayOf(
    PropTypes.shape({
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
    })
  ),
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

TeamsPage.defaultProps = {
  initialTeams: [],
  initialLocation: null,
  session: null,
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/teams'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(
          callbackTarget
        )}`,
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  const rawTelegramId = session?.user?.telegramId
  const numericTelegramId =
    rawTelegramId === null || rawTelegramId === undefined
      ? null
      : Number(rawTelegramId)

  let initialTeams = []

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const TeamsUsersModel = db.model('TeamsUsers')
        if (Number.isFinite(numericTelegramId)) {
          const memberships = await TeamsUsersModel.find({
            userTelegramId: numericTelegramId,
          })
            .select({ teamId: 1 })
            .lean()

          const teamIds = [
            ...new Set(
              memberships
                .map((membership) =>
                  membership?.teamId ? membership.teamId.toString() : null
                )
                .filter(Boolean)
            ),
          ]

          if (teamIds.length > 0) {
            initialTeams = await fetchTeamsForCabinet({ db, teamIds })
          }
        }
      }
    } catch (error) {
      console.error('Failed to load teams for cabinet', error)
    }
  }

  return {
    props: {
      session,
      initialTeams,
      initialLocation: location,
    },
  }
}

export default TeamsPage
