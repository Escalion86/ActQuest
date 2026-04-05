'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import AdminUserCard from '@components/cabinet/cards/AdminUserCard'
import ParticipationGameCard from '@components/cabinet/cards/ParticipationGameCard'
import UserTeamCard from '@components/cabinet/cards/UserTeamCard'
import ImagesInput from '@components/cabinet/ImagesInput'
import NoticeBanner from '@components/NoticeBanner'
import Modal from '@components/Modal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import UnifiedGameDescriptionModal from '@components/modals/UnifiedGameDescriptionModal'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import fetchCabinetGameDetails from '@helpers/fetchCabinetGameDetails'
import fetchCabinetUserDetails from '@helpers/fetchCabinetUserDetails'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import isUserAdmin from '@helpers/isUserAdmin'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import requestApiJson from '@helpers/requestApiJson'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import CABINET_ROLE_LABELS from '@helpers/cabinetRoleLabels'
import ensureRole from '@helpers/ensureRole'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'
import { USERS_ROLES } from '@helpers/constants'
import { ensureDateISOString } from '@helpers/idAndDate'
import {
  formatPhoneInput,
  normalizePhoneForSubmit,
} from '@helpers/phoneInputMask'
import { LOCATIONS } from '@server/serverConstants'

const USERS_PAGE_SIZE = 10
const modalSectionTitleClass = 'aq-modal-section-title text-base font-semibold'
const modalItemTitleClass = 'aq-modal-item-title text-lg font-semibold'
const modalItemSmallTitleClass = 'aq-modal-item-title text-sm font-semibold'
const CABINET_ADMIN_API_BASE = '/api/cabinet/admin'
const CABINET_USERS_API_BASE = '/api/cabinet/users'

const resolveLocationLabel = (locationKey) => {
  const key = typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''
  if (!key) {
    return 'Не указан'
  }

  const rawName = LOCATIONS?.[key]?.townRu
  if (!rawName || typeof rawName !== 'string') {
    return locationKey
  }

  return rawName.charAt(0).toUpperCase() + rawName.slice(1)
}

const cloneUser = (user) => {
  if (!user) {
    return null
  }

  return {
    ...user,
    preferences: Array.isArray(user.preferences) ? [...user.preferences] : [],
    teams: Array.isArray(user.teams)
      ? user.teams.map((team) => ({ ...team }))
      : [],
  }
}

