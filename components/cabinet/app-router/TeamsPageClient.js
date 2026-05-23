'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import SelectableCard from '@components/cabinet/SelectableCard'
import NoticeBanner from '@components/NoticeBanner'
import TeamCreateModal from '@components/modals/TeamCreateModal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import TeamEditModal from '@components/modals/TeamEditModal'
import TeamJoinModal from '@components/modals/TeamJoinModal'
import UserViewModal from '@components/cabinet/modals/UserViewModal'
import requestApiJson from '@helpers/requestApiJson'
import { getNounUsers } from '@helpers/getNoun'
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

const TeamsPage = ({
  initialTeams,
  session: initialSession,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const safeInitialTeams = Array.isArray(initialTeams) ? initialTeams : []
  const { activeSession } = useMergedSession(initialSession)
  const { effectiveRole: userRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const currentUserIdRaw =
    activeSession?.user?.globalUserId ??
    activeSession?.user?.userId ??
    activeSession?.user?._id ??
    activeSession?.user?.id ??
    null
  const currentUserId =
    currentUserIdRaw === null || currentUserIdRaw === undefined
      ? null
      : String(currentUserIdRaw).trim() || null

  const [teams, setTeams] = useState(safeInitialTeams)
  const [persistedTeams, setPersistedTeams] = useState(safeInitialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(
    safeInitialTeams[0]?.id ?? null,
  )
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [newTeamImage, setNewTeamImage] = useState('')
  const [newTeamOpen, setNewTeamOpen] = useState(true)
  const [joinTeamId, setJoinTeamId] = useState('')
  const [isTeamIdCopied, setIsTeamIdCopied] = useState(false)
  const copyTimeoutRef = useRef(null)
  const [isTeamDescriptionModalOpen, setIsTeamDescriptionModalOpen] =
    useState(false)
  const [isMemberViewModalOpen, setIsMemberViewModalOpen] = useState(false)
  const [selectedMemberUserId, setSelectedMemberUserId] = useState(null)
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

      if (!currentUserId) {
        return []
      }

      return items.filter((team) =>
        (team?.members ?? []).some((member) => {
          const memberUserId =
            typeof member?.userId === 'string' ? member.userId : null

          if (currentUserId && memberUserId === currentUserId) {
            return true
          }

          return false
        }),
      )
    },
    [currentUserId],
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
    if (!selectedTeam || !currentUserId) {
      return false
    }

    return selectedTeam.members?.some(
      (member) =>
        member.isCaptain && currentUserId && member.userId === currentUserId,
    )
  }, [currentUserId, selectedTeam])

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

        return false
      }) ?? null
    )
  }, [currentUserId, selectedTeam])

  const canLeaveSelectedTeam =
    Boolean(selectedTeamCurrentMember) && !selectedTeamCurrentMember.isCaptain
  const canDeleteSelectedTeam = Boolean(selectedTeam && isTeamCaptain)
  const canUseSelfServiceTeams = Boolean(
    currentUserId,
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

  const upsertPersistedTeam = useCallback(
    (team) => {
      if (!team?.id) {
        return
      }

      const upsert = (prev) =>
        sortTeamsByUpdatedAt([
          ...prev.filter((item) => item.id !== team.id),
          team,
        ])

      setTeams(upsert)
      setPersistedTeams(upsert)
      setSelectedTeamId(team.id)
    },
    [sortTeamsByUpdatedAt],
  )

  const updatePersistedTeam = useCallback((teamId, updater) => {
    const applyUpdate = (team) => {
      if (team.id !== teamId) {
        return team
      }

      return typeof updater === 'function' ? updater(team) : updater
    }

    setTeams((prevTeams) => prevTeams.map(applyUpdate))
    setPersistedTeams((prevTeams) => prevTeams.map(applyUpdate))
  }, [])

  const removePersistedTeam = useCallback((teamId) => {
    setTeams((prevTeams) => prevTeams.filter((team) => team.id !== teamId))
    setPersistedTeams((prevTeams) =>
      prevTeams.filter((team) => team.id !== teamId),
    )
    setSelectedTeamId((prevSelectedTeamId) =>
      prevSelectedTeamId === teamId ? null : prevSelectedTeamId,
    )
  }, [])

  const createTeamMutation = useMutation({
    mutationFn: async ({ name, description, image, open }) => {
      const createPayload = buildTeamUpdatePayload({
        name,
        description,
        image: image || null,
        open: Boolean(open),
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

      return { team: freshTeam, fallbackName: name }
    },
    onSuccess: ({ team, fallbackName }) => {
      upsertPersistedTeam(team)
      setIsCreateModalOpen(false)
      setNewTeamName('')
      setNewTeamDescription('')
      setNewTeamImage('')
      setNewTeamOpen(true)
      snackbar.success(
        `Команда «${team.name || fallbackName}» создана. Вы назначены капитаном.`,
      )
    },
    onError: (error) => {
      console.error('Failed to create team', error)
      snackbar.error(error?.message || 'Не удалось создать команду')
    },
  })

  const joinTeamMutation = useMutation({
    mutationFn: async (teamId) => {
      const { json: teamJson } = await requestApiJson(
        `${CABINET_TEAMS_ENTITY_API_BASE}/${teamId}`,
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
        body: JSON.stringify({ teamId, role: 'participant' }),
        fallbackMessage: 'Не удалось присоединиться к команде',
      })

      const [freshTeam] = await fetchTeamsSnapshot([teamId])
      if (!freshTeam) {
        throw new Error(
          'Вы вступили в команду, но не удалось обновить список. Обновите страницу.',
        )
      }

      return freshTeam
    },
    onSuccess: (team) => {
      upsertPersistedTeam(team)
      setIsJoinModalOpen(false)
      setJoinTeamId('')
      snackbar.success(
        `Вы присоединились к команде «${team.name || 'без названия'}».`,
      )
    },
    onError: (error) => {
      console.error('Failed to join team', error)
      snackbar.error(error?.message || 'Не удалось присоединиться к команде')
    },
  })

  const saveTeamMutation = useMutation({
    mutationFn: async (team) => {
      const { json } = await requestApiJson(
        `${CABINET_TEAMS_ENTITY_API_BASE}/${team.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: buildTeamUpdatePayload(team) }),
          fallbackMessage: 'Не удалось сохранить команду',
        },
      )

      return {
        ...team,
        name: json.data?.name ?? team.name,
        description: json.data?.description ?? team.description,
        open: Boolean(json.data?.open ?? team.open),
        updatedAt: json.data?.updatedAt
          ? new Date(json.data.updatedAt).toISOString()
          : team.updatedAt,
      }
    },
    onSuccess: (team) => {
      updatePersistedTeam(team.id, team)
      snackbar.success('Изменения сохранены')
      setIsEditModalOpen(false)
    },
    onError: (error) => {
      console.error('Failed to update team', error)
      snackbar.error(error?.message || 'Не удалось сохранить команду')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async ({ team, memberId }) => {
      await requestApiJson(`${CABINET_TEAM_MEMBERS_API_BASE}/${memberId}`, {
        method: 'DELETE',
        fallbackMessage: 'Не удалось удалить участника',
      })

      const updatedMembers = (team.members ?? []).filter(
        (item) => item.id !== memberId,
      )

      return {
        team: {
          ...team,
          members: updatedMembers,
          membersCount: updatedMembers.length,
          captain: updatedMembers.find((item) => item.isCaptain) ?? null,
          liaison:
            updatedMembers.find((item) => item.isLiaison) ??
            updatedMembers.find((item) => item.isCaptain) ??
            null,
        },
        member: (team.members ?? []).find((item) => item.id === memberId),
      }
    },
    onMutate: ({ memberId }) => {
      setMemberActionId(memberId)
    },
    onSuccess: ({ team, member }) => {
      updatePersistedTeam(team.id, team)
      snackbar.success(
        `Участник «${member?.name || 'Без имени'}» удалён из команды`,
      )
    },
    onError: (error) => {
      console.error('Failed to remove team member', error)
      snackbar.error(error?.message || 'Не удалось удалить участника')
    },
    onSettled: () => {
      setMemberActionId(null)
    },
  })

  const setCaptainMutation = useMutation({
    mutationFn: async ({ team, memberId }) => {
      const currentCaptain = (team.members ?? []).find((item) => item.isCaptain)

      await requestApiJson(`${CABINET_TEAM_MEMBERS_API_BASE}/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { role: 'captain' } }),
        fallbackMessage: 'Не удалось обновить роль участника',
      })

      const updatedMembers = (team.members ?? []).map((item) => {
        if (item.id === memberId) {
          return { ...item, role: 'captain', isCaptain: true, isLiaison: false }
        }

        if (item.id === currentCaptain?.id) {
          return { ...item, role: 'participant', isCaptain: false }
        }

        return item
      })

      return {
        team: {
          ...team,
          members: updatedMembers,
          captain: updatedMembers.find((item) => item.isCaptain) ?? null,
          liaison:
            updatedMembers.find((item) => item.isLiaison) ??
            updatedMembers.find((item) => item.isCaptain) ??
            null,
        },
        member: (team.members ?? []).find((item) => item.id === memberId),
      }
    },
    onMutate: ({ memberId }) => {
      setMemberActionId(memberId)
    },
    onSuccess: ({ team, member }) => {
      updatePersistedTeam(team.id, team)
      snackbar.success(
        `«${member?.name || 'Участник'}» назначен капитаном команды`,
      )
    },
    onError: (error) => {
      console.error('Failed to promote team member', error)
      snackbar.error(error?.message || 'Не удалось изменить роль участника')
    },
    onSettled: () => {
      setMemberActionId(null)
    },
  })

  const setLiaisonMutation = useMutation({
    mutationFn: async ({ team, memberId, role }) => {
      await requestApiJson(`${CABINET_TEAM_MEMBERS_API_BASE}/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { role } }),
        fallbackMessage: 'Не удалось обновить роль участника',
      })

      const updatedMembers = (team.members ?? []).map((item) => {
        if (role === 'liaison' && item.id === memberId) {
          return { ...item, role: 'liaison', isLiaison: true }
        }

        if (role === 'liaison' && item.isLiaison) {
          return { ...item, role: 'participant', isLiaison: false }
        }

        if (role === 'participant' && item.id === memberId) {
          return { ...item, role: 'participant', isLiaison: false }
        }

        return item
      })

      return {
        team: {
          ...team,
          members: updatedMembers,
          liaison:
            updatedMembers.find((item) => item.isLiaison) ??
            updatedMembers.find((item) => item.isCaptain) ??
            null,
        },
        member: (team.members ?? []).find((item) => item.id === memberId),
        role,
      }
    },
    onMutate: ({ memberId }) => {
      setMemberActionId(memberId)
    },
    onSuccess: ({ team, member, role }) => {
      updatePersistedTeam(team.id, team)
      snackbar.success(
        role === 'liaison'
          ? `«${member?.name || 'Участник'}» назначен связным команды`
          : `«${member?.name || 'Участник'}» теперь обычный участник команды`,
      )
    },
    onError: (error) => {
      console.error('Failed to update team liaison role', error)
      snackbar.error(error?.message || 'Не удалось изменить роль связного')
    },
    onSettled: () => {
      setMemberActionId(null)
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: async ({ team, userId, userOption }) => {
      const { json } = await requestApiJson(CABINET_TEAM_MEMBERS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            teamId: team.id,
            targetUserId: userId,
            role: 'participant',
          },
        }),
        fallbackMessage: 'Не удалось добавить участника',
      })

      const newMember = json?.data?.member
        ? {
            id: String(json.data.member.id),
            userId: String(json.data.member.userId || userId || ''),
            telegramId: '',
            name: json.data.member.name || userOption?.title || 'Без имени',
            username: json.data.member.username || null,
            phone: null,
            userRole: null,
            role: 'participant',
            isCaptain: false,
            isLiaison: false,
            hasLinkedUser: true,
          }
        : null

      const updatedMembers = newMember
        ? [...(team.members ?? []), newMember]
        : (team.members ?? [])

      return {
        team: {
          ...team,
          members: updatedMembers,
          membersCount: updatedMembers.length,
          captain: updatedMembers.find((item) => item.isCaptain) ?? null,
          liaison:
            updatedMembers.find((item) => item.isLiaison) ??
            updatedMembers.find((item) => item.isCaptain) ??
            null,
        },
        userTitle: userOption?.title || 'Участник',
      }
    },
    onSuccess: ({ team, userTitle }) => {
      updatePersistedTeam(team.id, team)
      snackbar.success(`«${userTitle}» добавлен в команду`)
    },
    onError: (error) => {
      console.error('Failed to add team member', error)
      snackbar.error(error?.message || 'Не удалось добавить участника')
    },
  })

  const leaveTeamMutation = useMutation({
    mutationFn: async ({ team, member }) => {
      await requestApiJson(`${CABINET_TEAM_MEMBERS_API_BASE}/${member.id}`, {
        method: 'DELETE',
        fallbackMessage: 'Не удалось выйти из команды',
      })

      return team.id
    },
    onSuccess: (teamId) => {
      removePersistedTeam(teamId)
      setIsTeamDescriptionModalOpen(false)
      snackbar.success('Вы вышли из команды')
    },
    onError: (error) => {
      console.error('Failed to leave team', error)
      snackbar.error(error?.message || 'Не удалось выйти из команды')
    },
  })

  const deleteTeamMutation = useMutation({
    mutationFn: async (team) => {
      await requestApiJson(`${CABINET_TEAMS_ENTITY_API_BASE}/${team.id}`, {
        method: 'DELETE',
        fallbackMessage: 'Не удалось удалить команду',
      })

      return team.id
    },
    onSuccess: (teamId) => {
      removePersistedTeam(teamId)
      setIsEditModalOpen(false)
      setIsTeamDescriptionModalOpen(false)
      snackbar.success('Команда удалена')
    },
    onError: (error) => {
      console.error('Failed to delete team', error)
      snackbar.error(error?.message || 'Не удалось удалить команду')
    },
  })

  const isSaving = saveTeamMutation.isPending
  const isAddingMember = addMemberMutation.isPending
  const isCreatingTeam = createTeamMutation.isPending
  const isJoiningTeam = joinTeamMutation.isPending
  const isLeavingTeam = leaveTeamMutation.isPending
  const isDeletingTeam = deleteTeamMutation.isPending

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

    if (!nextUserId) {
      return
    }

    setSelectedMemberUserId(nextUserId)
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

    if (!currentUserId) {
      snackbar.error(
        'Чтобы управлять командами, требуется авторизованный пользователь.',
      )
      return
    }

    createTeamMutation.mutate({
      name: trimmedName,
      description: trimmedDescription,
      image: newTeamImage,
      open: newTeamOpen,
    })
  }, [
    canUseSelfServiceTeamsActions,
    createTeamMutation,
    currentUserId,
    isTeamsLimitReached,
    newTeamDescription,
    newTeamImage,
    newTeamName,
    newTeamOpen,
    snackbar,
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

    if (!currentUserId) {
      snackbar.error(
        'Чтобы присоединяться к командам, требуется авторизованный пользователь.',
      )
      return
    }

    if (teams.some((team) => team.id === trimmedTeamId)) {
      snackbar.error('Вы уже состоите в этой команде')
      return
    }

    joinTeamMutation.mutate(trimmedTeamId)
  }, [
    canUseSelfServiceTeamsActions,
    currentUserId,
    isTeamsLimitReached,
    joinTeamId,
    joinTeamMutation,
    snackbar,
    teams,
  ])

  const handleSaveTeam = useCallback(async () => {
    if (!selectedTeam || !canManageSelectedTeam) {
      return
    }

    saveTeamMutation.mutate(selectedTeam)
  }, [canManageSelectedTeam, saveTeamMutation, selectedTeam])

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

      removeMemberMutation.mutate({ team: selectedTeam, memberId })
    },
    [canManageSelectedTeam, removeMemberMutation, selectedTeam, snackbar],
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

      setCaptainMutation.mutate({ team: selectedTeam, memberId })
    },
    [canManageSelectedTeam, selectedTeam, setCaptainMutation],
  )

  const handleSetLiaison = useCallback(
    (memberId) => {
      if (!canManageSelectedTeam || !selectedTeam) {
        snackbar.error('Недостаточно прав для изменения роли связного')
        return
      }

      setLiaisonMutation.mutate({ team: selectedTeam, memberId, role: 'liaison' })
    },
    [canManageSelectedTeam, selectedTeam, setLiaisonMutation, snackbar],
  )

  const handleUnsetLiaison = useCallback(
    (memberId) => {
      if (!canManageSelectedTeam || !selectedTeam) {
        snackbar.error('Недостаточно прав для изменения роли связного')
        return
      }

      setLiaisonMutation.mutate({
        team: selectedTeam,
        memberId,
        role: 'participant',
      })
    },
    [canManageSelectedTeam, selectedTeam, setLiaisonMutation, snackbar],
  )

  const handleAddMember = useCallback(
    async (userId, userOption) => {
      if (!selectedTeam || !canManageSelectedTeam || !userId) {
        return
      }

      addMemberMutation.mutate({ team: selectedTeam, userId, userOption })
    },
    [addMemberMutation, canManageSelectedTeam, selectedTeam],
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
          currentUserId &&
          member.userId === currentUserId,
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
  }, [currentUserId, isAdmin, visibleTeams])

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

    leaveTeamMutation.mutate({
      team: selectedTeam,
      member: selectedTeamCurrentMember,
    })
  }, [
    leaveTeamMutation,
    selectedTeam,
    selectedTeamCurrentMember,
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

    deleteTeamMutation.mutate(selectedTeam)
  }, [canDeleteSelectedTeam, deleteTeamMutation, isDeletingTeam, selectedTeam])

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
          onSetLiaison={handleSetLiaison}
          onUnsetLiaison={handleUnsetLiaison}
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
          isOpen={isMemberViewModalOpen}
          onClose={closeMemberViewModal}
          canViewContacts
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
  isLiaison: PropTypes.bool,
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
      liaison: teamMemberShape,
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
