import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import TeamCreateModal from '@components/modals/TeamCreateModal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import TeamEditModal from '@components/modals/TeamEditModal'
import TeamJoinModal from '@components/modals/TeamJoinModal'
import getSessionSafe from '@helpers/getSessionSafe'
import formatDate from '@helpers/formatDate'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { getNounUsers } from '@helpers/getNoun'
import normalizeTeamForCabinet from '@helpers/normalizeTeamForCabinet'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import useSnackbar from '@helpers/useSnackbar'
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
  const [isSaving, setIsSaving] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [newTeamOpen, setNewTeamOpen] = useState(true)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [joinTeamId, setJoinTeamId] = useState('')
  const [isJoiningTeam, setIsJoiningTeam] = useState(false)
  const [isTeamIdCopied, setIsTeamIdCopied] = useState(false)
  const copyTimeoutRef = useRef(null)
  const [isTeamDescriptionModalOpen, setIsTeamDescriptionModalOpen] = useState(false)
  const snackbar = useSnackbar()

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
    setMemberActionId(null)
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
    setIsTeamDescriptionModalOpen(false)
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

  useEffect(() => {
    if (!selectedTeam) {
      setIsTeamDescriptionModalOpen(false)
    }
  }, [selectedTeam])

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
  }, [canManageSelectedTeam, persistedTeams, selectedTeamId])

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true)
  }, [])

  const handleCloseCreateModal = useCallback(() => {
    if (isCreatingTeam) {
      return
    }

    setIsCreateModalOpen(false)
    setNewTeamName('')
    setNewTeamDescription('')
    setNewTeamOpen(true)
  }, [isCreatingTeam])

  const handleOpenJoinModal = useCallback(() => {
    setIsJoinModalOpen(true)
  }, [])

  const handleCloseJoinModal = useCallback(() => {
    if (isJoiningTeam) {
      return
    }

    setIsJoinModalOpen(false)
    setJoinTeamId('')
  }, [isJoiningTeam])

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
      snackbar.error('Введите название команды')
      return
    }

    if (!location) {
      snackbar.error(
        'Не удалось определить площадку пользователя. Создание команды недоступно.'
      )
      return
    }

    if (!Number.isFinite(currentTelegramIdNumber)) {
      snackbar.error(
        'Чтобы управлять командами, привяжите Telegram-аккаунт в профиле.'
      )
      return
    }

    setIsCreatingTeam(true)

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
      snackbar.success(
        `Команда «${freshTeam.name || trimmedName}» создана. Вы назначены капитаном.`
      )
    } catch (error) {
      console.error('Failed to create team', error)
      snackbar.error(error?.message || 'Не удалось создать команду')
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
    snackbar,
    sortTeamsByUpdatedAt,
  ])

  const handleJoinTeam = useCallback(async () => {
    const trimmedTeamId = joinTeamId.trim()

    if (!trimmedTeamId) {
      snackbar.error('Введите идентификатор команды')
      return
    }

    if (!location) {
      snackbar.error(
        'Не удалось определить площадку пользователя. Вступление в команду недоступно.'
      )
      return
    }

    if (!Number.isFinite(currentTelegramIdNumber)) {
      snackbar.error(
        'Чтобы присоединяться к командам, привяжите Telegram-аккаунт в профиле.'
      )
      return
    }

    if (teams.some((team) => team.id === trimmedTeamId)) {
      snackbar.error('Вы уже состоите в этой команде')
      return
    }

    setIsJoiningTeam(true)

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
      snackbar.success(
        `Вы присоединились к команде «${freshTeam.name || 'без названия'}».`
      )
    } catch (error) {
      console.error('Failed to join team', error)
      snackbar.error(error?.message || 'Не удалось присоединиться к команде')
    } finally {
      setIsJoiningTeam(false)
    }
  }, [
    currentTelegramIdNumber,
    fetchTeamsSnapshot,
    location,
    joinTeamId,
    snackbar,
    sortTeamsByUpdatedAt,
    teams,
  ])

  const handleSaveTeam = useCallback(async () => {
    if (!selectedTeam || !location || !canManageSelectedTeam) {
      return
    }

    setIsSaving(true)

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
      snackbar.success('Изменения сохранены')
      setIsEditModalOpen(false)
    } catch (error) {
      console.error('Failed to update team', error)
      snackbar.error(error?.message || 'Не удалось сохранить команду')
    } finally {
      setIsSaving(false)
    }
  }, [
    canManageSelectedTeam,
    location,
    selectedTeam,
    selectedTeamId,
    snackbar,
  ])

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
        snackbar.error(
          'Нельзя удалить капитана команды. Назначьте нового капитана и повторите действие.'
        )
        return
      }

      setMemberActionId(memberId)

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

        snackbar.success(
          `Участник «${member.name || 'Без имени'}» удалён из команды`
        )
      } catch (error) {
        console.error('Failed to remove team member', error)
        snackbar.error(error?.message || 'Не удалось удалить участника')
      } finally {
        setMemberActionId(null)
      }
    },
    [
      canManageSelectedTeam,
      location,
      selectedTeam,
      selectedTeamId,
      snackbar,
    ]
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

        snackbar.success(
          `«${member.name || 'Участник'}» назначен капитаном команды`
        )
      } catch (error) {
        console.error('Failed to promote team member', error)
        snackbar.error(error?.message || 'Не удалось изменить роль участника')
      } finally {
        setMemberActionId(null)
      }
    },
    [
      canManageSelectedTeam,
      location,
      selectedTeam,
      selectedTeamId,
      snackbar,
    ]
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

      const canManageTeam =
        isAdmin ||
        (team.members ?? []).some(
          (member) =>
            member.isCaptain &&
            member.telegramId === (currentTelegramIdString ?? '')
        )

      return {
        id: team.id,
        name: team.name || 'Без названия',
        membersCount: getNounUsers(team.membersCount ?? 0),
        gamesCount: team.gamesCount ?? 0,
        updatedLabel,
        open: Boolean(team.open),
        canManage: canManageTeam,
      }
    })
  }, [currentTelegramIdString, isAdmin, teams])

  const handleTeamCardClick = useCallback((team) => {
    if (!team) {
      return
    }

    setSelectedTeamId(team.id)
    setIsEditModalOpen(false)
    setIsTeamDescriptionModalOpen(true)
  }, [])

  const handleEditTeamFromList = useCallback(
    (teamId) => {
      const team = teams.find((item) => item.id === teamId)

      if (!team) {
        return
      }

      const canManageTeam =
        isAdmin ||
        (team.members ?? []).some(
          (member) =>
            member.isCaptain &&
            member.telegramId === (currentTelegramIdString ?? '')
        )

      if (!canManageTeam) {
        return
      }

      setSelectedTeamId(teamId)
      closeTeamDescriptionModal()
      setIsEditModalOpen(true)
    },
    [
      closeTeamDescriptionModal,
      currentTelegramIdString,
      isAdmin,
      teams,
    ]
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
        {selectedTeam && (!location || teamRestrictionMessage) ? (
          <div className="mb-6 space-y-4">
            {!location && (
              <div className="p-4 text-sm border text-amber-700 bg-amber-50 border-amber-200 rounded-2xl">
                Не удалось определить площадку пользователя. Сохранение
                изменений недоступно.
              </div>
            )}

            {teamRestrictionMessage && (
              <div className="p-4 text-sm border text-amber-700 bg-amber-50 border-amber-200 rounded-2xl">
                {teamRestrictionMessage}
              </div>
            )}
          </div>
        ) : null}

        <section className="grid gap-6">
          <div className="space-y-4">
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
                {teamsForList.map((team) => {
                  return (
                    <li key={team.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleTeamCardClick(team)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleTeamCardClick(team)
                          }
                        }}
                        className="w-full text-left p-4 border border-slate-200 dark:border-slate-700 rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer bg-white hover:border-primary hover:bg-blue-50 dark:bg-slate-900/80 dark:hover:bg-violet-500/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-primary">
                              {team.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded-full ${
                                team.open
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {team.open ? 'Открыта' : 'Закрыта'}
                            </span>
                            {team.canManage && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleEditTeamFromList(team.id)
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-slate-600 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:text-violet-100"
                                aria-label="Редактировать команду"
                                title="Редактировать команду"
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M4 13.5V16h2.5L15 7.5l-2.5-2.5L4 13.5z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M12.5 5.5l2-2a1.5 1.5 0 112.121 2.121l-2 2"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {team.membersCount}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {team.gamesCount > 0
                            ? `Игр: ${team.gamesCount} · Обновлено ${team.updatedLabel}`
                            : `Обновлено ${team.updatedLabel}`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center bg-white dark:bg-slate-900/80 border shadow-sm text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-2xl">
                У вас пока нет команд. Нажмите «Создать команду», чтобы сформировать новую, или используйте кнопку вступления, если знаете id команды.
              </div>
            )}
          </div>
        </section>
        <TeamEditModal
          selectedTeam={selectedTeam}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          canManageSelectedTeam={canManageSelectedTeam}
          isSaving={isSaving}
          onTeamFieldChange={handleTeamFieldChange}
          onCopyTeamId={handleCopyTeamId}
          isTeamIdCopied={isTeamIdCopied}
          onModalPrimaryAction={handleModalPrimaryAction}
          isDirty={isDirty}
          onResetTeam={handleResetTeam}
          memberActionId={memberActionId}
          onSetCaptain={handleSetCaptain}
          onRemoveMember={handleRemoveMember}
          location={location}
        />
        <TeamCreateModal
          isOpen={isCreateModalOpen}
          onClose={handleCloseCreateModal}
          isCreatingTeam={isCreatingTeam}
          isCreateActionDisabled={isCreateActionDisabled}
          newTeamName={newTeamName}
          onChangeNewTeamName={setNewTeamName}
          newTeamDescription={newTeamDescription}
          onChangeNewTeamDescription={setNewTeamDescription}
          newTeamOpen={newTeamOpen}
          onChangeNewTeamOpen={setNewTeamOpen}
          onCreateTeam={handleCreateTeam}
        />
        <TeamJoinModal
          isOpen={isJoinModalOpen}
          onClose={handleCloseJoinModal}
          isJoiningTeam={isJoiningTeam}
          isJoinActionDisabled={isJoinActionDisabled}
          joinTeamId={joinTeamId}
          onChangeJoinTeamId={setJoinTeamId}
          onJoinTeam={handleJoinTeam}
          canUseSelfServiceTeams={canUseSelfServiceTeams}
        />
        <TeamDescriptionModal
          isOpen={isTeamDescriptionModalOpen}
          onClose={closeTeamDescriptionModal}
          selectedTeam={selectedTeam}
        />
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
