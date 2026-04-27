'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CardActionIconButton, {
  EditCardIcon,
} from '@components/cabinet/CardActionIconButton'
import UserTeamCard from '@components/cabinet/cards/UserTeamCard'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'
import TeamEditModal from '@components/modals/TeamEditModal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import { getNounUsers } from '@helpers/getNoun'
import isUserAdmin from '@helpers/isUserAdmin'
import requestApiJson from '@helpers/requestApiJson'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import { normalizeTeamCarSkin } from '@helpers/teamCarSkins'
import { LOCATIONS } from '@server/serverConstants'

const TEAMS_PAGE_SIZE = 10
const CABINET_ADMIN_API_BASE = '/api/cabinet/admin'

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
    carSkin: normalizeTeamCarSkin(team.carSkin),
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
    carSkin: normalizeTeamCarSkin(team.carSkin),
    location: team.location ?? '',
  }
}

const buildAdminTeamsQueryKey = ({ searchQuery, visibilityFilter, locationFilter, sortBy }) => [
  'admin-teams',
  {
    search: searchQuery || '',
    visibility: visibilityFilter || 'all',
    location: locationFilter || 'all',
    sortBy: sortBy || 'registration_desc',
  },
]

const fetchAdminTeamsPage = async ({
  pageParam = 0,
  searchQuery,
  visibilityFilter,
  locationFilter,
  sortBy,
}) => {
  const params = new URLSearchParams({
    offset: String(pageParam),
    limit: String(TEAMS_PAGE_SIZE),
    sortBy,
  })
  if (searchQuery) {
    params.set('search', searchQuery)
  }
  if (visibilityFilter && visibilityFilter !== 'all') {
    params.set('visibility', visibilityFilter)
  }
  if (locationFilter && locationFilter !== 'all') {
    params.set('location', locationFilter)
  }

  const { json } = await requestApiJson(
    `${CABINET_ADMIN_API_BASE}/teams-list?${params.toString()}`,
    {
      fallbackMessage: 'Не удалось загрузить команды',
    },
  )

  return {
    teams: Array.isArray(json?.data) ? json.data : [],
    hasMore: Boolean(json?.meta?.hasMore),
  }
}

const mapAdminTeamsQueryData = (queryData, mapper) => {
  if (!queryData || !Array.isArray(queryData.pages)) {
    return queryData
  }

  return {
    ...queryData,
    pages: queryData.pages.map((page) => ({
      ...page,
      teams: Array.isArray(page?.teams) ? page.teams.map(mapper) : [],
    })),
  }
}

const filterAdminTeamsQueryData = (queryData, predicate) => {
  if (!queryData || !Array.isArray(queryData.pages)) {
    return queryData
  }

  return {
    ...queryData,
    pages: queryData.pages.map((page) => ({
      ...page,
      teams: Array.isArray(page?.teams) ? page.teams.filter(predicate) : [],
    })),
  }
}

