'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import SelectableCard from '@components/cabinet/SelectableCard'
import NoticeBanner from '@components/NoticeBanner'
import TeamCreateModal from '@components/modals/TeamCreateModal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import TeamEditModal from '@components/modals/TeamEditModal'
import TeamJoinModal from '@components/modals/TeamJoinModal'
import UserViewModal from '@components/cabinet/modals/UserViewModal'
import requestApiJson from '@helpers/requestApiJson'
import formatDate from '@helpers/formatDate'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { getNounUsers } from '@helpers/getNoun'
import normalizeTeamForCabinet from '@helpers/normalizeTeamForCabinet'
import useSnackbar from '@helpers/useSnackbar'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import { LOCATIONS } from '@server/serverConstants'

const MAX_TEAMS_PER_USER = 3
const CABINET_TEAMS_API_BASE = '/api/cabinet/teams'
const CABINET_TEAMS_ENTITY_API_BASE = '/api/cabinet/teams'
const CABINET_TEAM_MEMBERS_API_BASE = '/api/cabinet/teams/members'

const resolveRatingBadge = (rating) =>
  rating?.isEligible && Number.isFinite(rating?.rank) ? `#${rating.rank}` : null

const OpenDoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 3h11v18H4z" />
    <path d="M15 6h4l1 3v9l-1 3h-4" />
    <circle cx="10.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
  </svg>
)

const serializeTeamForComparison = (team) => {
  if (!team) {
    return null
  }

  return JSON.stringify({
    name: team.name ?? '',
    description: team.description ?? '',
    image: team.image ?? '',
    open: Boolean(team.open),
    location: team.location ?? '',
  })
}

const buildTeamUpdatePayload = (team) => {
  const name = team.name ?? ''

  return {
    name,
    name_lowered: name.toLowerCase(),
    description: team.description ?? '',
    image: team.image ?? null,
    open: Boolean(team.open),
    location: team.location ?? '',
  }
}

const normalizeTelegramId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return null
}