const ManageUsersPage = ({
  initialUsers,
  initialHasMore,
  initialLocation,
  session: initialSession,
}) => {
  const normalizeRoleFilterValue = useCallback((value) => {
    const normalizedRaw =
      typeof value === 'string' ? value.trim().toLowerCase() : ''
    return normalizedRaw
  }, [])

  const safeInitialUsers = Array.isArray(initialUsers) ? initialUsers : []
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeSession } = useMergedSession(initialSession)
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const isAdmin = isUserAdmin({ role: effectiveRole })
  const isDeveloper = effectiveRole === 'dev'

  const [users, setUsers] = useState(safeInitialUsers)
  const [persistedUsers, setPersistedUsers] = useState(safeInitialUsers)
  const [selectedUserId, setSelectedUserId] = useState(safeInitialUsers[0]?.id ?? null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [sortBy, setSortBy] = useState('registration_desc')
  const [feedback, setFeedback] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasMoreUsers, setHasMoreUsers] = useState(Boolean(initialHasMore))
  const [isLoadingMoreUsers, setIsLoadingMoreUsers] = useState(false)
  const [isRequestingPhone, setIsRequestingPhone] = useState(false)
  const [isUserViewModalOpen, setIsUserViewModalOpen] = useState(false)
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false)
  const [isUserGamesModalOpen, setIsUserGamesModalOpen] = useState(false)
  const [isUserPushModalOpen, setIsUserPushModalOpen] = useState(false)
  const [isUserTeamModalOpen, setIsUserTeamModalOpen] = useState(false)
  const [isParticipationGameModalOpen, setIsParticipationGameModalOpen] = useState(false)
  const [isParticipationGameLoading, setIsParticipationGameLoading] = useState(false)
  const [selectedParticipationGame, setSelectedParticipationGame] = useState(null)
  const [selectedUserTeam, setSelectedUserTeam] = useState(null)
  const [selectedUserForPush, setSelectedUserForPush] = useState(null)
  const [userPushMessage, setUserPushMessage] = useState('')
  const [isUserPushSubmitting, setIsUserPushSubmitting] = useState(false)
  const [userPushFeedback, setUserPushFeedback] = useState(null)
  const [userGamesState, setUserGamesState] = useState({
    isLoading: false,
    error: null,
    userName: '',
    games: [],
  })
  const [userGamesPreviewState, setUserGamesPreviewState] = useState({
    isLoading: false,
    error: null,
    userId: null,
    games: [],
    total: 0,
  })

  useEffect(() => {
    setUsers(safeInitialUsers)
    setPersistedUsers(safeInitialUsers)
    setHasMoreUsers(Boolean(initialHasMore))
    setSelectedUserId((prev) => {
      if (prev && safeInitialUsers.some((user) => user.id === prev)) {
        return prev
      }

      return safeInitialUsers[0]?.id ?? null
    })
  }, [initialHasMore, safeInitialUsers])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 450)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [searchInput])

  const setUserIdQuery = useCallback(
    (nextUserId) => {
      const nextQuery = new URLSearchParams(searchParams?.toString() || '')
      if (nextUserId) {
        nextQuery.set('userId', nextUserId)
      } else {
        nextQuery.delete('userId')
      }

      const nextUrl = nextQuery.toString()
        ? `${pathname}?${nextQuery.toString()}`
        : pathname
      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const closeUserEditModal = useCallback(() => {
    setIsUserEditModalOpen(false)
  }, [])

  const closeUserTeamModal = useCallback(() => {
    setIsUserTeamModalOpen(false)
    setSelectedUserTeam(null)
  }, [])

  const closeUserViewModal = useCallback(() => {
    setIsUserViewModalOpen(false)
    closeUserTeamModal()
    setUserIdQuery(null)
  }, [closeUserTeamModal, setUserIdQuery])

  const closeUserGamesModal = useCallback(() => {
    setIsUserGamesModalOpen(false)
    setUserGamesState((prev) => ({
      ...prev,
      isLoading: false,
      error: null,
      userName: '',
      games: [],
    }))
  }, [])

  const closeUserPushModal = useCallback(() => {
    if (isUserPushSubmitting) {
      return
    }

    setIsUserPushModalOpen(false)
    setSelectedUserForPush(null)
    setUserPushMessage('')
    setUserPushFeedback(null)
  }, [isUserPushSubmitting])

  const closeParticipationGameModal = useCallback(() => {
    setIsParticipationGameModalOpen(false)
    setSelectedParticipationGame(null)
    setIsParticipationGameLoading(false)
  }, [])

  const roleOptions = useMemo(() => {
    const baseOptions = USERS_ROLES.map(({ value, name }) => ({ value, name }))
    const knownRoles = new Set(baseOptions.map((option) => option.value))

    if (!knownRoles.has('ban')) {
      baseOptions.push({ value: 'ban', name: CABINET_ROLE_LABELS.ban })
      knownRoles.add('ban')
    }

    users.forEach((user) => {
      if (user.role && !knownRoles.has(user.role)) {
        baseOptions.push({ value: user.role, name: CABINET_ROLE_LABELS[user.role] ?? user.role })
        knownRoles.add(user.role)
      }
    })

    return baseOptions
  }, [users])

  const editRoleOptions = useMemo(
    () =>
      roleOptions.filter(
        (option) => option.value !== 'dev' || isDeveloper,
      ),
    [isDeveloper, roleOptions],
  )

  useEffect(() => {
    if (users.length === 0) {
      setSelectedUserId(null)
      setIsUserViewModalOpen(false)
      setIsUserEditModalOpen(false)
      return
    }

    setSelectedUserId((prev) => {
      if (prev && users.some((user) => user.id === prev)) {
        return prev
      }

      return users[0]?.id ?? null
    })
  }, [users])

  useEffect(() => {
    if (!isAdmin) {
      return undefined
    }

    let cancelled = false

    const loadUsersByFilters = async () => {
      setIsLoadingMoreUsers(true)
      setFeedback(null)

      try {
        const params = new URLSearchParams({
          offset: '0',
          limit: String(USERS_PAGE_SIZE),
          sortBy,
        })
        if (searchQuery) {
          params.set('q', searchQuery)
        }
        if (roleFilter && roleFilter !== 'all') {
          params.set('role', roleFilter)
        }
        if (locationFilter && locationFilter !== 'all') {
          params.set('location', locationFilter)
        }
        const { json } = await requestApiJson(`${CABINET_ADMIN_API_BASE}/users-list?${params.toString()}`, {
          fallbackMessage: 'Не удалось загрузить пользователей',
        })

        if (cancelled) {
          return
        }

        const nextUsers = Array.isArray(json?.data) ? json.data : []
        const nextHasMore = Boolean(json?.meta?.hasMore)
        setUsers(nextUsers)
        setPersistedUsers(nextUsers)
        setHasMoreUsers(nextHasMore)
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error('Failed to load users with selected filters', error)
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось применить фильтры',
        })
      } finally {
        if (!cancelled) {
          setIsLoadingMoreUsers(false)
        }
      }
    }

    loadUsersByFilters()

    return () => {
      cancelled = true
    }
  }, [isAdmin, locationFilter, roleFilter, safeInitialUsers.length, searchQuery, sortBy])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  const persistedSelectedUser = useMemo(
    () => persistedUsers.find((user) => user.id === selectedUserId) ?? null,
    [persistedUsers, selectedUserId]
  )
  const isUsersListLoading = isLoadingMoreUsers && users.length === 0

  useEffect(() => {
    setFeedback(null)
  }, [selectedUserId])

  const handleOpenUserViewModal = useCallback(
    (user) => {
      if (!user) {
        return
      }

      setSelectedUserId(user.id)
      setIsUserEditModalOpen(false)
      setIsUserViewModalOpen(true)
      setUserIdQuery(user.id)
    },
    [setUserIdQuery]
  )

  const handleOpenUserEditModal = useCallback((user) => {
    if (!user) {
      return
    }

    if (!isDeveloper && user.role === 'dev') {
      setFeedback({
        type: 'error',
        message:
          'Только разработчик может изменять карточку пользователя с ролью «Разработчик».',
      })
      return
    }

    setSelectedUserId(user.id)
    setIsUserViewModalOpen(false)
    setIsUserEditModalOpen(true)
  }, [isDeveloper])

  const handleOpenUserPushModal = useCallback((user) => {
    if (!user?.id) {
      return
    }

    setSelectedUserForPush(user)
    setUserPushMessage('')
    setUserPushFeedback(null)
    setIsUserPushModalOpen(true)
  }, [])

  const handleSubmitUserPushMessage = useCallback(async () => {
    if (!selectedUserForPush?.id) {
      setUserPushFeedback({
        type: 'error',
        message: 'Пользователь не выбран',
      })
      return
    }

    const message = typeof userPushMessage === 'string' ? userPushMessage.trim() : ''
    if (!message) {
      setUserPushFeedback({
        type: 'error',
        message: 'Введите сообщение для отправки',
      })
      return
    }

    setIsUserPushSubmitting(true)
    setUserPushFeedback(null)

    try {
      const { json } = await requestApiJson(`${CABINET_ADMIN_API_BASE}/user-push`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserForPush.id,
          message,
        }),
        fallbackMessage: 'Не удалось отправить push-уведомление',
      })

      const created = Number(json?.data?.created || 0)
      const delivered = Number(json?.data?.delivered || 0)

      const successMessage =
        created > 0
          ? `Уведомление отправлено. Создано: ${created}, доставлено push: ${delivered}.`
          : 'Сообщение сохранено, но push не доставлен (возможно, у пользователя нет активной подписки).'

      setFeedback({
        type: 'success',
        message: successMessage,
      })
      setUserPushMessage('')
      setIsUserPushModalOpen(false)
      setSelectedUserForPush(null)
    } catch (error) {
      const messageText = error?.message || 'Не удалось отправить push-уведомление'
      setUserPushFeedback({
        type: 'error',
        message: messageText,
      })
      setFeedback({
        type: 'error',
        message: messageText,
      })
    } finally {
      setIsUserPushSubmitting(false)
    }
  }, [selectedUserForPush, setFeedback, userPushMessage])

  const fetchUserGames = useCallback(async (user) => {
    const params = new URLSearchParams()
    if (typeof user?.id === 'string' && user.id) {
      params.set('userId', user.id)
    }
    if (typeof user?.telegramId === 'string' && user.telegramId) {
      params.set('telegramId', user.telegramId)
    }

    const { json } = await requestApiJson(`${CABINET_ADMIN_API_BASE}/user-games?${params.toString()}`, {
      fallbackMessage: 'Не удалось загрузить игры пользователя',
    })

    const gamesRaw = Array.isArray(json?.data) ? json.data : []
    const games = gamesRaw.sort((first, second) => {
      const firstTime = first?.dateStart ? new Date(first.dateStart).getTime() : 0
      const secondTime = second?.dateStart ? new Date(second.dateStart).getTime() : 0
      return secondTime - firstTime
    })

    return games
  }, [])

  const handleOpenUserGamesModal = useCallback(
    async (user) => {
      if (!user) {
        return
      }

      setIsUserGamesModalOpen(true)
      const previewReady =
        userGamesPreviewState.userId === user.id &&
        !userGamesPreviewState.isLoading &&
        !userGamesPreviewState.error &&
        Array.isArray(userGamesPreviewState.games)

      if (previewReady) {
        setUserGamesState({
          isLoading: false,
          error: null,
          userName: user.name || 'Без имени',
          games: userGamesPreviewState.games,
        })
        return
      }

      setUserGamesState({
        isLoading: true,
        error: null,
        userName: user.name || 'Без имени',
        games: [],
      })

      try {
        const games = await fetchUserGames(user)

        setUserGamesState({
          isLoading: false,
          error: null,
          userName: user.name || 'Без имени',
          games,
        })
      } catch (error) {
        console.error('Failed to load user games', error)
        setUserGamesState({
          isLoading: false,
          error: error?.message || 'Не удалось загрузить игры пользователя',
          userName: user.name || 'Без имени',
          games: [],
        })
      }
    },
    [fetchUserGames, userGamesPreviewState]
  )

  const handleOpenParticipationGame = useCallback(
    async (gameOrId) => {
      const gameId =
        typeof gameOrId === 'string'
          ? gameOrId
          : typeof gameOrId?.id === 'string'
            ? gameOrId.id
            : ''
      if (!gameId) {
        return
      }

      const gameFromState =
        (Array.isArray(userGamesState.games)
          ? userGamesState.games.find((item) => item.id === gameId)
          : null) ||
        (Array.isArray(userGamesPreviewState.games)
          ? userGamesPreviewState.games.find((item) => item.id === gameId)
          : null) ||
        (gameOrId && typeof gameOrId === 'object' ? gameOrId : null)

      if (!gameFromState) {
        setFeedback({
          type: 'error',
          message: 'Не удалось открыть игру: данные отсутствуют',
        })
        return
      }

      const hasDetailedFields =
        Object.prototype.hasOwnProperty.call(gameFromState, 'descriptionRich') ||
        Object.prototype.hasOwnProperty.call(gameFromState, 'startingPlace') ||
        Object.prototype.hasOwnProperty.call(gameFromState, 'prices')

      setIsUserTeamModalOpen(false)
      setIsParticipationGameLoading(true)
      setFeedback(null)
      try {
        const detailedGame = hasDetailedFields
          ? gameFromState
          : await fetchCabinetGameDetails({ gameId, location: gameFromState.location || location || null })
        setSelectedParticipationGame(detailedGame)
        setIsParticipationGameModalOpen(true)
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось открыть игру',
        })
      } finally {
        setIsParticipationGameLoading(false)
      }
    },
    [location, userGamesPreviewState.games, userGamesState.games]
  )

  const ensureUserInState = useCallback((userPatch) => {
    if (!userPatch?.id) {
      return null
    }

    setUsers((prevUsers) => {
      const exists = prevUsers.some((item) => item.id === userPatch.id)
      const fallbackUser = {
        id: userPatch.id,
        globalUserId: null,
        telegramId: '',
        name: userPatch.name || 'Без имени',
        username: userPatch.username || '',
        phone: userPatch.phone || '',
        role: userPatch.role || 'client',
        about: '',
        preferences: [],
        createdAt: null,
        updatedAt: null,
        teams: [],
        teamsCount: 0,
        gamesCount: 0,
        rating: null,
      }

      if (exists) {
        return prevUsers.map((item) => (
          item.id === userPatch.id
            ? { ...item, ...fallbackUser, ...userPatch }
            : item
        ))
      }

      return [{ ...fallbackUser, ...userPatch }, ...prevUsers]
    })

    return userPatch.id
  }, [])

  const handleOpenUserTeamModal = useCallback(
    async (team) => {
      if (!team?.id) {
        return
      }

      setFeedback(null)

      try {
        const detailedTeam = await fetchCabinetTeamDetails({ teamId: team.id })

        setSelectedUserTeam(detailedTeam)
        setIsUserTeamModalOpen(true)
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось загрузить команду',
        })
      }
    },
    []
  )

  const handleOpenMemberProfile = useCallback(
    async (member) => {
      if (!member) {
        return
      }

      const nextUserId = typeof member.userId === 'string' && member.userId
        ? member.userId
        : null

      if (!nextUserId) {
        return
      }

      let loadedUser = null
      try {
        loadedUser = await fetchCabinetUserDetails({
          userId: nextUserId || '',
          telegramId: member.telegramId || null,
        })
      } catch (error) {
        void error
      }

      ensureUserInState(
        loadedUser || {
          id: nextUserId,
          name: member.name || 'Без имени',
          username: member.username || '',
          phone: member.phone || '',
          role: member.userRole || 'client',
        }
      )

      setSelectedUserId(nextUserId)
      setIsUserTeamModalOpen(false)
      setIsUserEditModalOpen(false)
      setIsUserViewModalOpen(true)
      setUserIdQuery(nextUserId)
    },
    [ensureUserInState, setUserIdQuery]
  )

  useEffect(() => {
    if (!isUserViewModalOpen || !selectedUser) {
      return
    }

    let cancelled = false

    setUserGamesPreviewState({
      isLoading: true,
      error: null,
      userId: selectedUser.id,
      games: [],
      total: Number(selectedUser.gamesCount) || 0,
    })

    fetchUserGames(selectedUser)
      .then((games) => {
        if (cancelled) {
          return
        }
        setUserGamesPreviewState({
          isLoading: false,
          error: null,
          userId: selectedUser.id,
          games,
          total: games.length,
        })
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setUserGamesPreviewState({
          isLoading: false,
          error: error?.message || 'Не удалось загрузить игры пользователя',
          userId: selectedUser.id,
          games: [],
          total: Number(selectedUser.gamesCount) || 0,
        })
      })

    return () => {
      cancelled = true
    }
  }, [fetchUserGames, isUserViewModalOpen, selectedUser])

  useEffect(() => {
    const userIdFromQuery = searchParams?.get('userId')

    if (!userIdFromQuery || typeof userIdFromQuery !== 'string') {
      setIsUserViewModalOpen(false)
      return
    }

    const exists = users.some((user) => user.id === userIdFromQuery)
    if (!exists) {
      setIsUserViewModalOpen(false)
      return
    }

    setSelectedUserId(userIdFromQuery)
    setIsUserEditModalOpen(false)
    setIsUserViewModalOpen(true)
  }, [searchParams, users])

  const isDirty = useMemo(() => {
    if (!selectedUser || !persistedSelectedUser) {
      return false
    }

    const sanitizeText = (value) => (typeof value === 'string' ? value.trim() : '')
    const sanitizeNullable = (value) => {
      const normalized = sanitizeText(value)
      return normalized.length > 0 ? normalized : null
    }
    const normalizePreferences = (value) =>
      Array.isArray(value)
        ? Array.from(new Set(value.map((item) => sanitizeText(item)).filter(Boolean))).sort()
        : []

    return JSON.stringify({
      role: selectedUser.role,
      name: sanitizeText(selectedUser.name),
      username: sanitizeNullable(selectedUser.username),
      photoUrl: sanitizeNullable(selectedUser.photoUrl),
      currentLocation: sanitizeNullable(selectedUser.currentLocation),
      about: sanitizeText(selectedUser.about),
      preferences: normalizePreferences(selectedUser.preferences),
    }) !== JSON.stringify({
      role: persistedSelectedUser.role,
      name: sanitizeText(persistedSelectedUser.name),
      username: sanitizeNullable(persistedSelectedUser.username),
      photoUrl: sanitizeNullable(persistedSelectedUser.photoUrl),
      currentLocation: sanitizeNullable(persistedSelectedUser.currentLocation),
      about: sanitizeText(persistedSelectedUser.about),
      preferences: normalizePreferences(persistedSelectedUser.preferences),
    })
  }, [persistedSelectedUser, selectedUser])

  const handleEditFieldChange = useCallback(
    (field, value) => {
      if (!selectedUserId) {
        return
      }

      setFeedback(null)
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === selectedUserId
            ? {
                ...user,
                [field]: value,
              }
            : user
        )
      )
    },
    [selectedUserId]
  )

  const handleRoleChange = useCallback(
    (role) => {
      if (!selectedUserId) {
        return
      }

      if (!isDeveloper && role === 'dev') {
        setFeedback({
          type: 'error',
          message:
            'Только разработчик может назначать роль «Разработчик».',
        })
        return
      }

      setFeedback(null)
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === selectedUserId
            ? {
                ...user,
                role,
              }
            : user
        )
      )
    },
    [isDeveloper, selectedUserId]
  )

  const handleReset = useCallback(() => {
    if (!selectedUserId || !persistedSelectedUser) {
      return
    }

    const snapshot = cloneUser(persistedSelectedUser)

    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.id === selectedUserId && snapshot ? snapshot : user))
    )
    setFeedback(null)
  }, [persistedSelectedUser, selectedUserId])

  const handleSave = useCallback(async () => {
    if (!selectedUser || !persistedSelectedUser) {
      return
    }

    if (!isDeveloper && persistedSelectedUser.role === 'dev') {
      setFeedback({
        type: 'error',
        message:
          'Только разработчик может изменять карточку пользователя с ролью «Разработчик».',
      })
      return
    }

    if (!isDeveloper && selectedUser.role === 'dev') {
      setFeedback({
        type: 'error',
        message:
          'Только разработчик может назначать роль «Разработчик».',
      })
      return
    }

    if (!isDirty) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const normalizeText = (value) =>
        typeof value === 'string' ? value.trim() : ''
      const normalizeNullable = (value) => {
        const normalized = normalizeText(value)
        return normalized.length > 0 ? normalized : null
      }
      const normalizePhone = (value) => {
        if (typeof value !== 'string') {
          return null
        }

        const digits = normalizePhoneForSubmit(value)
        return digits.length === 11 ? Number(digits) : null
      }

      const payload = {
        role: selectedUser.role,
        name: normalizeText(selectedUser.name),
        username: normalizeNullable(selectedUser.username),
        photoUrl: normalizeNullable(selectedUser.photoUrl),
        phone: normalizePhone(selectedUser.phone),
        currentLocation: normalizeNullable(selectedUser.currentLocation),
        about: normalizeText(selectedUser.about),
        preferences: Array.isArray(selectedUser.preferences)
          ? Array.from(
              new Set(
                selectedUser.preferences
                  .map((item) => normalizeText(item))
                  .filter((item) => item.length > 0),
              ),
            )
          : [],
      }

      const { json } = await requestApiJson(`${CABINET_ADMIN_API_BASE}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        fallbackMessage: 'Не удалось сохранить изменения',
      })

      const updatedDoc = json.data ?? {}
      const baseProfile = normalizeUserProfile(updatedDoc)
      const updatedUser = {
        ...cloneUser(selectedUser),
        ...baseProfile,
        telegramId: Number.isFinite(updatedDoc?.telegramId)
          ? String(updatedDoc.telegramId)
          : selectedUser.telegramId,
        role: ensureRole(updatedDoc?.role),
        createdAt: ensureDateISOString(updatedDoc?.createdAt) ?? selectedUser.createdAt,
        updatedAt: ensureDateISOString(updatedDoc?.updatedAt) ?? new Date().toISOString(),
      }

      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === selectedUser.id ? updatedUser : user))
      )
      setPersistedUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === selectedUser.id ? cloneUser(updatedUser) : user))
      )
      setFeedback({
        type: 'success',
        message: 'Данные пользователя обновлены',
      })
    } catch (error) {
      console.error('Failed to update user role', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить изменения',
      })
    } finally {
      setIsSaving(false)
    }
  }, [isDeveloper, isDirty, persistedSelectedUser, selectedUser])

  const handleRequestPhoneViaTelegram = useCallback(async () => {
    if (!selectedUser || !location || isRequestingPhone) {
      return
    }

    if (!selectedUser.telegramId) {
      setFeedback({
        type: 'error',
        message: 'У выбранного пользователя не указан Telegram ID',
      })
      return
    }

    setIsRequestingPhone(true)
    setFeedback(null)

    try {
      await requestApiJson(`${CABINET_USERS_API_BASE}/request-phone`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.globalUserId || selectedUser.id,
        }),
        fallbackMessage: 'Не удалось отправить запрос номера через Telegram',
      })

      setFeedback({
        type: 'success',
        message:
          'Запрос номера отправлен пользователю в Telegram. Ожидаем отправку контакта.',
      })
    } catch (error) {
      console.error('Failed to request phone via Telegram', error)
      setFeedback({
        type: 'error',
        message:
          error?.message ||
          'Не удалось отправить запрос номера через Telegram',
      })
    } finally {
      setIsRequestingPhone(false)
    }
  }, [isRequestingPhone, location, selectedUser])

  const handleLoadMoreUsers = useCallback(async () => {
    if (isLoadingMoreUsers || !hasMoreUsers) {
      return
    }

    setIsLoadingMoreUsers(true)
    setFeedback(null)

    try {
      const params = new URLSearchParams({
        offset: String(users.length),
        limit: String(USERS_PAGE_SIZE),
        sortBy,
      })
      if (searchQuery) {
        params.set('q', searchQuery)
      }
      if (roleFilter && roleFilter !== 'all') {
        params.set('role', roleFilter)
      }
      if (locationFilter && locationFilter !== 'all') {
        params.set('location', locationFilter)
      }
      const { json } = await requestApiJson(`${CABINET_ADMIN_API_BASE}/users-list?${params.toString()}`, {
        fallbackMessage: 'Не удалось загрузить пользователей',
      })

      const nextUsers = Array.isArray(json?.data) ? json.data : []
      const nextHasMore = Boolean(json?.meta?.hasMore)

      if (nextUsers.length > 0) {
        setUsers((prevUsers) => [...prevUsers, ...nextUsers])
        setPersistedUsers((prevUsers) => [...prevUsers, ...nextUsers])
      }

      setHasMoreUsers(nextHasMore)
    } catch (error) {
      console.error('Failed to load more users', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось загрузить дополнительных пользователей',
      })
    } finally {
      setIsLoadingMoreUsers(false)
    }
  }, [hasMoreUsers, isLoadingMoreUsers, locationFilter, roleFilter, searchQuery, sortBy, users.length])

  const filterOptions = useMemo(
    () => [
      { value: 'all', name: 'Все роли' },
      ...roleOptions.map((option) => ({ value: option.value, name: option.name })),
    ],
    [roleOptions]
  )
  const locationOptions = useMemo(
    () =>
      Object.entries(LOCATIONS)
        .filter(([, value]) => !value?.hidden)
        .map(([key, value]) => ({
          value: key,
          name:
            typeof value?.townRu === 'string' && value.townRu.length > 0
              ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
              : key,
        })),
    [],
  )
  const locationFilterOptions = useMemo(
    () => [
      { value: 'all', name: 'Все города' },
      ...locationOptions,
    ],
    [locationOptions],
  )

  if (!isAdmin) {
    return (
      <>
<CabinetLayout
          title="Управление пользователями"
          description="Доступ ограничен: административные права отсутствуют."
          activePage="admin"
        >
          <FormSectionCard>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              У вас нет доступа к управлению пользователями. Если вы считаете, что это ошибка, обратитесь к
              главному организатору.
            </p>
          </FormSectionCard>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
<CabinetLayout
        title="Управление пользователями"
        description="Просматривайте профили участников, управляйте их ролями и отслеживайте активность."
        activePage="admin"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-5 space-y-4">
            <FormSectionCard className="p-4 space-y-3">
              <CabinetInputField
                id="user-search"
                label="Поиск"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Введите имя, ник или Telegram ID"
                containerClassName="space-y-1"
                labelClassName="text-xs font-semibold text-slate-500"
                inputClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
              />

              <CabinetSelectField
                  id="user-role-filter"
                  label="Роль"
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(normalizeRoleFilterValue(event.target.value))
                  }
                  containerClassName="space-y-1"
                  labelClassName="text-xs font-semibold text-slate-500"
                  selectClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
              </CabinetSelectField>

              <CabinetSelectField
                  id="user-location-filter"
                  label="Город"
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                  containerClassName="space-y-1"
                  labelClassName="text-xs font-semibold text-slate-500"
                  selectClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {locationFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
              </CabinetSelectField>

              <CabinetSelectField
                  id="user-sort"
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

            {users.length > 0 ? (
              <div className="space-y-3">
                <ul className="space-y-3">
                  {users.map((user) => {
                    return (
                      <li key={user.id}>
                        <AdminUserCard
                          user={user}
                          onOpenView={handleOpenUserViewModal}
                          onOpenGames={handleOpenUserGamesModal}
                          onOpenEdit={handleOpenUserEditModal}
                          onOpenPush={handleOpenUserPushModal}
                        />
                      </li>
                    )
                  })}
                </ul>
                {hasMoreUsers && (
                  <CabinetButton
                    onClick={handleLoadMoreUsers}
                    disabled={isLoadingMoreUsers}
                    variant="secondary"
                    tone={isLoadingMoreUsers ? 'neutral' : 'cyan'}
                    size="md"
                    className={`w-full ${
                      isLoadingMoreUsers
                        ? 'cursor-wait'
                        : 'cursor-pointer'
                    }`}
                  >
                  {isLoadingMoreUsers ? 'Загружаем…' : 'Загрузить ещё'}
                  </CabinetButton>
                )}
              </div>
            ) : isUsersListLoading ? (
              <FormSectionCard className="p-6 text-sm text-center text-slate-500 dark:text-slate-300">
                Загружаем список пользователей...
              </FormSectionCard>
            ) : (
              <FormSectionCard className="p-6 text-sm text-center text-slate-500 dark:text-slate-300">
                Пользователи не найдены. Измените параметры фильтра или сбросьте поиск.
              </FormSectionCard>
            )}
          </div>

        </section>
        <Modal
          isOpen={isUserViewModalOpen && Boolean(selectedUser)}
          onClose={closeUserViewModal}
          title={`Пользователь — ${selectedUser?.name || 'Без имени'}`}
        >
          {selectedUser ? (
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
                <div className="flex items-start gap-3">
                  <img
                    src={getUserAvatarSrc(selectedUser)}
                    alt={selectedUser.name || 'Аватар пользователя'}
                    className="h-[200px] w-[200px] shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <h2 className={modalItemTitleClass}>
                      {selectedUser.name || 'Без имени'}
                    </h2>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-sky-500/10 dark:border-sky-500/30">
                    <p className="text-xs text-blue-600 dark:text-sky-300">Команд</p>
                    <p className="mt-1 text-xl font-semibold text-primary dark:text-sky-100">{selectedUser.teamsCount}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-500/30">
                    <p className="text-xs text-emerald-600 dark:text-emerald-300">Игры</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-100">{selectedUser.gamesCount}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-800/70 dark:border-slate-700 rounded-xl">
                    <p className="text-xs text-slate-600 dark:text-slate-300">Последнее обновление</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                      {selectedUser.updatedAt
                        ? formatRelativeTimeFromNow(selectedUser.updatedAt)
                        : 'Неизвестно'}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-xs text-amber-700 dark:text-amber-300">Рейтинг пользователя</p>
                  {selectedUser.rating?.isEligible && Number.isFinite(selectedUser.rating?.rank) ? (
                    <p className="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-100">
                      #{selectedUser.rating.rank} · {Number(selectedUser.rating?.finalScore || 0).toFixed(2)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
                      Недостаточно данных для рейтинга
                    </p>
                  )}
                </div>

              </FormSectionCard>

              <FormSectionCard className="space-y-4">
                <h3 className={modalSectionTitleClass}>Команды пользователя</h3>

                {selectedUser.teams.length > 0 ? (
                  <ul className="space-y-3">
                    {selectedUser.teams.map((team) => (
                      <li key={team.id}>
                        <UserTeamCard team={team} onOpen={handleOpenUserTeamModal} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    Пользователь ещё не вступил ни в одну команду.
                  </p>
                )}
              </FormSectionCard>

              <FormSectionCard className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className={modalSectionTitleClass}>Игры участия</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    Сыграно игр: {Number(userGamesPreviewState.total || selectedUser.gamesCount || 0)}
                  </span>
                </div>

                {userGamesPreviewState.isLoading ? (
                  <p className="text-sm text-slate-500">Загружаем игры пользователя...</p>
                ) : userGamesPreviewState.error ? (
                  <p className="text-sm text-rose-500">{userGamesPreviewState.error}</p>
                ) : userGamesPreviewState.games.length > 0 ? (
                  <>
                    <ul className="space-y-3">
                      {userGamesPreviewState.games.slice(0, 3).map((game) => (
                        <li key={game.id}>
                          <ParticipationGameCard game={game} onOpen={handleOpenParticipationGame} />
                        </li>
                      ))}
                    </ul>
                    {userGamesPreviewState.games.length > 3 && (
                      <div className="flex items-center justify-between gap-3">
                        <CabinetButton
                          onClick={() => handleOpenUserGamesModal(selectedUser)}
                          variant="secondary"
                          tone="cyan"
                          size="sm"
                        >
                          Посмотреть все
                        </CabinetButton>
                        <span className="text-xs text-slate-500 dark:text-slate-300">
                          Всего: {userGamesPreviewState.games.length}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    У пользователя пока нет игр участия через команды.
                  </p>
                )}
              </FormSectionCard>

              <FormSectionCard className="space-y-4">
                <h3 className={modalSectionTitleClass}>Дополнительная информация</h3>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Телефон</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                      {selectedUser.phone || 'Не указан'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Город</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                      {resolveLocationLabel(selectedUser.currentLocation)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Создан</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                      {selectedUser.createdAt
                        ? formatRelativeTimeFromNow(selectedUser.createdAt)
                        : 'Неизвестно'}
                    </p>
                  </div>
                </div>

                {selectedUser.preferences && selectedUser.preferences.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Предпочтения</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUser.preferences.map((preference) => (
                        <span
                          key={preference}
                          className="px-3 py-1 text-xs font-medium text-primary bg-blue-50 border border-blue-200 rounded-full dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-200"
                        >
                          {preference}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500">О себе</p>
                  <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">
                    {selectedUser.about?.trim() || 'Пользователь пока не добавил описание профиля.'}
                  </p>
                </div>
              </FormSectionCard>
            </div>
          ) : null}
        </Modal>
        <Modal
          isOpen={isUserEditModalOpen && Boolean(selectedUser)}
          onClose={closeUserEditModal}
          title={`Редактирование — ${selectedUser?.name || 'Без имени'}`}
        >
          {selectedUser ? (
            <div className="space-y-6">
              {!location && (
                <NoticeBanner tone="warning" variant="neon">
                  Не удалось определить площадку пользователя. Сохранение изменений недоступно.
                </NoticeBanner>
              )}

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
                    value={selectedUser.name || ''}
                    onChange={(event) => handleEditFieldChange('name', event.target.value)}
                  />
                  <CabinetInputField
                    id="user-edit-username"
                    label="Никнейм в ActQuest"
                    value={selectedUser.username || ''}
                    onChange={(event) => handleEditFieldChange('username', event.target.value)}
                    placeholder="Например, quest_master"
                  />
                  <CabinetInputField
                    id="user-edit-phone"
                    label="Телефон"
                    type="tel"
                    value={formatPhoneInput(selectedUser.phone || '')}
                    onChange={(event) =>
                      handleEditFieldChange(
                        'phone',
                        formatPhoneInput(event.target.value),
                      )
                    }
                    placeholder="+7"
                  />
                </div>
                <CabinetSelectField
                  id="user-edit-location"
                  label="Город пользователя"
                  value={selectedUser.currentLocation || ''}
                  onChange={(event) =>
                    handleEditFieldChange('currentLocation', event.target.value)
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
                  <label className={modalItemSmallTitleClass}>
                    Фото профиля
                  </label>
                  <ImagesInput
                    images={selectedUser.photoUrl ? [selectedUser.photoUrl] : []}
                    onChange={(nextImages) =>
                      handleEditFieldChange('photoUrl', nextImages?.[0] ?? '')
                    }
                    directory="users"
                    imageName={selectedUser.id || 'user'}
                    maxImages={1}
                    previewShape="circle"
                  />
                </div>

                <CabinetTextareaField
                  id="user-edit-about"
                  label="О себе"
                  value={selectedUser.about || ''}
                  onChange={(event) => handleEditFieldChange('about', event.target.value)}
                  rows={5}
                  placeholder="Расскажите об опыте, любимых форматах и роли в команде."
                />

                <CabinetSelectField
                  id="user-role"
                  label="Роль в системе"
                  value={selectedUser.role}
                  onChange={(event) => handleRoleChange(event.target.value)}
                  labelClassName={modalItemSmallTitleClass}
                  selectClassName="w-full px-4 py-3 text-sm border rounded-xl border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {editRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
                </CabinetSelectField>

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
                  <CabinetButton
                    onClick={handleRequestPhoneViaTelegram}
                    disabled={
                      !location ||
                      !selectedUser.telegramId ||
                      isRequestingPhone
                    }
                    variant="secondary"
                    tone="success"
                    className={isRequestingPhone ? 'cursor-wait' : ''}
                  >
                    {isRequestingPhone
                      ? 'Отправка...'
                      : 'Запросить номер телефона через Telegram'}
                  </CabinetButton>
                </div>
              </FormSectionCard>
            </div>
          ) : null}
        </Modal>
        <Modal
          isOpen={isUserPushModalOpen && Boolean(selectedUserForPush)}
          onClose={closeUserPushModal}
          title={`Push пользователю — ${selectedUserForPush?.name || 'Без имени'}`}
          footer={(
            <>
              <CabinetButton
                type="button"
                variant="secondary"
                tone="brand"
                onClick={closeUserPushModal}
                disabled={isUserPushSubmitting}
              >
                Отмена
              </CabinetButton>
              <CabinetButton
                type="button"
                variant="primary"
                onClick={handleSubmitUserPushMessage}
                disabled={isUserPushSubmitting}
                className={isUserPushSubmitting ? 'cursor-wait' : ''}
              >
                {isUserPushSubmitting ? 'Отправка…' : 'Отправить'}
              </CabinetButton>
            </>
          )}
        >
          <div className="space-y-4">
            <CabinetTextareaField
              id="admin-user-push-message"
              label="Сообщение"
              value={userPushMessage}
              onChange={(event) => setUserPushMessage(event.target.value)}
              rows={5}
              placeholder="Введите сообщение для push-уведомления пользователю"
            />
            {userPushFeedback ? (
              <NoticeBanner tone="error" variant="neon">
                {userPushFeedback.message}
              </NoticeBanner>
            ) : null}
          </div>
        </Modal>
        <Modal
          isOpen={isUserGamesModalOpen}
          onClose={closeUserGamesModal}
          title={`Игры участия — ${userGamesState.userName || 'Пользователь'}`}
        >
          {userGamesState.isLoading ? (
            <p className="text-sm text-slate-500">Загружаем список игр...</p>
          ) : userGamesState.error ? (
            <p className="text-sm text-rose-500">{userGamesState.error}</p>
          ) : userGamesState.games.length > 0 ? (
            <ul className="space-y-3">
              {userGamesState.games.map((game) => (
                <li key={game.id}>
                  <ParticipationGameCard
                    game={game}
                    onOpen={handleOpenParticipationGame}
                    showPlace
                    showLocation
                    locationLabel={resolveLocationLabel(game.location)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              У пользователя пока нет игр участия через команды.
            </p>
          )}
        </Modal>
        <TeamDescriptionModal
          isOpen={isUserTeamModalOpen}
          onClose={closeUserTeamModal}
          selectedTeam={selectedUserTeam}
          onOpenMember={handleOpenMemberProfile}
          onOpenGame={handleOpenParticipationGame}
        />
        <Modal
          isOpen={isParticipationGameLoading}
          onClose={() => setIsParticipationGameLoading(false)}
          title="Игра"
        >
          <p className="text-sm text-slate-500">Загружаем подробности игры...</p>
        </Modal>
        <UnifiedGameDescriptionModal
          selectedGame={selectedParticipationGame}
          isOpen={isParticipationGameModalOpen}
          onClose={closeParticipationGameModal}
          canViewRestrictedGameInfo
          canViewGameResults={Boolean(
            selectedParticipationGame?.status === 'closed' ||
            selectedParticipationGame?.status === 'finished'
          )}
        />
      </CabinetLayout>
    </>
  )
}

const userTeamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  image: PropTypes.string,
  role: PropTypes.string,
  isCaptain: PropTypes.bool,
  gamesCount: PropTypes.number,
  updatedAt: PropTypes.string,
})

const userShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  globalUserId: PropTypes.string,
  telegramId: PropTypes.string,
  name: PropTypes.string,
  username: PropTypes.string,
  phone: PropTypes.string,
  currentLocation: PropTypes.string,
  role: PropTypes.string,
  about: PropTypes.string,
  preferences: PropTypes.arrayOf(PropTypes.string),
  createdAt: PropTypes.string,
  updatedAt: PropTypes.string,
  teams: PropTypes.arrayOf(userTeamShape),
  teamsCount: PropTypes.number,
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
})

ManageUsersPage.propTypes = {
  initialUsers: PropTypes.arrayOf(userShape),
  initialHasMore: PropTypes.bool,
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

ManageUsersPage.defaultProps = {
  initialUsers: [],
  initialHasMore: false,
  initialLocation: null,
  session: null,
}

export default ManageUsersPage