const saveAdminTeam = async (team) => {
  const { json } = await requestApiJson(`/api/cabinet/teams/${team.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: buildTeamUpdatePayload(team) }),
    fallbackMessage: 'Не удалось сохранить команду',
  })

  return {
    ...team,
    name: json.data?.name ?? team.name,
    description: json.data?.description ?? team.description,
    open: Boolean(json.data?.open ?? team.open),
    updatedAt: json.data?.updatedAt
      ? new Date(json.data.updatedAt).toISOString()
      : team.updatedAt,
  }
}

const deleteAdminTeam = async (team) => {
  await requestApiJson(`/api/cabinet/teams/${team.id}`, {
    method: 'DELETE',
    fallbackMessage: 'Не удалось удалить команду',
  })

  return {
    teamId: team.id,
    teamName: team.name || 'Без названия',
  }
}

const removeAdminTeamMember = async ({ team, memberId }) => {
  await requestApiJson(`/api/cabinet/teams/members/${memberId}`, {
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
    },
    member: (team.members ?? []).find((item) => item.id === memberId) ?? null,
  }
}

const setAdminTeamCaptain = async ({ team, memberId }) => {
  const currentCaptain = (team.members ?? []).find((item) => item.isCaptain)

  await Promise.all([
    requestApiJson(`/api/cabinet/teams/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { role: 'captain' } }),
      fallbackMessage: 'Не удалось обновить роль участника',
    }),
    currentCaptain
      ? requestApiJson(`/api/cabinet/teams/members/${currentCaptain.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { role: 'participant' } }),
          fallbackMessage: 'Не удалось обновить роль участника',
        })
      : Promise.resolve(null),
  ])

  const updatedMembers = (team.members ?? []).map((item) => {
    if (item.id === memberId) {
      return { ...item, role: 'captain', isCaptain: true }
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
    },
    member: (team.members ?? []).find((item) => item.id === memberId) ?? null,
  }
}

const addAdminTeamMember = async ({ team, userId, userOption }) => {
  const { json } = await requestApiJson('/api/cabinet/teams/members', {
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
        name: json.data.member.name || userOption?.title || 'Без имени',
        username: json.data.member.username || null,
        phone: null,
        userRole: null,
        hasLinkedUser: true,
        isCaptain: false,
      }
    : null

  const updatedMembers = newMember
    ? [...(team.members ?? []), newMember]
    : team.members

  return {
    team: {
      ...team,
      members: updatedMembers,
      membersCount: (updatedMembers ?? team.members ?? []).length,
    },
    userTitle: userOption?.title || 'Участник',
  }
}

const AdminTeamsPage = ({
  initialTeams,
  initialHasMore,
  session: initialSession,
}) => {
  const safeInitialTeams = Array.isArray(initialTeams) ? initialTeams : []
  const queryClient = useQueryClient()
  const { activeSession } = useMergedSession(initialSession)
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const isAdmin = isUserAdmin({ role: effectiveRole })

  const [teams, setTeams] = useState(safeInitialTeams)
  const [persistedTeams, setPersistedTeams] = useState(safeInitialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(
    safeInitialTeams[0]?.id ?? null,
  )
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [sortBy, setSortBy] = useState('registration_desc')
  const [feedback, setFeedback] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)
  const [isTeamIdCopied, setIsTeamIdCopied] = useState(false)
  const [isTeamDescriptionModalOpen, setIsTeamDescriptionModalOpen] =
    useState(false)
  const copyTimeoutRef = useRef(null)
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
  const locationFilterOptions = useMemo(
    () => [{ value: 'all', label: 'Все города' }, ...locationOptions],
    [locationOptions],
  )
  const isDefaultTeamsQuery =
    !searchQuery &&
    visibilityFilter === 'all' &&
    locationFilter === 'all' &&
    sortBy === 'registration_desc'
  const teamsQuery = useInfiniteQuery({
    queryKey: buildAdminTeamsQueryKey({
      searchQuery,
      visibilityFilter,
      locationFilter,
      sortBy,
    }),
    queryFn: ({ pageParam }) =>
      fetchAdminTeamsPage({
        pageParam,
        searchQuery,
        visibilityFilter,
        locationFilter,
        sortBy,
      }),
    enabled: isAdmin,
    initialPageParam: 0,
    initialData: isDefaultTeamsQuery
      ? {
          pages: [
            {
              teams: safeInitialTeams,
              hasMore: Boolean(initialHasMore),
            },
          ],
          pageParams: [0],
        }
      : undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined
      return allPages.reduce(
        (total, page) =>
          total + (Array.isArray(page?.teams) ? page.teams.length : 0),
        0,
      )
    },
  })
  const hasMoreTeams = Boolean(teamsQuery.hasNextPage)
  const isLoadingMoreTeams = teamsQuery.isFetchingNextPage
  const isSearchingTeams = teamsQuery.isFetching && !teamsQuery.isFetchingNextPage

  const applyPersistedTeamUpdate = useCallback(
    (teamId, updater) => {
      const applyUpdate = (team) => {
        if (team.id !== teamId) {
          return team
        }

        return typeof updater === 'function' ? updater(team) : updater
      }

      setTeams((prevTeams) => prevTeams.map(applyUpdate))
      setPersistedTeams((prevTeams) => prevTeams.map(applyUpdate))
      queryClient.setQueriesData({ queryKey: ['admin-teams'] }, (queryData) =>
        mapAdminTeamsQueryData(queryData, applyUpdate),
      )
    },
    [queryClient],
  )

  const removePersistedTeam = useCallback(
    (teamId) => {
      const keepOtherTeams = (team) => team.id !== teamId

      setTeams((prevTeams) => prevTeams.filter(keepOtherTeams))
      setPersistedTeams((prevTeams) => prevTeams.filter(keepOtherTeams))
      queryClient.setQueriesData({ queryKey: ['admin-teams'] }, (queryData) =>
        filterAdminTeamsQueryData(queryData, keepOtherTeams),
      )
    },
    [queryClient],
  )

  const saveTeamMutation = useMutation({
    mutationFn: saveAdminTeam,
    onMutate: () => {
      setFeedback(null)
    },
    onSuccess: (updatedTeam) => {
      applyPersistedTeamUpdate(updatedTeam.id, updatedTeam)
      setFeedback({ type: 'success', message: 'Изменения сохранены' })
      setIsEditModalOpen(false)
    },
    onError: (error) => {
      console.error('Failed to update team', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить команду',
      })
    },
  })

  const deleteTeamMutation = useMutation({
    mutationFn: deleteAdminTeam,
    onMutate: () => {
      setFeedback(null)
    },
    onSuccess: ({ teamId, teamName }) => {
      removePersistedTeam(teamId)
      setIsEditModalOpen(false)
      setFeedback({
        type: 'success',
        message: `Команда «${teamName}» удалена`,
      })
    },
    onError: (error) => {
      console.error('Failed to delete team', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось удалить команду',
      })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: removeAdminTeamMember,
    onMutate: ({ memberId }) => {
      setMemberActionId(memberId)
      setFeedback(null)
    },
    onSuccess: ({ team, member }) => {
      applyPersistedTeamUpdate(team.id, team)
      setFeedback({
        type: 'success',
        message: `Участник «${member?.name || 'Без имени'}» удалён из команды`,
      })
    },
    onError: (error) => {
      console.error('Failed to remove team member', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось удалить участника',
      })
    },
    onSettled: () => {
      setMemberActionId(null)
    },
  })

  const setCaptainMutation = useMutation({
    mutationFn: setAdminTeamCaptain,
    onMutate: ({ memberId }) => {
      setMemberActionId(memberId)
      setFeedback(null)
    },
    onSuccess: ({ team, member }) => {
      applyPersistedTeamUpdate(team.id, team)
      setFeedback({
        type: 'success',
        message: `«${member?.name || 'Участник'}» назначен капитаном команды`,
      })
    },
    onError: (error) => {
      console.error('Failed to promote team member', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось изменить роль участника',
      })
    },
    onSettled: () => {
      setMemberActionId(null)
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: addAdminTeamMember,
    onMutate: () => {
      setFeedback(null)
    },
    onSuccess: ({ team, userTitle }) => {
      applyPersistedTeamUpdate(team.id, team)
      setFeedback({
        type: 'success',
        message: `«${userTitle}» добавлен в команду`,
      })
    },
    onError: (error) => {
      console.error('Failed to add team member', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось добавить участника',
      })
    },
  })

  const isSaving = saveTeamMutation.isPending
  const isDeletingTeam = deleteTeamMutation.isPending
  const isAddingMember = addMemberMutation.isPending

  useEffect(() => {
    const nextTeams = (teamsQuery.data?.pages || []).flatMap((page) =>
      Array.isArray(page?.teams) ? page.teams : [],
    )
    setTeams(nextTeams)
    setPersistedTeams(nextTeams)
  }, [teamsQuery.data])

  useEffect(() => {
    if (!teamsQuery.error) return
    setFeedback({
      type: 'error',
      message: teamsQuery.error?.message || 'Не удалось загрузить команды',
    })
  }, [teamsQuery.error])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 450)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [searchInput])

  useEffect(() => {
    if (teams.length === 0) {
      setSelectedTeamId(null)
      return
    }

    setSelectedTeamId((prev) => {
      if (prev && teams.some((team) => team.id === prev)) {
        return prev
      }

      return teams[0]?.id ?? null
    })
  }, [teams])

  const handleTeamCardClick = useCallback((team) => {
    if (!team) {
      return
    }

    setSelectedTeamId(team.id)
    setIsTeamDescriptionModalOpen(true)
  }, [])

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teams],
  )

  const persistedSelectedTeam = useMemo(
    () => persistedTeams.find((team) => team.id === selectedTeamId) ?? null,
    [persistedTeams, selectedTeamId],
  )

  useEffect(() => {
    setFeedback(null)
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

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
    },
    [],
  )

  const closeTeamDescriptionModal = useCallback(() => {
    setIsTeamDescriptionModalOpen(false)
  }, [])

  const handleOpenEditModal = useCallback((teamId) => {
    if (!teamId) {
      return
    }
    setSelectedTeamId(teamId)
    setIsEditModalOpen(true)
    setFeedback(null)
  }, [])

  const handleCloseEditModal = useCallback(() => {
    if (isSaving) {
      return
    }
    setIsEditModalOpen(false)
  }, [isSaving])

  const isDirty = useMemo(() => {
    if (!selectedTeam || !persistedSelectedTeam) {
      return false
    }

    return (
      serializeTeamForComparison(selectedTeam) !==
      serializeTeamForComparison(persistedSelectedTeam)
    )
  }, [persistedSelectedTeam, selectedTeam])

  const canManageSelectedTeam = isAdmin

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

      setFeedback(null)
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
    setFeedback(null)
  }, [canManageSelectedTeam, persistedTeams, selectedTeamId])

  const handleSaveTeam = useCallback(async () => {
    if (!selectedTeam || !canManageSelectedTeam) {
      return
    }

    saveTeamMutation.mutate(selectedTeam)
  }, [canManageSelectedTeam, saveTeamMutation, selectedTeam])

  const handleModalPrimaryAction = useCallback(() => {
    if (!isDirty) {
      handleCloseEditModal()
      return
    }
    handleSaveTeam()
  }, [handleCloseEditModal, handleSaveTeam, isDirty])

  const handleCopyTeamId = useCallback(() => {
    const value = selectedTeam?.id
    if (!value || typeof window === 'undefined') {
      return
    }

    const copyText = value.toString()
    const copyPromise = navigator?.clipboard?.writeText
      ? navigator.clipboard.writeText(copyText)
      : Promise.reject(new Error('Clipboard API unavailable'))

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
  }, [selectedTeam?.id])

  const handleDeleteTeam = useCallback(async () => {
    if (!selectedTeam || !isAdmin) {
      return
    }

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить команду «${selectedTeam.name || 'Без названия'}»?\n\nЭто действие необратимо. Все участники будут удалены из команды.`,
    )
    if (!confirmed) {
      return
    }

    deleteTeamMutation.mutate(selectedTeam)
  }, [deleteTeamMutation, isAdmin, selectedTeam])

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
        setFeedback({
          type: 'error',
          message:
            'Нельзя удалить капитана команды. Назначьте нового капитана и повторите действие.',
        })
        return
      }

      removeMemberMutation.mutate({ team: selectedTeam, memberId })
    },
    [canManageSelectedTeam, removeMemberMutation, selectedTeam],
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

  const handleAddMember = useCallback(
    async (userId, userOption) => {
      if (!selectedTeam || !canManageSelectedTeam || !userId) {
        return
      }

      addMemberMutation.mutate({ team: selectedTeam, userId, userOption })
    },
    [
      addMemberMutation,
      canManageSelectedTeam,
      selectedTeam,
    ],
  )

  const teamsForList = useMemo(() => {
    return teams.map((team) => {
      return {
        id: team.id,
        name: team.name || 'Без названия',
        image: team.image || '',
        gamesCount: Number(team.gamesCount) || 0,
        membersLabel: getNounUsers(team.membersCount ?? 0),
        ratingBadge: resolveRatingBadge(team.rating),
        open: Boolean(team.open),
      }
    })
  }, [teams])
  const isTeamsListLoading = isSearchingTeams && teamsForList.length === 0

  const handleLoadMoreTeams = useCallback(async () => {
    if (isLoadingMoreTeams || !hasMoreTeams) {
      return
    }

    setFeedback(null)
    try {
      await teamsQuery.fetchNextPage()
    } catch (error) {
      console.error('Failed to load more teams', error)
      setFeedback({
        type: 'error',
        message:
          error?.message || 'Не удалось загрузить дополнительные команды',
      })
    }
  }, [hasMoreTeams, isLoadingMoreTeams, teamsQuery])

  if (!isAdmin) {
    return (
      <>
        <CabinetLayout
          title="Управление командами"
          description="Доступ ограничен: административные права отсутствуют."
          activePage="admin"
        >
          <FormSectionCard>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              У вас нет доступа к управлению командами. Если вы считаете, что
              это ошибка, обратитесь к главному организатору.
            </p>
          </FormSectionCard>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <CabinetLayout
        title="Управление командами"
        description="Редактируйте составы, управляйте капитанами и следите за активностью команд."
        activePage="admin"
      >
        <section className="grid gap-6">
          <FormSectionCard className="p-4 space-y-3">
            <CabinetInputField
              id="team-search"
              label="Поиск"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Введите название команды или участника"
              containerClassName="space-y-1"
              labelClassName="text-xs font-semibold text-slate-500"
              inputClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
            />

            <CabinetSelectField
              id="team-visibility-filter"
              label="Доступность"
              value={visibilityFilter}
              onChange={(event) => setVisibilityFilter(event.target.value)}
              containerClassName="space-y-1"
              labelClassName="text-xs font-semibold text-slate-500"
              selectClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="all">Все команды</option>
              <option value="open">Открытые</option>
              <option value="closed">Закрытые</option>
            </CabinetSelectField>

            <CabinetSelectField
              id="team-location-filter"
              label="Город"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              containerClassName="space-y-1"
              labelClassName="text-xs font-semibold text-slate-500"
              selectClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {locationFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CabinetSelectField>

            <CabinetSelectField
              id="team-sort"
              label="Сортировка"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              containerClassName="space-y-1"
              labelClassName="text-xs font-semibold text-slate-500"
              selectClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="rating">По рейтингу</option>
              <option value="games_desc">По количеству игр</option>
              <option value="registration_desc">По дате регистрации</option>
            </CabinetSelectField>
          </FormSectionCard>

          {feedback && (
            <NoticeBanner
              tone={feedback.type === 'success' ? 'success' : 'error'}
              variant="neon"
            >
              {feedback.message}
            </NoticeBanner>
          )}

          {teamsForList.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-3">
                {teamsForList.map((team) => (
                  <li key={team.id}>
                    <UserTeamCard
                      team={team}
                      onOpen={handleTeamCardClick}
                      metaText={`${team.membersLabel} · Сыграно игр: ${team.gamesCount}`}
                      showCaptainBadge={false}
                      rightContent={
                        <div className="flex items-center gap-2">
                          {team.ratingBadge ? (
                            <span className="text-xs font-medium px-2 py-1 rounded-full border border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                              {team.ratingBadge}
                            </span>
                          ) : null}
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
                          {canManageSelectedTeam ? (
                            <CardActionIconButton
                              as="span"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleOpenEditModal(team.id)
                              }}
                              label="Редактировать команду"
                            >
                              <EditCardIcon />
                            </CardActionIconButton>
                          ) : null}
                        </div>
                      }
                    />
                  </li>
                ))}
              </ul>
              {hasMoreTeams && (
                <CabinetButton
                  onClick={handleLoadMoreTeams}
                  disabled={isLoadingMoreTeams || isSearchingTeams}
                  variant="secondary"
                  tone={
                    isLoadingMoreTeams || isSearchingTeams ? 'neutral' : 'cyan'
                  }
                  size="md"
                  className={`w-full ${
                    isLoadingMoreTeams || isSearchingTeams
                      ? 'cursor-wait'
                      : 'cursor-pointer'
                  }`}
                >
                  {isLoadingMoreTeams || isSearchingTeams
                    ? 'Загружаем…'
                    : 'Загрузить ещё'}
                </CabinetButton>
              )}
            </div>
          ) : isTeamsListLoading ? (
            <FormSectionCard className="p-6 text-sm text-center text-slate-500 dark:text-slate-300">
              Загружаем список команд...
            </FormSectionCard>
          ) : (
            <FormSectionCard className="p-6 text-sm text-center text-slate-500 dark:text-slate-300">
              Команды не найдены. Измените параметры фильтра или сбросьте поиск.
            </FormSectionCard>
          )}
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
          canEditCarSkin={isAdmin}
          canDeleteTeam={isAdmin}
          isDeletingTeam={isDeletingTeam}
          onDeleteTeam={handleDeleteTeam}
          locationOptions={locationOptions}
          onAddMember={handleAddMember}
          isAddingMember={isAddingMember}
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
  hasLinkedUser: PropTypes.bool,
})

const teamGameShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  status: PropTypes.string,
  dateStart: PropTypes.string,
  hidden: PropTypes.bool,
})

AdminTeamsPage.propTypes = {
  initialTeams: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      description: PropTypes.string,
      image: PropTypes.string,
      open: PropTypes.bool,
      location: PropTypes.string,
      carSkin: PropTypes.string,
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
  initialHasMore: PropTypes.bool,
  session: PropTypes.object,
}

AdminTeamsPage.defaultProps = {
  initialTeams: [],
  initialHasMore: false,
  session: null,
}

export default AdminTeamsPage