const TeamsPage = ({
  initialTeams,
  initialLocation,
  session: initialSession,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const safeInitialTeams = Array.isArray(initialTeams) ? initialTeams : []
  const { activeSession } = useMergedSession(initialSession)
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const { effectiveRole: userRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const currentUserId =
    activeSession?.user?._id === null || activeSession?.user?._id === undefined
      ? null
      : String(activeSession.user._id)
  const currentTelegramId = normalizeTelegramId(activeSession?.user?.telegramId)
  const currentTelegramIdNumber = useMemo(() => {
    if (!currentTelegramId) {
      return null
    }

    const numeric = Number(currentTelegramId)
    return Number.isFinite(numeric) ? numeric : null
  }, [currentTelegramId])

  const [teams, setTeams] = useState(safeInitialTeams)
  const [persistedTeams, setPersistedTeams] = useState(safeInitialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(
    safeInitialTeams[0]?.id ?? null,
  )
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [newTeamImage, setNewTeamImage] = useState('')
  const [newTeamOpen, setNewTeamOpen] = useState(true)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [joinTeamId, setJoinTeamId] = useState('')
  const [isJoiningTeam, setIsJoiningTeam] = useState(false)
  const [isTeamIdCopied, setIsTeamIdCopied] = useState(false)
  const copyTimeoutRef = useRef(null)
  const [isTeamDescriptionModalOpen, setIsTeamDescriptionModalOpen] =
    useState(false)
  const [isMemberViewModalOpen, setIsMemberViewModalOpen] = useState(false)
  const [selectedMemberUserId, setSelectedMemberUserId] = useState(null)
  const [selectedMemberTelegramId, setSelectedMemberTelegramId] = useState(null)
  const [isLeavingTeam, setIsLeavingTeam] = useState(false)
  const [isDeletingTeam, setIsDeletingTeam] = useState(false)
  const snackbar = useSnackbar()
  const locationOptions = useMemo(
    () =>
      Object.entries(LOCATIONS)
        .filter(([, value]) => !value?.hidden)
        .map(([key, value]) => ({
          value: key,
          label:
            typeof value?.townRu === 'string' && value.townRu.length > 0
              ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
              : key,
        })),
    [],
  )

  const filterTeamsByCurrentUser = useCallback(
    (items) => {
      if (!Array.isArray(items)) {
        return []
      }

      if (!currentUserId && !currentTelegramId) {
        return []
      }

      return items.filter((team) =>
        (team?.members ?? []).some((member) => {
          const memberUserId =
            typeof member?.userId === 'string' ? member.userId : null
          const memberTelegramId = normalizeTelegramId(member?.telegramId)

          if (currentUserId && memberUserId === currentUserId) {
            return true
          }

          if (currentTelegramId && memberTelegramId === currentTelegramId) {
            return true
          }

          return false
        }),
      )
    },
    [currentTelegramId, currentUserId],
  )

  useEffect(() => {
    const filteredInitialTeams = filterTeamsByCurrentUser(safeInitialTeams)

    setTeams(filteredInitialTeams)
    setPersistedTeams(filteredInitialTeams)
    setSelectedTeamId((prev) => {
      if (prev && filteredInitialTeams.some((team) => team.id === prev)) {
        return prev
      }

      return filteredInitialTeams[0]?.id ?? null
    })
  }, [filterTeamsByCurrentUser, safeInitialTeams])

  const visibleTeams = useMemo(
    () => filterTeamsByCurrentUser(teams),
    [filterTeamsByCurrentUser, teams],
  )
  const visiblePersistedTeams = useMemo(
    () => filterTeamsByCurrentUser(persistedTeams),
    [filterTeamsByCurrentUser, persistedTeams],
  )

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

  const closeMemberViewModal = useCallback(() => {
    setIsMemberViewModalOpen(false)
    setSelectedMemberUserId(null)
    setSelectedMemberTelegramId(null)
  }, [])

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
    },
    [],
  )

  const selectedTeam = useMemo(
    () => visibleTeams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, visibleTeams],
  )

  useEffect(() => {
    if (!selectedTeam) {
      setIsTeamDescriptionModalOpen(false)
    }
  }, [selectedTeam])

  const persistedSelectedTeam = useMemo(
    () =>
      visiblePersistedTeams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, visiblePersistedTeams],
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
    if (!selectedTeam || (!currentUserId && !currentTelegramId)) {
      return false
    }

    return selectedTeam.members?.some(
      (member) =>
        member.isCaptain &&
        ((currentUserId && member.userId === currentUserId) ||
          (currentTelegramId && member.telegramId === currentTelegramId)),
    )
  }, [currentTelegramId, currentUserId, selectedTeam])

  const canManageSelectedTeam = isAdmin || isTeamCaptain
  const selectedTeamCurrentMember = useMemo(() => {
    if (!selectedTeam) {
      return null
    }

    return (
      (selectedTeam.members ?? []).find((member) => {
        if (currentUserId && member.userId === currentUserId) {
          return true
        }

        if (currentTelegramId && member.telegramId === currentTelegramId) {
          return true
        }

        return false
      }) ?? null
    )
  }, [currentTelegramId, currentUserId, selectedTeam])

  const canLeaveSelectedTeam =
    Boolean(selectedTeamCurrentMember) && !selectedTeamCurrentMember.isCaptain
  const canDeleteSelectedTeam = Boolean(selectedTeam && isTeamCaptain)
  const canUseSelfServiceTeams = Boolean(
    currentUserId || currentTelegramIdNumber !== null,
  )
  const isTeamsLimitReached = visibleTeams.length >= MAX_TEAMS_PER_USER
  const canUseSelfServiceTeamsActions =
    canUseSelfServiceTeams && !isTeamsLimitReached

  const sortTeamsByUpdatedAt = useCallback((items) => {
    if (!Array.isArray(items)) {
      return []
    }

    return [...items].sort((first, second) => {
      const firstTime = first?.updatedAt
        ? new Date(first.updatedAt).getTime()
        : 0
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

  const fetchTeamsSnapshot = useCallback(async (teamIds) => {
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      return []
    }

    const params = new URLSearchParams()
    teamIds
      .map((id) => (typeof id === 'string' ? id : (id?.toString?.() ?? '')))
      .filter((id) => id.length > 0)
      .forEach((id) => params.append('teamIds', id))

    if ([...params.keys()].filter((key) => key === 'teamIds').length === 0) {
      return []
    }

    const { json } = await requestApiJson(
      `${CABINET_TEAMS_API_BASE}?${params.toString()}`,
      {
        fallbackMessage: 'Не удалось загрузить данные команды',
      },
    )

    return Array.isArray(json?.data) ? json.data : []
  }, [])

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
        }),
      )
    },
    [canManageSelectedTeam, selectedTeamId],
  )

  const handleTeamFieldChange = useCallback(
    (field, value) => {
      if (!canManageSelectedTeam) {
        return
      }

      updateSelectedTeam({ [field]: value })
    },
    [canManageSelectedTeam, updateSelectedTeam],
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
          (item) => item.id === selectedTeamId,
        )
        return original ? { ...original } : team
      }),
    )
  }, [canManageSelectedTeam, persistedTeams, selectedTeamId])

  const handleOpenCreateModal = useCallback(() => {
    if (!canUseSelfServiceTeamsActions) {
      return
    }

    setIsCreateModalOpen(true)
  }, [canUseSelfServiceTeamsActions])

  const handleCloseCreateModal = useCallback(() => {
    if (isCreatingTeam) {
      return
    }

    setIsCreateModalOpen(false)
    setNewTeamName('')
    setNewTeamDescription('')
    setNewTeamImage('')
    setNewTeamOpen(true)
  }, [isCreatingTeam])

  const handleOpenJoinModal = useCallback(() => {
    if (!canUseSelfServiceTeamsActions) {
      return
    }

    setIsJoinModalOpen(true)
  }, [canUseSelfServiceTeamsActions])

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

  const handleOpenTeamMemberProfile = useCallback((member) => {
    if (!member) {
      return
    }

    const nextUserId =
      typeof member.userId === 'string' && member.userId.trim()
        ? member.userId.trim()
        : null
    const nextTelegramId =
      typeof member.telegramId === 'string' || typeof member.telegramId === 'number'
        ? String(member.telegramId).trim()
        : null

    if (!nextUserId && !nextTelegramId) {
      return
    }

    setSelectedMemberUserId(nextUserId)
    setSelectedMemberTelegramId(nextTelegramId)
    setIsMemberViewModalOpen(true)
  }, [])

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
    if (!canUseSelfServiceTeamsActions) {
      snackbar.error(
        isTeamsLimitReached
          ? `Достигнут лимит: не более ${MAX_TEAMS_PER_USER} команд`
          : 'Создание команды сейчас недоступно',
      )
      return
    }

    const trimmedName = newTeamName.trim()
    const trimmedDescription = newTeamDescription.trim()

    if (!trimmedName) {
      snackbar.error('Введите название команды')
      return
    }

    if (!currentUserId && currentTelegramIdNumber === null) {
      snackbar.error(
        'Чтобы управлять командами, требуется авторизованный пользователь.',
      )
      return
    }

    setIsCreatingTeam(true)

    try {
      const createPayload = buildTeamUpdatePayload({
        name: trimmedName,
        description: trimmedDescription,
        image: newTeamImage || null,
        open: Boolean(newTeamOpen),
      })

      const { json } = await requestApiJson(CABINET_TEAMS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
        fallbackMessage: 'Не удалось создать команду',
      })

      const createdTeamIdRaw = json?.data?._id ?? json?.data?.id
      const createdTeamId =
        typeof createdTeamIdRaw === 'string'
          ? createdTeamIdRaw
          : (createdTeamIdRaw?.toString?.() ?? null)

      if (!createdTeamId) {
        throw new Error('Не удалось получить идентификатор новой команды')
      }

      const [freshTeam] = await fetchTeamsSnapshot([createdTeamId])

      if (!freshTeam) {
        throw new Error(
          'Команда создана, но не удалось обновить список. Обновите страницу.',
        )
      }

      setTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ]),
      )
      setPersistedTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ]),
      )
      setSelectedTeamId(freshTeam.id)

      setIsCreateModalOpen(false)
      setNewTeamName('')
      setNewTeamDescription('')
      setNewTeamImage('')
      setNewTeamOpen(true)
      snackbar.success(
        `Команда «${freshTeam.name || trimmedName}» создана. Вы назначены капитаном.`,
      )
    } catch (error) {
      console.error('Failed to create team', error)
      snackbar.error(error?.message || 'Не удалось создать команду')
    } finally {
      setIsCreatingTeam(false)
    }
  }, [
    canUseSelfServiceTeamsActions,
    currentTelegramIdNumber,
    currentUserId,
    fetchTeamsSnapshot,
    isTeamsLimitReached,
    newTeamDescription,
    newTeamImage,
    newTeamName,
    newTeamOpen,
    snackbar,
    sortTeamsByUpdatedAt,
  ])

  const handleJoinTeam = useCallback(async () => {
    if (!canUseSelfServiceTeamsActions) {
      snackbar.error(
        isTeamsLimitReached
          ? `Достигнут лимит: не более ${MAX_TEAMS_PER_USER} команд`
          : 'Вступление в команду сейчас недоступно',
      )
      return
    }

    const trimmedTeamId = joinTeamId.trim()

    if (!trimmedTeamId) {
      snackbar.error('Введите идентификатор команды')
      return
    }

    if (!currentUserId && currentTelegramIdNumber === null) {
      snackbar.error(
        'Чтобы присоединяться к командам, требуется авторизованный пользователь.',
      )
      return
    }

    if (teams.some((team) => team.id === trimmedTeamId)) {
      snackbar.error('Вы уже состоите в этой команде')
      return
    }

    setIsJoiningTeam(true)

    try {
      const { json: teamJson } = await requestApiJson(
        `${CABINET_TEAMS_ENTITY_API_BASE}/${trimmedTeamId}`,
        {
          fallbackMessage: 'Команда не найдена',
        },
      )

      const rawOpen = teamJson?.data?.open
      const isTeamOpen =
        rawOpen === true ||
        rawOpen === 'true' ||
        rawOpen === 1 ||
        rawOpen === '1'

      if (!isTeamOpen) {
        throw new Error(
          'В этой команде закрыт набор. Попросите капитана добавить вас вручную.',
        )
      }

      await requestApiJson(CABINET_TEAM_MEMBERS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: trimmedTeamId, role: 'participant' }),
        fallbackMessage: 'Не удалось присоединиться к команде',
      })

      const [freshTeam] = await fetchTeamsSnapshot([trimmedTeamId])

      if (!freshTeam) {
        throw new Error(
          'Вы вступили в команду, но не удалось обновить список. Обновите страницу.',
        )
      }

      setTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ]),
      )
      setPersistedTeams((prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== freshTeam.id),
          freshTeam,
        ]),
      )
      setSelectedTeamId(freshTeam.id)

      setIsJoinModalOpen(false)
      setJoinTeamId('')
      snackbar.success(
        `Вы присоединились к команде «${freshTeam.name || 'без названия'}».`,
      )
    } catch (error) {
      console.error('Failed to join team', error)
      snackbar.error(error?.message || 'Не удалось присоединиться к команде')
    } finally {
      setIsJoiningTeam(false)
    }
  }, [
    canUseSelfServiceTeamsActions,
    currentTelegramIdNumber,
    currentUserId,
    fetchTeamsSnapshot,
    isTeamsLimitReached,
    joinTeamId,
    snackbar,
    sortTeamsByUpdatedAt,
    teams,
  ])

  const handleSaveTeam = useCallback(async () => {
    if (!selectedTeam || !canManageSelectedTeam) {
      return
    }

    setIsSaving(true)

    try {
      const { json } = await requestApiJson(
        `${CABINET_TEAMS_ENTITY_API_BASE}/${selectedTeam.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: buildTeamUpdatePayload(selectedTeam) }),
          fallbackMessage: 'Не удалось сохранить команду',
        },
      )

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
          team.id === selectedTeamId ? updatedTeam : team,
        ),
      )
      setPersistedTeams((prevTeams) =>
        prevTeams.map((team) =>
          team.id === selectedTeamId ? updatedTeam : team,
        ),
      )
      snackbar.success('Изменения сохранены')
      setIsEditModalOpen(false)
    } catch (error) {
      console.error('Failed to update team', error)
      snackbar.error(error?.message || 'Не удалось сохранить команду')
    } finally {
      setIsSaving(false)
    }
  }, [canManageSelectedTeam, selectedTeam, selectedTeamId, snackbar])

  const handleModalPrimaryAction = useCallback(() => {
    if (isSaving) {
      return
    }

    if (isDirty && canManageSelectedTeam) {
      handleSaveTeam()
    } else {
      handleCloseEditModal()
    }
  }, [
    canManageSelectedTeam,
    handleCloseEditModal,
    handleSaveTeam,
    isDirty,
    isSaving,
  ])

  const handleRemoveMember = useCallback(
    async (memberId) => {
      if (!selectedTeam || !canManageSelectedTeam) {
        return
      }

      const member = selectedTeam.members.find((item) => item.id === memberId)
      if (!member) {
        return
      }

      if (member.isCaptain) {
        snackbar.error(
          'Нельзя удалить капитана команды. Назначьте нового капитана и повторите действие.',
        )
        return
      }

      setMemberActionId(memberId)

      try {
        await requestApiJson(`${CABINET_TEAM_MEMBERS_API_BASE}/${memberId}`, {
          method: 'DELETE',
          fallbackMessage: 'Не удалось удалить участника',
        })

        const updatedMembers = (selectedTeam.members ?? []).filter(
          (item) => item.id !== memberId,
        )
        const updatedTeam = {
          ...selectedTeam,
          members: updatedMembers,
          membersCount: updatedMembers.length,
          captain: updatedMembers.find((item) => item.isCaptain) ?? null,
        }

        setTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team,
          ),
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team,
          ),
        )

        snackbar.success(
          `Участник «${member.name || 'Без имени'}» удалён из команды`,
        )
      } catch (error) {
        console.error('Failed to remove team member', error)
        snackbar.error(error?.message || 'Не удалось удалить участника')
      } finally {
        setMemberActionId(null)
      }
    },
    [canManageSelectedTeam, selectedTeam, selectedTeamId, snackbar],
  )

  const handleSetCaptain = useCallback(
    async (memberId) => {
      if (!selectedTeam || !canManageSelectedTeam) {
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
          fetch(`${CABINET_TEAM_MEMBERS_API_BASE}/${memberId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { role: 'captain' } }),
          }),
        ]

        if (currentCaptain) {
          requests.push(
            fetch(`${CABINET_TEAM_MEMBERS_API_BASE}/${currentCaptain.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: { role: 'participant' } }),
            }),
          )
        }

        const responses = await Promise.all(requests)
        const payloads = await Promise.all(responses.map((res) => res.json()))

        responses.forEach((res, index) => {
          if (!res.ok || payloads[index]?.success === false) {
            throw new Error(
              payloads[index]?.error || 'Не удалось обновить роль участника',
            )
          }
        })

        const updatedMembers = (selectedTeam.members ?? []).map((item) => {
          if (item.id === memberId) {
            return { ...item, role: 'captain', isCaptain: true }
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
            team.id === selectedTeamId ? updatedTeam : team,
          ),
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team,
          ),
        )

        snackbar.success(
          `«${member.name || 'Участник'}» назначен капитаном команды`,
        )
      } catch (error) {
        console.error('Failed to promote team member', error)
        snackbar.error(error?.message || 'Не удалось изменить роль участника')
      } finally {
        setMemberActionId(null)
      }
    },
    [canManageSelectedTeam, selectedTeam, selectedTeamId, snackbar],
  )

  const handleAddMember = useCallback(
    async (userId, userOption) => {
      if (!selectedTeam || !canManageSelectedTeam || !userId) {
        return
      }

      setIsAddingMember(true)

      try {
        const { json } = await requestApiJson(CABINET_TEAM_MEMBERS_API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              teamId: selectedTeam.id,
              targetUserId: userId,
              role: 'participant',
            },
          }),
          fallbackMessage: 'Не удалось добавить участника',
        })

        const newMember = json?.data?.member
          ? {
              id: String(json.data.member.id),
              userId: String(
                json.data.member.userId || json.data.member.id || '',
              ),
              telegramId: normalizeTelegramId(json.data.member.telegramId),
              name: json.data.member.name || userOption?.title || 'Без имени',
              username: json.data.member.username || null,
              phone: null,
              userRole: null,
              role: 'participant',
              isCaptain: false,
              hasLinkedUser: true,
            }
          : null

        const patchTeam = (team) => {
          const updatedMembers = newMember
            ? [...(team.members ?? []), newMember]
            : team.members ?? []
          return {
            ...team,
            members: updatedMembers,
            membersCount: updatedMembers.length,
            captain: updatedMembers.find((item) => item.isCaptain) ?? null,
          }
        }

        setTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? patchTeam(team) : team,
          ),
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? patchTeam(team) : team,
          ),
        )

        snackbar.success(
          `«${userOption?.title || 'Участник'}» добавлен в команду`,
        )
      } catch (error) {
        console.error('Failed to add team member', error)
        snackbar.error(error?.message || 'Не удалось добавить участника')
      } finally {
        setIsAddingMember(false)
      }
    },
    [canManageSelectedTeam, selectedTeam, selectedTeamId, snackbar],
  )

  const teamRestrictionMessage = useMemo(() => {
    if (!selectedTeam || canManageSelectedTeam) {
      return null
    }

    if (selectedTeam.captain && selectedTeam.captain.userId === currentUserId) {
      return null
    }

    return 'Изменять данные может только администратор или капитан команды. Вы можете просматривать информацию.'
  }, [canManageSelectedTeam, currentUserId, selectedTeam])

  const isCreateActionDisabled =
    isCreatingTeam ||
    !canUseSelfServiceTeamsActions ||
    newTeamName.trim().length === 0

  const isJoinActionDisabled =
    isJoiningTeam ||
    !canUseSelfServiceTeamsActions ||
    joinTeamId.trim().length === 0

  const teamsForList = useMemo(() => {
    if (!Array.isArray(visibleTeams)) {
      return []
    }

    return visibleTeams.map((team) => {
      const isCaptainForCurrentUser = (team.members ?? []).some(
        (member) =>
          member.isCaptain &&
          ((currentUserId && member.userId === currentUserId) ||
            (currentTelegramId && member.telegramId === currentTelegramId)),
      )

      const canManageTeam = isAdmin || isCaptainForCurrentUser

      return {
        id: team.id,
        name: team.name || 'Без названия',
        image: team.image || '',
        membersCount: getNounUsers(team.membersCount ?? 0),
        gamesCount: team.gamesCount ?? 0,
        ratingBadge: resolveRatingBadge(team.rating),
        open: Boolean(team.open),
        canManage: canManageTeam,
        isCaptain: isCaptainForCurrentUser,
      }
    })
  }, [currentTelegramId, currentUserId, isAdmin, visibleTeams])

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
      const team = visibleTeams.find((item) => item.id === teamId)

      if (!team) {
        return
      }

      const canManageTeam =
        isAdmin ||
        (team.members ?? []).some(
          (member) =>
            member.isCaptain && member.userId === (currentUserId ?? ''),
        )

      if (!canManageTeam) {
        return
      }

      setSelectedTeamId(teamId)
      closeTeamDescriptionModal()
      setIsEditModalOpen(true)
    },
    [closeTeamDescriptionModal, currentUserId, isAdmin, visibleTeams],
  )

  useEffect(() => {
    const teamIdFromQuery = searchParams?.get('teamId')
    const modeFromQuery = searchParams?.get('mode')

    if (typeof teamIdFromQuery !== 'string' || teamIdFromQuery.length === 0) {
      return
    }

    const team = visibleTeams.find((item) => item.id === teamIdFromQuery)
    if (!team) {
      return
    }

    setSelectedTeamId(teamIdFromQuery)

    if (modeFromQuery === 'edit') {
      const canManageTeam =
        isAdmin ||
        (team.members ?? []).some(
          (member) =>
            member.isCaptain && member.userId === (currentUserId ?? ''),
        )

      if (canManageTeam) {
        setIsTeamDescriptionModalOpen(false)
        setIsEditModalOpen(true)
      } else {
        setIsEditModalOpen(false)
        setIsTeamDescriptionModalOpen(true)
      }
    } else {
      setIsEditModalOpen(false)
      setIsTeamDescriptionModalOpen(true)
    }

    const nextParams = new URLSearchParams(searchParams?.toString() || '')
    nextParams.delete('teamId')
    nextParams.delete('mode')
    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname
    router.replace(nextUrl, { scroll: false })
  }, [currentUserId, isAdmin, pathname, router, searchParams, visibleTeams])

  const handleLeaveSelectedTeam = useCallback(async () => {
    if (
      !selectedTeam ||
      !selectedTeamCurrentMember ||
      selectedTeamCurrentMember.isCaptain
    ) {
      return
    }

    const confirmed = window.confirm('Вы уверены, что хотите выйти из команды?')
    if (!confirmed) {
      return
    }

    setIsLeavingTeam(true)

    try {
      await requestApiJson(
        `${CABINET_TEAM_MEMBERS_API_BASE}/${selectedTeamCurrentMember.id}`,
        {
          method: 'DELETE',
          fallbackMessage: 'Не удалось выйти из команды',
        },
      )

      setTeams((prevTeams) =>
        prevTeams.filter((team) => team.id !== selectedTeam.id),
      )
      setPersistedTeams((prevTeams) =>
        prevTeams.filter((team) => team.id !== selectedTeam.id),
      )
      closeTeamDescriptionModal()

      snackbar.success('Вы вышли из команды')
    } catch (error) {
      console.error('Failed to leave team', error)
      snackbar.error(error?.message || 'Не удалось выйти из команды')
    } finally {
      setIsLeavingTeam(false)
    }
  }, [
    closeTeamDescriptionModal,
    selectedTeam,
    selectedTeamCurrentMember,
    snackbar,
  ])

  const handleDeleteSelectedTeam = useCallback(async () => {
    if (!selectedTeam || !canDeleteSelectedTeam || isDeletingTeam) {
      return
    }

    const playedGamesCount = Number(selectedTeam.gamesCount) || 0
    const lossWarning =
      playedGamesCount > 0
        ? `\n\nКомандой сыграно игр: ${playedGamesCount}.\nУдаление команды может повлиять на рейтинг команды и участников.`
        : '\n\nКоманда пока не имеет сыгранных игр.'

    const isConfirmed = window.confirm(
      `Удалить команду «${selectedTeam.name || 'Без названия'}»?${lossWarning}\n\nДействие необратимо.`,
    )
    if (!isConfirmed) {
      return
    }

    setIsDeletingTeam(true)

    try {
      await requestApiJson(
        `${CABINET_TEAMS_ENTITY_API_BASE}/${selectedTeam.id}`,
        {
          method: 'DELETE',
          fallbackMessage: 'Не удалось удалить команду',
        },
      )

      const deletedTeamId = selectedTeam.id
      setTeams((prevTeams) =>
        prevTeams.filter((team) => team.id !== deletedTeamId),
      )
      setPersistedTeams((prevTeams) =>
        prevTeams.filter((team) => team.id !== deletedTeamId),
      )
      setSelectedTeamId((prevSelectedTeamId) =>
        prevSelectedTeamId === deletedTeamId ? null : prevSelectedTeamId,
      )
      setIsEditModalOpen(false)
      setIsTeamDescriptionModalOpen(false)

      snackbar.success('Команда удалена')
    } catch (error) {
      console.error('Failed to delete team', error)
      snackbar.error(error?.message || 'Не удалось удалить команду')
    } finally {
      setIsDeletingTeam(false)
    }
  }, [canDeleteSelectedTeam, isDeletingTeam, selectedTeam, snackbar])

  return (
    <>
      <CabinetLayout
        title="Мои команды"
        description="Следите за составом, назначайте капитанов и контролируйте участие в играх."
        activePage="teams"
      >
        {selectedTeam && teamRestrictionMessage ? (
          <div className="mb-6 space-y-4">
            {teamRestrictionMessage && (
              <NoticeBanner tone="warning" variant="neon">
                {teamRestrictionMessage}
              </NoticeBanner>
            )}
          </div>
        ) : null}

        <section className="grid gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                disabled={!canUseSelfServiceTeamsActions}
                title={
                  canUseSelfServiceTeamsActions
                    ? undefined
                    : isTeamsLimitReached
                      ? `Достигнут лимит: не более ${MAX_TEAMS_PER_USER} команд`
                      : 'Функция доступна после авторизации'
                }
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                  canUseSelfServiceTeamsActions
                    ? 'cursor-pointer bg-primary text-white hover:bg-blue-700'
                    : 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                Создать команду
              </button>
              <button
                type="button"
                onClick={handleOpenJoinModal}
                disabled={!canUseSelfServiceTeamsActions}
                title={
                  canUseSelfServiceTeamsActions
                    ? undefined
                    : isTeamsLimitReached
                      ? `Достигнут лимит: не более ${MAX_TEAMS_PER_USER} команд`
                      : 'Функция доступна после авторизации'
                }
                className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                  canUseSelfServiceTeamsActions
                    ? 'cursor-pointer border-primary bg-white text-primary shadow-sm hover:border-blue-500 hover:bg-blue-50 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-blue-400 dark:hover:bg-blue-500/10'
                    : 'border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                Присоединиться по id
              </button>
            </div>
            {isTeamsLimitReached && (
              <NoticeBanner tone="warning" variant="neon">
                Достигнут лимит команд: один игрок может состоять максимум в{' '}
                {MAX_TEAMS_PER_USER} командах.
              </NoticeBanner>
            )}

            {teamsForList.length > 0 ? (
              <ul className="space-y-3">
                {teamsForList.map((team) => {
                  return (
                    <li key={team.id}>
                      <SelectableCard
                        role="button"
                        tabIndex={0}
                        onClick={() => handleTeamCardClick(team)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleTeamCardClick(team)
                          }
                        }}
                        className="w-full text-left cursor-pointer"
                        aria-pressed={false}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex flex-1 items-start gap-3">
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
                              <img
                                src={team.image || '/img/avatars/team.png'}
                                alt={`Иконка команды ${team.name}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {team.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {team.ratingBadge ? (
                              <span className="text-xs font-medium px-2 py-1 rounded-full border border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                {team.ratingBadge}
                              </span>
                            ) : null}
                            {team.isCaptain && (
                              <span className="text-xs font-medium px-2 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/45 dark:bg-amber-500/10 dark:text-amber-200">
                                Капитан
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center justify-center text-xs font-medium rounded-full ${
                                team.open
                                  ? 'h-7 w-7 border border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]'
                                  : 'border border-violet-300 bg-violet-100 text-violet-700 dark:border-[#7A00FF]/35 dark:bg-[#7A00FF]/12 dark:text-[#d9c8ff]'
                              }`}
                              title={team.open ? 'Открыта' : 'Закрыта'}
                            >
                              {team.open ? <OpenDoorIcon /> : 'Закрыта'}
                            </span>
                            {team.canManage && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleEditTeamFromList(team.id)
                                }}
                                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-cyan-300 text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-[#00D1FF]/35 dark:text-[#b3ecff] dark:hover:border-[#00D1FF]/65 dark:hover:bg-[#00D1FF]/10 dark:hover:text-[#e1f8ff] dark:focus:ring-[#00D1FF]/40 dark:focus:ring-offset-[#110221]"
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
                          Игр: {team.gamesCount}
                        </p>
                      </SelectableCard>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center bg-white dark:bg-slate-900/80 border shadow-sm text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-2xl">
                У вас пока нет команд. Нажмите «Создать команду», чтобы
                сформировать новую, или используйте кнопку вступления, если
                знаете id команды.
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
          onAddMember={handleAddMember}
          isAddingMember={isAddingMember}
          canDeleteTeam={canDeleteSelectedTeam}
          isDeletingTeam={isDeletingTeam}
          onDeleteTeam={handleDeleteSelectedTeam}
          locationOptions={locationOptions}
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
          newTeamImage={newTeamImage}
          onChangeNewTeamImage={setNewTeamImage}
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
          canUseSelfServiceTeams={canUseSelfServiceTeamsActions}
        />
        <TeamDescriptionModal
          isOpen={isTeamDescriptionModalOpen}
          onClose={closeTeamDescriptionModal}
          selectedTeam={selectedTeam}
          canLeaveTeam={canLeaveSelectedTeam}
          isLeavingTeam={isLeavingTeam}
          onLeaveTeam={handleLeaveSelectedTeam}
          onOpenMember={handleOpenTeamMemberProfile}
        />
        <UserViewModal
          userId={selectedMemberUserId}
          telegramId={selectedMemberTelegramId}
          isOpen={isMemberViewModalOpen}
          onClose={closeMemberViewModal}
          canViewContacts={isAdmin}
        />
      </CabinetLayout>
    </>
  )
}

const teamMemberShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  userId: PropTypes.string,
  telegramId: PropTypes.string,
  name: PropTypes.string,
  username: PropTypes.string,
  phone: PropTypes.string,
  role: PropTypes.string,
  isCaptain: PropTypes.bool,
  userRole: PropTypes.string,
  hasLinkedUser: PropTypes.bool,
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
      image: PropTypes.string,
      open: PropTypes.bool,
      location: PropTypes.string,
      members: PropTypes.arrayOf(teamMemberShape),
      membersCount: PropTypes.number,
      captain: teamMemberShape,
      games: PropTypes.arrayOf(teamGameShape),
      gamesCount: PropTypes.number,
      rating: PropTypes.shape({
        isEligible: PropTypes.bool,
        rank: PropTypes.number,
        totalRanked: PropTypes.number,
        playersAbove: PropTypes.number,
        finalScore: PropTypes.number,
        playedGames: PropTypes.number,
        missedGames: PropTypes.number,
        updatedAt: PropTypes.string,
      }),
      createdAt: PropTypes.string,
      updatedAt: PropTypes.string,
    }),
  ),
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

TeamsPage.defaultProps = {
  initialTeams: [],
  initialLocation: null,
  session: null,
}

export default TeamsPage
