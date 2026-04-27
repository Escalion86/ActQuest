'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

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
import UserViewModal from '@components/cabinet/modals/UserViewModal'
import UserEditModal from '@components/cabinet/modals/UserEditModal'
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
  const key =
    typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''
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

const buildAdminUsersQueryKey = ({
  searchQuery,
  roleFilter,
  locationFilter,
  sortBy,
  withoutPhoneOnly,
}) => [
  'admin-users',
  {
    search: searchQuery || '',
    role: roleFilter || 'all',
    location: locationFilter || 'all',
    sortBy: sortBy || 'registration_desc',
    withoutPhoneOnly: Boolean(withoutPhoneOnly),
  },
]

const fetchAdminUsersPage = async ({
  pageParam = 0,
  searchQuery,
  roleFilter,
  locationFilter,
  sortBy,
  withoutPhoneOnly,
}) => {
  const params = new URLSearchParams({
    offset: String(pageParam),
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
  if (withoutPhoneOnly) {
    params.set('withoutPhoneOnly', '1')
  }

  const { json } = await requestApiJson(
    `${CABINET_ADMIN_API_BASE}/users-list?${params.toString()}`,
    {
      fallbackMessage: 'Не удалось загрузить пользователей',
    },
  )

  return {
    users: Array.isArray(json?.data) ? json.data : [],
    hasMore: Boolean(json?.meta?.hasMore),
  }
}

const mapAdminUsersQueryData = (queryData, mapper) => {
  if (!queryData || !Array.isArray(queryData.pages)) {
    return queryData
  }

  return {
    ...queryData,
    pages: queryData.pages.map((page) => ({
      ...page,
      users: Array.isArray(page?.users) ? page.users.map(mapper) : [],
    })),
  }
}

const saveAdminUser = async (user) => {
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
    role: user.role,
    name: normalizeText(user.name),
    username: normalizeNullable(user.username),
    photoUrl: normalizeNullable(user.photoUrl),
    phone: normalizePhone(user.phone),
    currentLocation: normalizeNullable(user.currentLocation),
    about: normalizeText(user.about),
    preferences: Array.isArray(user.preferences)
      ? Array.from(
          new Set(
            user.preferences
              .map((item) => normalizeText(item))
              .filter((item) => item.length > 0),
          ),
        )
      : [],
  }

  const { json } = await requestApiJson(
    `${CABINET_ADMIN_API_BASE}/users/${user.id}`,
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
  const baseProfile = normalizeUserProfile(updatedDoc)

  return {
    ...cloneUser(user),
    ...baseProfile,
    telegramId: Number.isFinite(updatedDoc?.telegramId)
      ? String(updatedDoc.telegramId)
      : user.telegramId,
    role: ensureRole(updatedDoc?.role),
    createdAt: ensureDateISOString(updatedDoc?.createdAt) ?? user.createdAt,
    updatedAt:
      ensureDateISOString(updatedDoc?.updatedAt) ?? new Date().toISOString(),
  }
}

const requestUserPhoneViaTelegram = async (user) => {
  await requestApiJson(`${CABINET_USERS_API_BASE}/request-phone`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: user.globalUserId || user.id,
    }),
    fallbackMessage: 'Не удалось отправить запрос номера через Telegram',
  })
}

const sendAdminUserPushMessage = async ({ userId, message }) => {
  const { json } = await requestApiJson(`${CABINET_ADMIN_API_BASE}/user-push`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      message,
    }),
    fallbackMessage: 'Не удалось отправить push-уведомление',
  })

  return {
    created: Number(json?.data?.created || 0),
    delivered: Number(json?.data?.delivered || 0),
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
  const queryClient = useQueryClient()
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
  const [selectedUserId, setSelectedUserId] = useState(
    safeInitialUsers[0]?.id ?? null,
  )
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [sortBy, setSortBy] = useState('registration_desc')
  const [withoutPhoneOnly, setWithoutPhoneOnly] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [isUserViewModalOpen, setIsUserViewModalOpen] = useState(false)
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false)
  const [isUserGamesModalOpen, setIsUserGamesModalOpen] = useState(false)
  const [isUserPushModalOpen, setIsUserPushModalOpen] = useState(false)
  const [isUserTeamModalOpen, setIsUserTeamModalOpen] = useState(false)
  const [isParticipationGameModalOpen, setIsParticipationGameModalOpen] =
    useState(false)
  const [isParticipationGameLoading, setIsParticipationGameLoading] =
    useState(false)
  const [selectedParticipationGame, setSelectedParticipationGame] =
    useState(null)
  const [selectedUserTeam, setSelectedUserTeam] = useState(null)
  const [selectedUserForPush, setSelectedUserForPush] = useState(null)
  const [userPushMessage, setUserPushMessage] = useState('')
  const [userPushFeedback, setUserPushFeedback] = useState(null)

  // Отслеживаем предыдущий userId из URL чтобы избежать race condition при закрытии модалки
  const prevUserIdFromUrlRef = useRef(null)
  // Флаг чтобы отметить что мы намеренно закрываем модалку (не позволяет переоткрыть на race condition)
  const isIntentionallyCLosingModalRef = useRef(false)
  // Флаг чтобы отметить что мы намеренно открываем модалку (не позволяет закрыть на race condition)
  const isIntentionallyOpeningModalRef = useRef(false)
  const isDefaultUsersQuery =
    !searchQuery &&
    roleFilter === 'all' &&
    locationFilter === 'all' &&
    sortBy === 'registration_desc' &&
    !withoutPhoneOnly
  const usersQuery = useInfiniteQuery({
    queryKey: buildAdminUsersQueryKey({
      searchQuery,
      roleFilter,
      locationFilter,
      sortBy,
      withoutPhoneOnly,
    }),
    queryFn: ({ pageParam }) =>
      fetchAdminUsersPage({
        pageParam,
        searchQuery,
        roleFilter,
        locationFilter,
        sortBy,
        withoutPhoneOnly,
      }),
    enabled: isAdmin,
    initialPageParam: 0,
    initialData: isDefaultUsersQuery
      ? {
          pages: [
            {
              users: safeInitialUsers,
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
          total + (Array.isArray(page?.users) ? page.users.length : 0),
        0,
      )
    },
  })
  const hasMoreUsers = Boolean(usersQuery.hasNextPage)
  const isLoadingMoreUsers = usersQuery.isFetchingNextPage
  const isUsersSearching = usersQuery.isFetching && !usersQuery.isFetchingNextPage

  const applyPersistedUserUpdate = useCallback(
    (userId, updater) => {
      const applyUpdate = (user) => {
        if (user.id !== userId) {
          return user
        }

        const updatedUser =
          typeof updater === 'function' ? updater(user) : updater
        return cloneUser(updatedUser)
      }

      setUsers((prevUsers) => prevUsers.map(applyUpdate))
      setPersistedUsers((prevUsers) => prevUsers.map(applyUpdate))
      queryClient.setQueriesData({ queryKey: ['admin-users'] }, (queryData) =>
        mapAdminUsersQueryData(queryData, applyUpdate),
      )
    },
    [queryClient],
  )

  const saveUserMutation = useMutation({
    mutationFn: saveAdminUser,
    onMutate: () => {
      setFeedback(null)
    },
    onSuccess: (updatedUser) => {
      applyPersistedUserUpdate(updatedUser.id, updatedUser)
      setFeedback({
        type: 'success',
        message: 'Данные пользователя обновлены',
      })
    },
    onError: (error) => {
      console.error('Failed to update user role', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить изменения',
      })
    },
  })

  const requestPhoneMutation = useMutation({
    mutationFn: requestUserPhoneViaTelegram,
    onMutate: () => {
      setFeedback(null)
    },
    onSuccess: () => {
      setFeedback({
        type: 'success',
        message:
          'Запрос номера отправлен пользователю в Telegram. Ожидаем отправку контакта.',
      })
    },
    onError: (error) => {
      console.error('Failed to request phone via Telegram', error)
      setFeedback({
        type: 'error',
        message:
          error?.message || 'Не удалось отправить запрос номера через Telegram',
      })
    },
  })

  const userPushMutation = useMutation({
    mutationFn: sendAdminUserPushMessage,
    onMutate: () => {
      setUserPushFeedback(null)
    },
    onSuccess: ({ created, delivered }) => {
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
    },
    onError: (error) => {
      const messageText =
        error?.message || 'Не удалось отправить push-уведомление'
      setUserPushFeedback({
        type: 'error',
        message: messageText,
      })
      setFeedback({
        type: 'error',
        message: messageText,
      })
    },
  })

  const isSaving = saveUserMutation.isPending
  const isRequestingPhone = requestPhoneMutation.isPending
  const isUserPushSubmitting = userPushMutation.isPending

  useEffect(() => {
    const nextUsers = (usersQuery.data?.pages || []).flatMap((page) =>
      Array.isArray(page?.users) ? page.users : [],
    )
    setUsers(nextUsers)
    setPersistedUsers(nextUsers)
    setSelectedUserId((prev) => {
      if (prev && nextUsers.some((user) => user.id === prev)) {
        return prev
      }

      return nextUsers[0]?.id ?? null
    })
  }, [usersQuery.data])

  useEffect(() => {
    if (!usersQuery.error) return
    setFeedback({
      type: 'error',
      message: usersQuery.error?.message || 'Не удалось загрузить пользователей',
    })
  }, [usersQuery.error])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log(
        '[AdminUsers] Setting searchQuery from searchInput:',
        searchInput,
      )
      setSearchQuery(searchInput.trim())
    }, 450)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [searchInput])

  const setUserIdQuery = useCallback(
    (nextUserId) => {
      console.log(
        '[AdminUsers] setUserIdQuery called with:',
        nextUserId,
        'current searchParams:',
        searchParams?.toString(),
      )

      // Если удаляем userId, отметить что это намеренное закрытие модалки
      // Флаг НЕ сбрасывать - пусть остаётся пока эффект не обработает новый searchParams
      if (!nextUserId) {
        isIntentionallyCLosingModalRef.current = true
      }

      const nextQuery = new URLSearchParams(searchParams?.toString() || '')
      if (nextUserId) {
        nextQuery.set('userId', nextUserId)
      } else {
        nextQuery.delete('userId')
      }

      const nextUrl = nextQuery.toString()
        ? `${pathname}?${nextQuery.toString()}`
        : pathname
      console.log('[AdminUsers] Navigating to:', nextUrl)
      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const updateSearchQueryInUrl = useCallback(
    (nextSearchQuery) => {
      console.log(
        '[AdminUsers] updateSearchQueryInUrl called with:',
        nextSearchQuery,
        'current searchParams:',
        searchParams?.toString(),
      )
      const nextQuery = new URLSearchParams(searchParams?.toString() || '')
      if (nextSearchQuery && nextSearchQuery.trim()) {
        nextQuery.set('q', nextSearchQuery.trim())
      } else {
        nextQuery.delete('q')
      }

      const nextUrl = nextQuery.toString()
        ? `${pathname}?${nextQuery.toString()}`
        : pathname
      console.log('[AdminUsers] Updating search in URL to:', nextUrl)
      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const closeUserEditModal = useCallback(() => {
    setIsUserEditModalOpen(false)
  }, [])

  const closeUserTeamModal = useCallback(() => {
    setIsUserTeamModalOpen(false)
    setSelectedUserTeam(null)
  }, [])

  const closeUserViewModal = useCallback(() => {
    console.log(
      '[AdminUsers] Closing view modal, current searchInput:',
      searchInput,
      'searchQuery:',
      searchQuery,
    )
    setIsUserViewModalOpen(false)
    closeUserTeamModal()
    setUserIdQuery(null)
  }, [closeUserTeamModal, setUserIdQuery, searchInput, searchQuery])

  useEffect(() => {
    console.log(
      '[AdminUsers] searchQuery changed:',
      searchQuery,
      'current URL q param:',
      searchParams?.get('q'),
    )
    // Синхронизируем searchQuery с URL параметром q
    const urlQParam = searchParams?.get('q') ?? ''
    if (searchQuery !== urlQParam) {
      console.log(
        '[AdminUsers] searchQuery differs from URL, updating - old:',
        urlQParam,
        'new:',
        searchQuery,
      )
      updateSearchQueryInUrl(searchQuery)
    }
  }, [searchQuery, searchParams, updateSearchQueryInUrl])

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
        baseOptions.push({
          value: user.role,
          name: CABINET_ROLE_LABELS[user.role] ?? user.role,
        })
        knownRoles.add(user.role)
      }
    })

    return baseOptions
  }, [users])

  const editRoleOptions = useMemo(
    () => roleOptions.filter((option) => option.value !== 'dev' || isDeveloper),
    [isDeveloper, roleOptions],
  )

  // Эффект для закрытия модалей только если список пользователей пустой
  useEffect(() => {
    console.log(
      '[AdminUsers] Effect: checking if users list is empty - users.length:',
      users.length,
    )

    if (users.length === 0) {
      console.log(
        '[AdminUsers] No users (length=0), clearing selectedUserId and closing modals',
      )
      setSelectedUserId(null)
      setIsUserViewModalOpen(false)
      setIsUserEditModalOpen(false)
    }
  }, [users.length]) // Зависит только от длины, чтобы не создавать цикл

  // Эффект для выбора пользователя из списка (если нет открытой модали)
  useEffect(() => {
    console.log(
      '[AdminUsers] Effect: users or selectedUserId changed - users.length:',
      users.length,
      'selectedUserId:',
      selectedUserId,
    )

    if (users.length === 0) {
      console.log('[AdminUsers] Empty users list, skipping selection')
      return
    }

    // Если модаль открыта, не меняем выбор
    if (isUserViewModalOpen || isUserEditModalOpen) {
      console.log('[AdminUsers] Modal is open, not changing selection')
      return
    }

    // Если пользователь уже выбран и он есть в списке, то ничего не меняем
    if (selectedUserId && users.some((user) => user.id === selectedUserId)) {
      console.log(
        '[AdminUsers] Selected user still in list, keeping selection:',
        selectedUserId,
      )
      return
    }

    // Выбираем первого пользователя
    console.log('[AdminUsers] Selecting first user from new list')
    setSelectedUserId(users[0]?.id ?? null)
  }, [users, selectedUserId, isUserViewModalOpen, isUserEditModalOpen])

  // Загрузить пользователя из URL параметра userId при загрузке страницы
  useEffect(() => {
    if (!isAdmin) {
      return undefined
    }

    const userIdFromUrl = searchParams?.get('userId')
    if (!userIdFromUrl) {
      return undefined
    }

    // Проверить, загружен ли этот пользователь уже
    const userAlreadyLoaded = persistedUsers.some(
      (user) => user.id === userIdFromUrl,
    )
    if (userAlreadyLoaded) {
      setSelectedUserId(userIdFromUrl)
      setIsUserViewModalOpen(true)
      return undefined
    }

    let cancelled = false

    const loadUserFromUrl = async () => {
      try {
        const userData = await fetchCabinetUserDetails({
          userId: userIdFromUrl,
        })

        if (cancelled) {
          return
        }

        if (userData && userData.id) {
          setPersistedUsers((prev) => {
            const alreadyExists = prev.some((user) => user.id === userData.id)
            if (alreadyExists) {
              return prev
            }
            return [userData, ...prev]
          })
          setUsers((prev) => {
            const alreadyExists = prev.some((user) => user.id === userData.id)
            if (alreadyExists) {
              return prev
            }
            return [userData, ...prev]
          })
          setSelectedUserId(userData.id)
          setIsUserViewModalOpen(true)
        }
      } catch (error) {
        console.error('Failed to load user from URL', error)
      }
    }

    loadUserFromUrl()

    return () => {
      cancelled = true
    }
  }, [isAdmin, searchParams])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  )

  const persistedSelectedUser = useMemo(
    () => persistedUsers.find((user) => user.id === selectedUserId) ?? null,
    [persistedUsers, selectedUserId],
  )
  const isUsersListLoading = isUsersSearching && users.length === 0

  useEffect(() => {
    console.log(
      '[AdminUsers] Modal state changed - View:',
      isUserViewModalOpen,
      'Edit:',
      isUserEditModalOpen,
      'selectedUserId:',
      selectedUserId,
    )
  }, [isUserViewModalOpen, isUserEditModalOpen])

  useEffect(() => {
    console.log(
      '[AdminUsers] selectedUserId changed:',
      selectedUserId,
      'isUserViewModalOpen:',
      isUserViewModalOpen,
      'isUserEditModalOpen:',
      isUserEditModalOpen,
    )
  }, [selectedUserId, isUserViewModalOpen, isUserEditModalOpen])

  useEffect(() => {
    setFeedback(null)
  }, [selectedUserId])

  const handleOpenUserViewModal = useCallback(
    (user) => {
      if (!user) {
        return
      }

      console.log(
        '[AdminUsers] Opening view modal for user:',
        user.id,
        user.name,
      )
      // Отметить что мы намеренно открываем модалку (флаг не сбрасывать до обновления URL)
      isIntentionallyOpeningModalRef.current = true
      setSelectedUserId(user.id)
      setIsUserEditModalOpen(false)
      setIsUserViewModalOpen(true)
      console.log('[AdminUsers] Setting URL query with userId:', user.id)
      setUserIdQuery(user.id)
    },
    [setUserIdQuery],
  )

  const handleOpenUserEditModal = useCallback(
    (user) => {
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
    },
    [isDeveloper],
  )

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

    const message =
      typeof userPushMessage === 'string' ? userPushMessage.trim() : ''
    if (!message) {
      setUserPushFeedback({
        type: 'error',
        message: 'Введите сообщение для отправки',
      })
      return
    }

    userPushMutation.mutate({
      userId: selectedUserForPush.id,
      message,
    })
  }, [selectedUserForPush, userPushMessage, userPushMutation])

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
        gameOrId && typeof gameOrId === 'object' ? gameOrId : null

      const hasDetailedFields =
        gameFromState &&
        (Object.prototype.hasOwnProperty.call(
          gameFromState,
          'descriptionRich',
        ) ||
          Object.prototype.hasOwnProperty.call(
            gameFromState,
            'startingPlace',
          ) ||
          Object.prototype.hasOwnProperty.call(gameFromState, 'prices'))

      setIsUserTeamModalOpen(false)
      setIsParticipationGameLoading(true)
      setFeedback(null)
      try {
        const detailedGame = hasDetailedFields
          ? gameFromState
          : await fetchCabinetGameDetails({
              gameId,
              location: location || null,
            })
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
    [location],
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
        return prevUsers.map((item) =>
          item.id === userPatch.id
            ? { ...item, ...fallbackUser, ...userPatch }
            : item,
        )
      }

      return [{ ...fallbackUser, ...userPatch }, ...prevUsers]
    })

    return userPatch.id
  }, [])

  const handleOpenUserTeamModal = useCallback(async (team) => {
    const teamId =
      (typeof team?.id === 'string' && team.id.trim()) ||
      (typeof team?.teamId === 'string' && team.teamId.trim()) ||
      ''

    if (!teamId) {
      return
    }

    setFeedback(null)

    try {
      const detailedTeam = await fetchCabinetTeamDetails({ teamId })

      setSelectedUserTeam(detailedTeam)
      setIsUserTeamModalOpen(true)
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось загрузить команду',
      })
    }
  }, [])

  const handleOpenMemberProfile = useCallback(
    async (member) => {
      if (!member) {
        return
      }

      const nextUserId =
        typeof member.userId === 'string' && member.userId
          ? member.userId
          : null

      if (!nextUserId) {
        return
      }

      let loadedUser = null
      try {
        loadedUser = await fetchCabinetUserDetails({
          userId: nextUserId || '',
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
        },
      )

      setSelectedUserId(nextUserId)
      setIsUserTeamModalOpen(false)
      setIsUserEditModalOpen(false)
      setIsUserViewModalOpen(true)
      setUserIdQuery(nextUserId)
    },
    [ensureUserInState, setUserIdQuery],
  )

  useEffect(() => {
    console.log(
      '[AdminUsers] useEffect on searchParams - URL userId:',
      searchParams?.get('userId'),
      'modal open:',
      isUserViewModalOpen,
      'selectedUserId:',
      selectedUserId,
      'intentionalClose flag:',
      isIntentionallyCLosingModalRef.current,
      'intentionalOpen flag:',
      isIntentionallyOpeningModalRef.current,
    )

    // Если в процессе намеренного закрытия, просто закрыть модалку и не открывать её заново
    if (isIntentionallyCLosingModalRef.current) {
      console.log('[AdminUsers] In intentional close mode, closing modal')
      setIsUserViewModalOpen(false)
      const userIdFromQuery = searchParams?.get('userId')
      // Сбросить флаг когда userId будет удален из URL
      if (!userIdFromQuery) {
        console.log(
          '[AdminUsers] userId removed from URL, resetting intentional close flag',
        )
        isIntentionallyCLosingModalRef.current = false
      }
      return
    }

    const userIdFromQuery = searchParams?.get('userId')
    const wasUserIdInUrl = prevUserIdFromUrlRef.current !== null
    const isUserIdRemovedFromUrl = wasUserIdInUrl && !userIdFromQuery

    // Обновляем ref для следующего вызова
    prevUserIdFromUrlRef.current = userIdFromQuery

    if (!userIdFromQuery || typeof userIdFromQuery !== 'string') {
      // Если в процессе намеренного открытия, НЕ закрывать модалку даже если userId нету в URL
      // (URL скоро обновится с новым userId)
      if (isIntentionallyOpeningModalRef.current) {
        console.log(
          '[AdminUsers] In intentional open mode, keeping modal open despite missing userId in URL',
        )
        return
      }

      console.log('[AdminUsers] No userId in URL, closing modal')
      setIsUserViewModalOpen(false)
      return
    }

    // Если userId появился в URL и мы были в режиме "намеренного открытия", сбросить флаг
    if (isIntentionallyOpeningModalRef.current) {
      console.log(
        '[AdminUsers] userId appeared in URL, resetting intentional open flag',
      )
      isIntentionallyOpeningModalRef.current = false
    }

    // Если модаль уже открыта с этим пользователем, ничего не меняем
    if (isUserViewModalOpen && selectedUserId === userIdFromQuery) {
      console.log(
        '[AdminUsers] Modal already open with correct user, keeping it open',
      )
      return
    }

    // Если пользователь уже выбран но модаль не открыта, открываем
    if (selectedUserId === userIdFromQuery && !isUserViewModalOpen) {
      console.log('[AdminUsers] User already selected, opening modal')
      setIsUserViewModalOpen(true)
      return
    }

    // Иначе обновляем выбор и открываем модаль
    console.log(
      '[AdminUsers] Setting new user and opening modal:',
      userIdFromQuery,
    )
    setSelectedUserId(userIdFromQuery)
    setIsUserEditModalOpen(false)
    setIsUserViewModalOpen(true)
  }, [searchParams, isUserViewModalOpen, selectedUserId])

  const isDirty = useMemo(() => {
    if (!selectedUser || !persistedSelectedUser) {
      return false
    }

    const sanitizeText = (value) =>
      typeof value === 'string' ? value.trim() : ''
    const sanitizeNullable = (value) => {
      const normalized = sanitizeText(value)
      return normalized.length > 0 ? normalized : null
    }
    const normalizePreferences = (value) =>
      Array.isArray(value)
        ? Array.from(
            new Set(value.map((item) => sanitizeText(item)).filter(Boolean)),
          ).sort()
        : []

    return (
      JSON.stringify({
        role: selectedUser.role,
        name: sanitizeText(selectedUser.name),
        username: sanitizeNullable(selectedUser.username),
        photoUrl: sanitizeNullable(selectedUser.photoUrl),
        currentLocation: sanitizeNullable(selectedUser.currentLocation),
        about: sanitizeText(selectedUser.about),
        preferences: normalizePreferences(selectedUser.preferences),
      }) !==
      JSON.stringify({
        role: persistedSelectedUser.role,
        name: sanitizeText(persistedSelectedUser.name),
        username: sanitizeNullable(persistedSelectedUser.username),
        photoUrl: sanitizeNullable(persistedSelectedUser.photoUrl),
        currentLocation: sanitizeNullable(
          persistedSelectedUser.currentLocation,
        ),
        about: sanitizeText(persistedSelectedUser.about),
        preferences: normalizePreferences(persistedSelectedUser.preferences),
      })
    )
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
            : user,
        ),
      )
    },
    [selectedUserId],
  )

  const handleRoleChange = useCallback(
    (role) => {
      if (!selectedUserId) {
        return
      }

      if (!isDeveloper && role === 'dev') {
        setFeedback({
          type: 'error',
          message: 'Только разработчик может назначать роль «Разработчик».',
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
            : user,
        ),
      )
    },
    [isDeveloper, selectedUserId],
  )

  const handleReset = useCallback(() => {
    if (!selectedUserId || !persistedSelectedUser) {
      return
    }

    const snapshot = cloneUser(persistedSelectedUser)

    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === selectedUserId && snapshot ? snapshot : user,
      ),
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
        message: 'Только разработчик может назначать роль «Разработчик».',
      })
      return
    }

    if (!isDirty) {
      return
    }

    saveUserMutation.mutate(selectedUser)
  }, [
    isDeveloper,
    isDirty,
    persistedSelectedUser,
    saveUserMutation,
    selectedUser,
  ])

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

    requestPhoneMutation.mutate(selectedUser)
  }, [isRequestingPhone, location, requestPhoneMutation, selectedUser])

  const handleLoadMoreUsers = useCallback(async () => {
    if (isLoadingMoreUsers || !hasMoreUsers) {
      return
    }

    setFeedback(null)
    try {
      await usersQuery.fetchNextPage()
    } catch (error) {
      console.error('Failed to load more users', error)
      setFeedback({
        type: 'error',
        message:
          error?.message || 'Не удалось загрузить дополнительных пользователей',
      })
    }
  }, [hasMoreUsers, isLoadingMoreUsers, usersQuery])

  const filterOptions = useMemo(
    () => [
      { value: 'all', name: 'Все роли' },
      ...roleOptions.map((option) => ({
        value: option.value,
        name: option.name,
      })),
    ],
    [roleOptions],
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
    () => [{ value: 'all', name: 'Все города' }, ...locationOptions],
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
              У вас нет доступа к управлению пользователями. Если вы считаете,
              что это ошибка, обратитесь к главному организатору.
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
          <div className="space-y-4 md:col-span-5">
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

              <label
                htmlFor="user-without-phone-only"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
              >
                <input
                  id="user-without-phone-only"
                  type="checkbox"
                  checked={withoutPhoneOnly}
                  onChange={(event) => setWithoutPhoneOnly(event.target.checked)}
                  className="h-4 w-4"
                />
                <span>Показать только без указанного номера телефона</span>
              </label>
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
                          onOpenEdit={handleOpenUserEditModal}
                          onOpenPush={handleOpenUserPushModal}
                          showMissingPhoneIndicator={isAdmin || isDeveloper}
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
                      isLoadingMoreUsers ? 'cursor-wait' : 'cursor-pointer'
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
                Пользователи не найдены. Измените параметры фильтра или сбросьте
                поиск.
              </FormSectionCard>
            )}
          </div>
        </section>

        <UserViewModal
          userId={selectedUserId}
          isOpen={isUserViewModalOpen}
          onClose={closeUserViewModal}
          canViewContacts={isAdmin || isDeveloper}
          onOpenTeam={handleOpenUserTeamModal}
        />

        <UserEditModal
          userId={selectedUserId}
          isOpen={isUserEditModalOpen}
          onClose={closeUserEditModal}
        />

        <Modal
          isOpen={isUserPushModalOpen && Boolean(selectedUserForPush)}
          onClose={closeUserPushModal}
          title={`Push пользователю — ${selectedUserForPush?.name || 'Без имени'}`}
          footer={
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
          }
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
        {/* <Modal
          isOpen={isUserGamesModalOpen}
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
        </Modal> */}
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
          <p className="text-sm text-slate-500">
            Загружаем подробности игры...
          </p>
        </Modal>
        <UnifiedGameDescriptionModal
          selectedGame={selectedParticipationGame}
          isOpen={isParticipationGameModalOpen}
          onClose={closeParticipationGameModal}
          canViewRestrictedGameInfo
          canViewGameResults={Boolean(
            selectedParticipationGame?.status === 'closed' ||
            selectedParticipationGame?.status === 'finished',
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
