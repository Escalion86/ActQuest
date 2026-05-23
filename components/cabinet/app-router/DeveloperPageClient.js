'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import Modal from '@components/Modal'
import useMergedSession from '@helpers/useMergedSession'
import { LOCATIONS } from '@server/serverConstants'

const CABINET_DEV_API_BASE = '/api/cabinet/dev'
const CABINET_USERS_API_BASE = '/api/cabinet/users'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const extractFilenameFromContentDisposition = (headerValue) => {
  if (typeof headerValue !== 'string' || headerValue.trim() === '') {
    return null
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }

  const filenameMatch = headerValue.match(/filename="([^"]+)"/i)
  if (filenameMatch?.[1]) {
    return filenameMatch[1].trim()
  }

  return null
}

const broadcastLocationOptions = [
  { value: 'all', label: 'Во все города' },
  ...Object.entries(LOCATIONS)
    .filter(([, config]) => !config?.hidden)
    .map(([locationKey, config]) => ({
      value: locationKey,
      label:
        typeof config?.townRu === 'string' && config.townRu.trim().length > 0
          ? config.townRu.charAt(0).toUpperCase() + config.townRu.slice(1)
          : locationKey.toUpperCase(),
    })),
]

const DeveloperPage = ({ session: initialSession }) => {
  const router = useRouter()
  const { activeSession } = useMergedSession(initialSession)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isExportingGameTasks, setIsExportingGameTasks] = useState(false)
  const [isClosingFinished, setIsClosingFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [exportGameTasksResult, setExportGameTasksResult] = useState(null)
  const [closeFinishedResult, setCloseFinishedResult] = useState(null)
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastLocation, setBroadcastLocation] = useState('all')
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [broadcastError, setBroadcastError] = useState('')
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [isLoadingUsersWithoutPhone, setIsLoadingUsersWithoutPhone] =
    useState(false)
  const [usersWithoutPhoneResult, setUsersWithoutPhoneResult] = useState(null)
  const [usersWithoutPhoneError, setUsersWithoutPhoneError] = useState('')
  const [isLoadingUsersWithDuplicatePhones, setIsLoadingUsersWithDuplicatePhones] =
    useState(false)
  const [usersWithDuplicatePhonesResult, setUsersWithDuplicatePhonesResult] =
    useState(null)
  const [usersWithDuplicatePhonesError, setUsersWithDuplicatePhonesError] =
    useState('')
  const [isPreviewingDuplicatePhoneByValue, setIsPreviewingDuplicatePhoneByValue] =
    useState({})
  const [duplicatePhonePreviewByValue, setDuplicatePhonePreviewByValue] =
    useState({})
  const [isApplyingDuplicatePhoneMergeByValue, setIsApplyingDuplicatePhoneMergeByValue] =
    useState({})
  const [mergeDuplicatePhoneFeedbackByValue, setMergeDuplicatePhoneFeedbackByValue] =
    useState({})
  const [isCheckingTeamsUsersIntegrity, setIsCheckingTeamsUsersIntegrity] =
    useState(false)
  const [teamsUsersIntegrityResult, setTeamsUsersIntegrityResult] =
    useState(null)
  const [teamsUsersIntegrityError, setTeamsUsersIntegrityError] = useState('')
  const [teamCaptainTeamIdFilter, setTeamCaptainTeamIdFilter] = useState('')
  const [isCheckingTeamCaptains, setIsCheckingTeamCaptains] = useState(false)
  const [isApplyingTeamCaptainRepair, setIsApplyingTeamCaptainRepair] =
    useState(false)
  const [teamCaptainsResult, setTeamCaptainsResult] = useState(null)
  const [teamCaptainsError, setTeamCaptainsError] = useState('')
  const [teamCaptainsFeedback, setTeamCaptainsFeedback] = useState('')
  const [exportGameTasksError, setExportGameTasksError] = useState('')
  const [requestingPhoneByUserId, setRequestingPhoneByUserId] = useState({})
  const [requestPhoneFeedbackByUserId, setRequestPhoneFeedbackByUserId] =
    useState({})
  const [error, setError] = useState('')

  // Состояния для режима impersonate
  const [impersonateUserId, setImpersonateUserId] = useState('')
  const [impersonateError, setImpersonateError] = useState('')
  const [isImpersonating, setIsImpersonating] = useState(false)

  const handleRecalculate = async () => {
    if (isRecalculating) {
      return
    }

    setIsRecalculating(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/recalculate-ratings`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось пересчитать рейтинг')
      }

      setResult(json?.data ?? null)
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось пересчитать рейтинг')
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleCloseFinishedGames = async () => {
    if (isClosingFinished) {
      return
    }

    setIsClosingFinished(true)
    setError('')
    setCloseFinishedResult(null)

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/close-finished-games`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось закрыть завершенные игры')
      }

      setCloseFinishedResult(json?.data ?? null)
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось закрыть завершенные игры')
    } finally {
      setIsClosingFinished(false)
    }
  }

  const handleExportGameTasks = async () => {
    if (isExportingGameTasks) {
      return
    }

    setIsExportingGameTasks(true)
    setExportGameTasksError('')
    setExportGameTasksResult(null)

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/recalculate-ratings?mode=export-game-tasks`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.ms-excel,application/json',
          },
        },
      )

      if (!response.ok) {
        let errorMessage = 'Не удалось выгрузить задания в Excel'
        try {
          const json = await response.json()
          if (json?.error) {
            errorMessage = json.error
          }
        } catch {
          // ignore json parse errors and keep fallback message
        }
        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition')
      const fileName =
        extractFilenameFromContentDisposition(disposition) ||
        `actquest-game-tasks-${new Date().toISOString().slice(0, 10)}.xls`
      const exportedRows = Number(response.headers.get('x-exported-rows')) || 0
      const exportedGames =
        Number(response.headers.get('x-exported-games')) || 0

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      setExportGameTasksResult({
        fileName,
        exportedRows,
        exportedGames,
      })
    } catch (requestError) {
      setExportGameTasksError(
        requestError?.message || 'Не удалось выгрузить задания в Excel',
      )
    } finally {
      setIsExportingGameTasks(false)
    }
  }

  const handleOpenBroadcastModal = () => {
    setBroadcastError('')
    setBroadcastResult(null)
    setBroadcastText('')
    setBroadcastLocation('all')
    setIsBroadcastModalOpen(true)
  }

  const handleCloseBroadcastModal = () => {
    if (isBroadcasting) {
      return
    }
    setIsBroadcastModalOpen(false)
  }

  const handleBroadcastMessage = async () => {
    if (isBroadcasting) {
      return
    }

    const text = broadcastText.trim()
    if (!text) {
      setBroadcastError('Введите текст сообщения')
      return
    }

    setIsBroadcasting(true)
    setBroadcastError('')
    setBroadcastResult(null)

    try {
      const response = await fetch(`${CABINET_DEV_API_BASE}/broadcast-bots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: text,
          location: broadcastLocation || 'all',
        }),
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось отправить рассылку')
      }

      setBroadcastResult(json?.data ?? null)
    } catch (requestError) {
      setBroadcastError(
        requestError?.message || 'Не удалось отправить рассылку',
      )
    } finally {
      setIsBroadcasting(false)
    }
  }

  const handleLoadUsersWithoutPhone = async () => {
    if (isLoadingUsersWithoutPhone) {
      return
    }

    setIsLoadingUsersWithoutPhone(true)
    setUsersWithoutPhoneError('')
    setUsersWithoutPhoneResult(null)

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/users-without-phone`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error || 'Не удалось проверить пользователей без телефона',
        )
      }

      setUsersWithoutPhoneResult(json?.data ?? null)
    } catch (requestError) {
      setUsersWithoutPhoneError(
        requestError?.message ||
          'Не удалось проверить пользователей без телефона',
      )
    } finally {
      setIsLoadingUsersWithoutPhone(false)
    }
  }

  const handleLoadUsersWithDuplicatePhones = async () => {
    if (isLoadingUsersWithDuplicatePhones) {
      return
    }

    setIsLoadingUsersWithDuplicatePhones(true)
    setUsersWithDuplicatePhonesError('')
    setUsersWithDuplicatePhonesResult(null)

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/users-duplicate-phones`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error ||
            'Не удалось проверить пользователей с дублирующимися телефонами',
        )
      }

      setUsersWithDuplicatePhonesResult(json?.data ?? null)
    } catch (requestError) {
      setUsersWithDuplicatePhonesError(
        requestError?.message ||
          'Не удалось проверить пользователей с дублирующимися телефонами',
      )
    } finally {
      setIsLoadingUsersWithDuplicatePhones(false)
    }
  }

  const handleExportDuplicatePhonesJson = () => {
    if (!usersWithDuplicatePhonesResult) {
      return
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      ...usersWithDuplicatePhonesResult,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `actquest-duplicate-phones-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const handlePreviewDuplicatePhoneGroup = async (phone) => {
    const normalizedPhone = Number(phone)
    if (!Number.isFinite(normalizedPhone) || normalizedPhone <= 0) {
      return
    }

    if (isPreviewingDuplicatePhoneByValue[normalizedPhone]) {
      return
    }

    setIsPreviewingDuplicatePhoneByValue((prev) => ({
      ...prev,
      [normalizedPhone]: true,
    }))
    setMergeDuplicatePhoneFeedbackByValue((prev) => ({
      ...prev,
      [normalizedPhone]: '',
    }))

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/users-duplicate-phones`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            phone: normalizedPhone,
            dryRun: true,
          }),
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось объединить дубликаты')
      }

      setDuplicatePhonePreviewByValue((prev) => ({
        ...prev,
        [normalizedPhone]: json?.data ?? null,
      }))
      setMergeDuplicatePhoneFeedbackByValue((prev) => ({
        ...prev,
        [normalizedPhone]: 'Проверка завершена. Можно применять объединение.',
      }))
    } catch (requestError) {
      setMergeDuplicatePhoneFeedbackByValue((prev) => ({
        ...prev,
        [normalizedPhone]:
          requestError?.message || 'Ошибка объединения дублирующихся аккаунтов',
      }))
    } finally {
      setIsPreviewingDuplicatePhoneByValue((prev) => ({
        ...prev,
        [normalizedPhone]: false,
      }))
    }
  }

  const handleMergeDuplicatePhoneGroup = async (phone) => {
    const normalizedPhone = Number(phone)
    if (!Number.isFinite(normalizedPhone) || normalizedPhone <= 0) {
      return
    }

    if (isApplyingDuplicatePhoneMergeByValue[normalizedPhone]) {
      return
    }

    if (!duplicatePhonePreviewByValue[normalizedPhone]) {
      setMergeDuplicatePhoneFeedbackByValue((prev) => ({
        ...prev,
        [normalizedPhone]:
          'Сначала нажмите "Проверить изменения", затем применяйте объединение.',
      }))
      return
    }

    const isConfirmed = window.confirm(
      `Применить объединение аккаунтов с номером +${normalizedPhone}? Будет оставлен самый новый профиль, старые удалятся.`,
    )
    if (!isConfirmed) {
      return
    }

    setIsApplyingDuplicatePhoneMergeByValue((prev) => ({
      ...prev,
      [normalizedPhone]: true,
    }))
    setMergeDuplicatePhoneFeedbackByValue((prev) => ({
      ...prev,
      [normalizedPhone]: '',
    }))

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/users-duplicate-phones`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            phone: normalizedPhone,
            dryRun: false,
            confirmApply: true,
          }),
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось объединить дубликаты')
      }

      const deletedUsersCount = Number(json?.data?.deletedUsersCount) || 0
      const movedMembershipsCount = Number(json?.data?.movedMembershipsCount) || 0
      const removedDuplicateMembershipsCount =
        Number(json?.data?.removedDuplicateMembershipsCount) || 0
      const updatedGamesCount = Number(json?.data?.updatedGamesCount) || 0

      setMergeDuplicatePhoneFeedbackByValue((prev) => ({
        ...prev,
        [normalizedPhone]: `Готово: удалено аккаунтов ${deletedUsersCount}, перенесено связей команд ${movedMembershipsCount}, удалено дублей связей ${removedDuplicateMembershipsCount}, обновлено игр ${updatedGamesCount}.`,
      }))

      setDuplicatePhonePreviewByValue((prev) => ({
        ...prev,
        [normalizedPhone]: null,
      }))

      await handleLoadUsersWithDuplicatePhones()
    } catch (requestError) {
      setMergeDuplicatePhoneFeedbackByValue((prev) => ({
        ...prev,
        [normalizedPhone]:
          requestError?.message || 'Ошибка объединения дублирующихся аккаунтов',
      }))
    } finally {
      setIsApplyingDuplicatePhoneMergeByValue((prev) => ({
        ...prev,
        [normalizedPhone]: false,
      }))
    }
  }

  const handleCheckTeamsUsersIntegrity = async () => {
    if (isCheckingTeamsUsersIntegrity) {
      return
    }

    setIsCheckingTeamsUsersIntegrity(true)
    setTeamsUsersIntegrityError('')
    setTeamsUsersIntegrityResult(null)

    try {
      const response = await fetch(
        `${CABINET_DEV_API_BASE}/teams-users-integrity`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error ||
            'Не удалось проверить целостность записей участников команд',
        )
      }

      setTeamsUsersIntegrityResult(json?.data ?? null)
    } catch (requestError) {
      setTeamsUsersIntegrityError(
        requestError?.message ||
          'Не удалось проверить целостность записей участников команд',
      )
    } finally {
      setIsCheckingTeamsUsersIntegrity(false)
    }
  }

  const handleCheckTeamCaptains = async () => {
    if (isCheckingTeamCaptains) {
      return
    }

    setIsCheckingTeamCaptains(true)
    setTeamCaptainsError('')
    setTeamCaptainsFeedback('')
    setTeamCaptainsResult(null)

    try {
      const params = new URLSearchParams()
      const teamId = teamCaptainTeamIdFilter.trim()
      if (teamId) {
        params.set('teamId', teamId)
      }
      params.set('limit', '200')

      const response = await fetch(
        `${CABINET_DEV_API_BASE}/team-captains?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        },
      )

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error || 'Не удалось проверить корректность капитанства',
        )
      }

      setTeamCaptainsResult(json?.data ?? null)
    } catch (requestError) {
      setTeamCaptainsError(
        requestError?.message || 'Не удалось проверить корректность капитанства',
      )
    } finally {
      setIsCheckingTeamCaptains(false)
    }
  }

  const handleApplyTeamCaptainRepair = async () => {
    if (isApplyingTeamCaptainRepair) {
      return
    }

    if (!teamCaptainsResult) {
      setTeamCaptainsFeedback('Сначала выполните проверку капитанства.')
      return
    }

    const isConfirmed = window.confirm(
      'Применить исправление капитанства для найденных команд? Операция обновит роли участников в TeamsUsers.',
    )
    if (!isConfirmed) {
      return
    }

    setIsApplyingTeamCaptainRepair(true)
    setTeamCaptainsError('')
    setTeamCaptainsFeedback('')

    try {
      const response = await fetch(`${CABINET_DEV_API_BASE}/team-captains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          teamId: teamCaptainTeamIdFilter.trim() || undefined,
          limit: 200,
          apply: true,
          confirmApply: true,
        }),
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error || 'Не удалось применить исправление капитанства',
        )
      }

      setTeamCaptainsResult(json?.data ?? null)
      setTeamCaptainsFeedback(
        `Готово: обновлено memberships ${json?.data?.summary?.membershipsUpdatedCount ?? 0}.`,
      )
    } catch (requestError) {
      setTeamCaptainsError(
        requestError?.message || 'Не удалось применить исправление капитанства',
      )
    } finally {
      setIsApplyingTeamCaptainRepair(false)
    }
  }

  const handleRequestPhoneForUser = async (userId) => {
    if (!userId || requestingPhoneByUserId[userId]) {
      return
    }

    setRequestingPhoneByUserId((prev) => ({
      ...prev,
      [userId]: true,
    }))
    setRequestPhoneFeedbackByUserId((prev) => ({
      ...prev,
      [userId]: '',
    }))

    try {
      const response = await fetch(`${CABINET_USERS_API_BASE}/request-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          userId,
        }),
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось отправить запрос номера')
      }

      setRequestPhoneFeedbackByUserId((prev) => ({
        ...prev,
        [userId]: 'Запрос отправлен',
      }))
    } catch (requestError) {
      setRequestPhoneFeedbackByUserId((prev) => ({
        ...prev,
        [userId]: requestError?.message || 'Ошибка отправки запроса',
      }))
    } finally {
      setRequestingPhoneByUserId((prev) => ({
        ...prev,
        [userId]: false,
      }))
    }
  }

  // Функция для входа в режим impersonate
  const handleImpersonate = async () => {
    const userId = impersonateUserId.trim()
    if (!userId) {
      setImpersonateError('Введите ID пользователя')
      return
    }

    if (isImpersonating) {
      return
    }

    setIsImpersonating(true)
    setImpersonateError('')

    try {
      const response = await fetch(`${CABINET_DEV_API_BASE}/impersonate-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(
          json?.error || 'Не удалось переключиться на пользователя',
        )
      }

      // Подождать, чтобы куки установилась на сервере
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Перенаправить на страницу профиля целевого пользователя
      router.push('/cabinet/profile')
    } catch (requestError) {
      setImpersonateError(
        requestError?.message || 'Ошибка переключения пользователя',
      )
    } finally {
      setIsImpersonating(false)
    }
  }

  // Функция для выхода из режима impersonate
  const handleCancelImpersonate = async () => {
    if (isImpersonating) {
      return
    }

    setIsImpersonating(true)
    setImpersonateError('')

    try {
      const response = await fetch(`${CABINET_DEV_API_BASE}/impersonate-user`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось выйти из режима просмотра')
      }

      // Подождать, чтобы куки удалилась на сервере
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Перенаправить на страницу профиля
      router.push('/cabinet/profile')
    } catch (requestError) {
      setImpersonateError(
        requestError?.message || 'Ошибка выхода из режима просмотра',
      )
    } finally {
      setIsImpersonating(false)
    }
  }

  // Использовать сессию как есть
  const displaySession = activeSession

  if (!isDeveloperRole(displaySession?.user?.role)) {
    return (
      <>
        <CabinetLayout
          title="Разработчик"
          description="Доступ только для разработчика."
          activePage="developer"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              У вас нет доступа к разделу разработчика.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <CabinetLayout
        title="Разработчик"
        description="Сервисные операции для полного обслуживания системы."
        activePage="developer"
      >
        {/* Баннер режима impersonate */}
        {displaySession?.user?.isDeveloperImpersonating ? (
          <div className="mb-6 rounded-2xl border border-amber-300/70 bg-amber-50 p-6 dark:border-amber-500/50 dark:bg-amber-500/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-200">
                  ⚠️ Режим просмотра кабинета другого пользователя
                </h4>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                  Вы просматриваете кабинет пользователя:{' '}
                  <strong>
                    {displaySession?.user?.name ||
                      displaySession?.user?.username ||
                      'Unknown'}
                  </strong>
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  User ID: {displaySession?.user?.globalUserId}
                </p>
              </div>
              <CabinetButton
                size="sm"
                variant="secondary"
                tone="neutral"
                onClick={handleCancelImpersonate}
                disabled={isImpersonating}
              >
                {isImpersonating ? 'Выход...' : 'Выход из режима'}
              </CabinetButton>
            </div>
          </div>
        ) : null}

        {/* Секция для выбора пользователя */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Просмотр кабинета пользователя
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Выберите пользователя и посмотрите, как выглядит его кабинет. Это
            полезно для отладки и проверки правильности отображения информации.
          </p>

          {!displaySession?.user?.isDeveloperImpersonating ? (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="impersonate-user-id"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-100"
                >
                  ID пользователя
                </label>
                <input
                  id="impersonate-user-id"
                  type="text"
                  placeholder="Введите MongoDB ID пользователя..."
                  value={impersonateUserId}
                  onChange={(e) => setImpersonateUserId(e.target.value)}
                  disabled={isImpersonating}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400"
                />
              </div>

              {impersonateError ? (
                <p className="rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                  {impersonateError}
                </p>
              ) : null}

              <div>
                <CabinetButton
                  onClick={handleImpersonate}
                  variant="primary"
                  tone="cyan"
                  disabled={isImpersonating || !impersonateUserId.trim()}
                >
                  {isImpersonating ? 'Переключаемся...' : 'Посмотреть кабинет'}
                </CabinetButton>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Полный пересчёт рейтингов
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Пересчитывает рейтинг всех игроков и команд по всем завершённым и
            закрытым рейтинговым играм, затем обновляет данные в базе.
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleRecalculate}
              variant="primary"
              tone="brand"
              disabled={isRecalculating}
            >
              {isRecalculating
                ? 'Выполняется пересчёт...'
                : 'Пересчитать рейтинг игроков и команд'}
            </CabinetButton>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>Пересчёт завершён.</p>
              <p className="mt-1">
                Игр обработано: {result.gamesProcessed ?? 0}
              </p>
              <p className="mt-1">
                Игры с достроенным результатом:{' '}
                {result.gamesWithRebuiltResults ?? 0}
              </p>
              <p className="mt-1">
                Пропущено без snapshot: {result.gamesSkippedNoSnapshots ?? 0}
              </p>
              <p className="mt-1">
                Операций обновления gameStats игроков:{' '}
                {result.usersStatsUpdatedOperations ?? 0}
              </p>
              <p className="mt-1">
                Операций обновления gameStats команд:{' '}
                {result.teamsStatsUpdatedOperations ?? 0}
              </p>
              <p className="mt-1">
                Операций обновления игроков:{' '}
                {result.usersUpdatedOperations ?? 0}
              </p>
              <p className="mt-1">
                Операций обновления команд: {result.teamsUpdatedOperations ?? 0}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Выгрузка заданий игр в Excel
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Экспортирует все задания из всех игр в Excel-файл.
            В выгрузке: название игры, дата, тип игры, задание, подсказки,
            ответ и поле «Как разгадать?».
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleExportGameTasks}
              variant="primary"
              tone="cyan"
              disabled={isExportingGameTasks}
            >
              {isExportingGameTasks
                ? 'Готовим файл...'
                : 'Выгрузить задания в Excel'}
            </CabinetButton>
          </div>

          {exportGameTasksError ? (
            <p className="mt-4 rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {exportGameTasksError}
            </p>
          ) : null}

          {exportGameTasksResult ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>Файл сформирован и скачан.</p>
              <p className="mt-1">Имя файла: {exportGameTasksResult.fileName}</p>
              <p className="mt-1">
                Игр обработано: {exportGameTasksResult.exportedGames ?? 0}
              </p>
              <p className="mt-1">
                Строк с заданиями: {exportGameTasksResult.exportedRows ?? 0}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Пользователи без телефона
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Проверка аккаунтов, у которых не указан номер телефона.
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleLoadUsersWithoutPhone}
              variant="primary"
              tone="brand"
              disabled={isLoadingUsersWithoutPhone}
            >
              {isLoadingUsersWithoutPhone
                ? 'Проверяем...'
                : 'Проверить пользователей без телефона'}
            </CabinetButton>
          </div>

          {usersWithoutPhoneError ? (
            <p className="mt-4 rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {usersWithoutPhoneError}
            </p>
          ) : null}

          {usersWithoutPhoneResult ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>
                Найдено пользователей без телефона:{' '}
                {usersWithoutPhoneResult.usersCount ?? 0}
              </p>

              {Array.isArray(usersWithoutPhoneResult.users) &&
              usersWithoutPhoneResult.users.length > 0 ? (
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {usersWithoutPhoneResult.users.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-lg border border-emerald-300/70 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:border-emerald-500/30 dark:bg-slate-900/50 dark:text-slate-200"
                    >
                      <p className="font-semibold">
                        {user.name || 'Без имени'}{' '}
                        {user.username ? `(@${user.username})` : ''}
                      </p>
                      <p className="mt-1">
                        Telegram ID: {user.telegramId ?? '—'} · Роль:{' '}
                        {user.role || 'client'} · Город:{' '}
                        {user.accountLocation || '—'}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <CabinetButton
                          size="sm"
                          variant="secondary"
                          tone="cyan"
                          disabled={
                            !user.id ||
                            !user.telegramId ||
                            requestingPhoneByUserId[user.id]
                          }
                          onClick={() => handleRequestPhoneForUser(user.id)}
                        >
                          {requestingPhoneByUserId[user.id]
                            ? 'Отправка...'
                            : 'Запросить номер в Telegram'}
                        </CabinetButton>
                        {requestPhoneFeedbackByUserId[user.id] ? (
                          <span className="text-[11px] text-slate-500 dark:text-slate-300">
                            {requestPhoneFeedbackByUserId[user.id]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs">
                  Все проверенные пользователи имеют телефон.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Дубликаты номеров телефона
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Поиск пользователей, у которых один и тот же номер телефона.
          </p>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <CabinetButton
                onClick={handleLoadUsersWithDuplicatePhones}
                variant="primary"
                tone="brand"
                disabled={isLoadingUsersWithDuplicatePhones}
              >
                {isLoadingUsersWithDuplicatePhones
                  ? 'Проверяем...'
                  : 'Проверить дубликаты телефонов'}
              </CabinetButton>
              <CabinetButton
                onClick={handleExportDuplicatePhonesJson}
                variant="secondary"
                tone="neutral"
                disabled={!usersWithDuplicatePhonesResult}
              >
                Скачать JSON
              </CabinetButton>
            </div>
          </div>

          {usersWithDuplicatePhonesError ? (
            <p className="mt-4 rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {usersWithDuplicatePhonesError}
            </p>
          ) : null}

          {usersWithDuplicatePhonesResult ? (
            <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
              <p>
                Номеров с дубликатами:{' '}
                {usersWithDuplicatePhonesResult.duplicatePhonesCount ?? 0}
              </p>
              <p className="mt-1">
                Пользователей в дубликатных группах:{' '}
                {usersWithDuplicatePhonesResult.usersCount ?? 0}
              </p>

              {Array.isArray(usersWithDuplicatePhonesResult.groups) &&
              usersWithDuplicatePhonesResult.groups.length > 0 ? (
                <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
                  {usersWithDuplicatePhonesResult.groups.map((group) => (
                    <div
                      key={String(group.phone)}
                      className="rounded-lg border border-amber-300/70 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:border-amber-500/30 dark:bg-slate-900/50 dark:text-slate-200"
                    >
                      <p className="font-semibold">
                        +{group.phone} · пользователей: {group.usersCount ?? 0}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CabinetButton
                          size="sm"
                          variant="secondary"
                          tone="neutral"
                          disabled={isPreviewingDuplicatePhoneByValue[group.phone]}
                          onClick={() =>
                            handlePreviewDuplicatePhoneGroup(group.phone)
                          }
                        >
                          {isPreviewingDuplicatePhoneByValue[group.phone]
                            ? 'Проверяем...'
                            : 'Проверить изменения'}
                        </CabinetButton>
                        <CabinetButton
                          size="sm"
                          variant="secondary"
                          tone="neutral"
                          disabled={isApplyingDuplicatePhoneMergeByValue[group.phone]}
                          onClick={() =>
                            handleMergeDuplicatePhoneGroup(group.phone)
                          }
                        >
                          {isApplyingDuplicatePhoneMergeByValue[group.phone]
                            ? 'Объединяем...'
                            : 'Применить объединение'}
                        </CabinetButton>
                        {mergeDuplicatePhoneFeedbackByValue[group.phone] ? (
                          <span className="text-[11px] text-slate-600 dark:text-slate-300">
                            {mergeDuplicatePhoneFeedbackByValue[group.phone]}
                          </span>
                        ) : null}
                      </div>
                      {duplicatePhonePreviewByValue[group.phone] ? (
                        <div className="mt-2 rounded-md border border-amber-300/70 bg-amber-100/60 px-2 py-1 text-[11px] dark:border-amber-500/40 dark:bg-slate-900/50 dark:text-amber-200">
                          <p>
                            Будет удалено аккаунтов:{' '}
                            {duplicatePhonePreviewByValue[group.phone]
                              ?.usersToDeleteCount ?? 0}
                          </p>
                          <p>
                            TeamsUsers: переносов{' '}
                            {duplicatePhonePreviewByValue[group.phone]?.teamsUsers
                              ?.movedMembershipsCount ?? 0}
                            , удалений дублей{' '}
                            {duplicatePhonePreviewByValue[group.phone]?.teamsUsers
                              ?.removedDuplicateMembershipsCount ?? 0}
                          </p>
                          <p>
                            Games.result.teamsUsers: игр{' '}
                            {duplicatePhonePreviewByValue[group.phone]
                              ?.gamesResultSnapshots?.affectedGamesCount ?? 0}
                            , переносов{' '}
                            {duplicatePhonePreviewByValue[group.phone]
                              ?.gamesResultSnapshots?.movedMembershipsCount ?? 0}
                            , удалений дублей{' '}
                            {duplicatePhonePreviewByValue[group.phone]
                              ?.gamesResultSnapshots
                              ?.removedDuplicateMembershipsCount ?? 0}
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-2 space-y-1">
                        {Array.isArray(group.users) && group.users.length > 0 ? (
                          group.users.map((user) => (
                            <p key={user.id}>
                              {user.name || 'Без имени'}{' '}
                              {user.username ? `(@${user.username})` : ''} · ID:{' '}
                              {user.id} · Telegram:{' '}
                              {user.telegramId ?? '—'} · Роль:{' '}
                              {user.role || 'client'} · Город:{' '}
                              {user.accountLocation || '—'}
                            </p>
                          ))
                        ) : (
                          <p>Нет данных по пользователям в группе.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs">Дубликаты телефонов не найдены.</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Проверка и repair капитанов команд
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Находит команды без капитана или с несколькими капитанами и
            подготавливает план исправления. Repair назначает самым ранним
            участника капитаном или оставляет самого раннего капитана.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="team-captain-team-id-filter"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Фильтр по teamId
              </label>
              <input
                id="team-captain-team-id-filter"
                type="text"
                placeholder="Необязательно: проверить только одну команду"
                value={teamCaptainTeamIdFilter}
                onChange={(event) => setTeamCaptainTeamIdFilter(event.target.value)}
                disabled={isCheckingTeamCaptains || isApplyingTeamCaptainRepair}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CabinetButton
                onClick={handleCheckTeamCaptains}
                variant="primary"
                tone="brand"
                disabled={isCheckingTeamCaptains}
              >
                {isCheckingTeamCaptains
                  ? 'Проверяем...'
                  : 'Проверить капитанство'}
              </CabinetButton>
              <CabinetButton
                onClick={handleApplyTeamCaptainRepair}
                variant="secondary"
                tone="danger"
                disabled={isApplyingTeamCaptainRepair || !teamCaptainsResult}
              >
                {isApplyingTeamCaptainRepair
                  ? 'Применяем...'
                  : 'Применить repair'}
              </CabinetButton>
            </div>
          </div>

          {teamCaptainsError ? (
            <p className="mt-4 rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {teamCaptainsError}
            </p>
          ) : null}

          {teamCaptainsFeedback ? (
            <p className="mt-4 rounded-xl border border-cyan-300/70 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200">
              {teamCaptainsFeedback}
            </p>
          ) : null}

          {teamCaptainsResult ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>
                Проверено команд: {teamCaptainsResult.summary?.teamsCheckedCount ?? 0}
              </p>
              <p className="mt-1">
                Команд к исправлению: {teamCaptainsResult.summary?.teamsToRepairCount ?? 0}
              </p>
              <p className="mt-1">
                Без капитана: {teamCaptainsResult.summary?.noCaptainTeamsCount ?? 0}
              </p>
              <p className="mt-1">
                С несколькими капитанами:{' '}
                {teamCaptainsResult.summary?.multipleCaptainsTeamsCount ?? 0}
              </p>
              <p className="mt-1">
                Нормализация legacy-роли:{' '}
                {teamCaptainsResult.summary?.legacyCaptainRoleTeamsCount ?? 0}
              </p>
              {typeof teamCaptainsResult.summary?.membershipsUpdatedCount === 'number' ? (
                <p className="mt-1">
                  Обновлено memberships:{' '}
                  {teamCaptainsResult.summary.membershipsUpdatedCount}
                </p>
              ) : null}
              {teamCaptainsResult.summary?.truncated ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Показаны не все планы исправления: выведено{' '}
                  {teamCaptainsResult.summary?.plansReturnedCount ?? 0} из{' '}
                  {teamCaptainsResult.summary?.teamsToRepairCount ?? 0}.
                </p>
              ) : null}

              {Array.isArray(teamCaptainsResult.plans) &&
              teamCaptainsResult.plans.length > 0 ? (
                <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
                  {teamCaptainsResult.plans.map((plan) => (
                    <div
                      key={plan.teamId}
                      className="rounded-lg border border-emerald-300/70 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:border-emerald-500/30 dark:bg-slate-900/50 dark:text-slate-200"
                    >
                      <p className="font-semibold">
                        {plan.teamName || 'Без названия'} ({plan.teamId}) ·{' '}
                        {plan.issueCode}
                      </p>
                      <p className="mt-1">
                        Локация: {plan.location || '—'} · Участников:{' '}
                        {plan.membershipsCount ?? 0} · Капитанов:{' '}
                        {plan.captainCount ?? 0}
                      </p>
                      {plan.promoteMember ? (
                        <p className="mt-1">
                          Назначить капитаном: {plan.promoteMember.userName || 'Без имени'}{' '}
                          {plan.promoteMember.username
                            ? `(@${plan.promoteMember.username})`
                            : ''}{' '}
                          · membership {plan.promoteMember.membershipId}
                        </p>
                      ) : null}
                      {plan.keepCaptainMember ? (
                        <p className="mt-1">
                          Оставить капитаном: {plan.keepCaptainMember.userName || 'Без имени'}{' '}
                          {plan.keepCaptainMember.username
                            ? `(@${plan.keepCaptainMember.username})`
                            : ''}{' '}
                          · membership {plan.keepCaptainMember.membershipId}
                        </p>
                      ) : null}
                      {Array.isArray(plan.demoteMembers) && plan.demoteMembers.length > 0 ? (
                        <div className="mt-1">
                          <p>Понизить до participant:</p>
                          {plan.demoteMembers.map((member) => (
                            <p key={member.membershipId}>
                              {member.userName || 'Без имени'}{' '}
                              {member.username ? `(@${member.username})` : ''} · membership{' '}
                              {member.membershipId}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs">
                  Проблем с капитанством не найдено.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Проверка целостности TeamsUsers
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Проверяет записи участий в командах, где отсутствует пользователь
            или команда.
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleCheckTeamsUsersIntegrity}
              variant="primary"
              tone="brand"
              disabled={isCheckingTeamsUsersIntegrity}
            >
              {isCheckingTeamsUsersIntegrity
                ? 'Проверяем...'
                : 'Проверить целостность TeamsUsers'}
            </CabinetButton>
          </div>

          {teamsUsersIntegrityError ? (
            <p className="mt-4 rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {teamsUsersIntegrityError}
            </p>
          ) : null}

          {teamsUsersIntegrityResult ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>
                Проверено записей TeamsUsers:{' '}
                {teamsUsersIntegrityResult.totalMembershipsCount ?? 0}
              </p>
              <p className="mt-1">
                Проблемных записей:{' '}
                {teamsUsersIntegrityResult.brokenMembershipsCount ?? 0}
              </p>
              <p className="mt-1">
                Нет пользователя:{' '}
                {teamsUsersIntegrityResult.missingUserCount ?? 0}
              </p>
              <p className="mt-1">
                Нет команды: {teamsUsersIntegrityResult.missingTeamCount ?? 0}
              </p>
              <p className="mt-1">
                Нет и пользователя, и команды:{' '}
                {teamsUsersIntegrityResult.missingBothCount ?? 0}
              </p>

              {teamsUsersIntegrityResult.truncated ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Показаны не все проблемные записи: выведено{' '}
                  {teamsUsersIntegrityResult.brokenMembershipsReturned ?? 0} из{' '}
                  {teamsUsersIntegrityResult.brokenMembershipsCount ?? 0}.
                </p>
              ) : null}

              {Array.isArray(teamsUsersIntegrityResult.brokenMemberships) &&
              teamsUsersIntegrityResult.brokenMemberships.length > 0 ? (
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {teamsUsersIntegrityResult.brokenMemberships.map(
                    (membership) => (
                      <div
                        key={membership.id}
                        className="rounded-lg border border-emerald-300/70 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:border-emerald-500/30 dark:bg-slate-900/50 dark:text-slate-200"
                      >
                        <p className="font-semibold">
                          Membership ID: {membership.id}
                        </p>
                        <p className="mt-1">
                          teamId: {membership.teamId || '—'} · userId:{' '}
                          {membership.userId || '—'} · role:{' '}
                          {membership.role || 'participant'}
                        </p>
                        <p className="mt-1">
                          Проблемы:{' '}
                          {Array.isArray(membership.issueCodes) &&
                          membership.issueCodes.length > 0
                            ? membership.issueCodes.join(', ')
                            : '—'}
                        </p>
                        <p className="mt-1">
                          userTelegramId: {membership.userTelegramId ?? '—'} ·
                          createdAt: {membership.createdAt || '—'}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs">
                  Битые связи в TeamsUsers не найдены.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Закрытие всех завершённых игр
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Принудительно переводит все игры со статусом <code>finished</code> в{' '}
            <code>closed</code>.
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleCloseFinishedGames}
              variant="primary"
              tone="danger"
              disabled={isClosingFinished}
            >
              {isClosingFinished
                ? 'Закрываем игры...'
                : 'Закрыть завершенные игры'}
            </CabinetButton>
          </div>

          {closeFinishedResult ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>Операция завершена.</p>
              <p className="mt-1">
                Найдено игр в статусе finished:{' '}
                {closeFinishedResult.finishedGamesFound ?? 0}
              </p>
              <p className="mt-1">
                Переведено в closed: {closeFinishedResult.gamesClosed ?? 0}
              </p>
              <p className="mt-1">
                С достроенным результатом:{' '}
                {closeFinishedResult.gamesWithRebuiltResults ?? 0}
              </p>
              <p className="mt-1">
                Без snapshot: {closeFinishedResult.gamesWithoutSnapshots ?? 0}
              </p>
              <p className="mt-1">
                Пропущено в пересчёте метрик:{' '}
                {closeFinishedResult.gamesSkippedMetrics ?? 0}
              </p>
              <p className="mt-1">
                Операций обновления игроков:{' '}
                {closeFinishedResult.usersUpdatedOperations ?? 0}
              </p>
              <p className="mt-1">
                Операций обновления команд:{' '}
                {closeFinishedResult.teamsUpdatedOperations ?? 0}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Рассылка подписчикам Telegram-ботов
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Отправляет текстовое сообщение пользователям, подписанным на
            выбранный город-бот, либо сразу во все города.
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleOpenBroadcastModal}
              variant="primary"
              tone="cyan"
            >
              Открыть рассылку подписчикам
            </CabinetButton>
          </div>
        </section>

        <Modal
          isOpen={isBroadcastModalOpen}
          onClose={handleCloseBroadcastModal}
          title="Рассылка подписчикам ботов"
          footer={
            <>
              <CabinetButton
                variant="secondary"
                tone="neutral"
                onClick={handleCloseBroadcastModal}
                disabled={isBroadcasting}
              >
                Отмена
              </CabinetButton>
              <CabinetButton
                variant="primary"
                tone="brand"
                onClick={handleBroadcastMessage}
                disabled={isBroadcasting}
              >
                {isBroadcasting ? 'Отправляем...' : 'Отправить сообщение'}
              </CabinetButton>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="broadcast-location"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Город рассылки
              </label>
              <select
                id="broadcast-location"
                value={broadcastLocation}
                onChange={(event) => setBroadcastLocation(event.target.value)}
                disabled={isBroadcasting}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              >
                {broadcastLocationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="broadcast-message"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Текст сообщения
              </label>
              <textarea
                id="broadcast-message"
                rows={6}
                value={broadcastText}
                onChange={(event) => setBroadcastText(event.target.value)}
                disabled={isBroadcasting}
                placeholder="Введите текст сообщения для подписчиков..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
            </div>

            {broadcastError ? (
              <p className="rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                {broadcastError}
              </p>
            ) : null}

            {broadcastResult ? (
              <div className="rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
                <p>Рассылка завершена.</p>
                <p className="mt-1">
                  Локация: {broadcastResult.requestedLocation || 'all'}
                </p>
                <p className="mt-1">
                  Найдено получателей по данным игр и команд выбранного города:{' '}
                  {broadcastResult.usersMatched ?? 0}
                </p>
                <p className="mt-1">
                  Уникальных получателей:{' '}
                  {broadcastResult.uniqueRecipients ?? 0}
                </p>
                <p className="mt-1">
                  Пропущено без Telegram ID:{' '}
                  {broadcastResult.skippedNoTelegram ?? 0}
                </p>
                <p className="mt-1">
                  Пропущено без привязки к боту:{' '}
                  {broadcastResult.skippedNoLocation ?? 0}
                </p>
                <p className="mt-1">
                  Успешно отправлено: {broadcastResult.sent ?? 0}
                </p>
                <p className="mt-1">
                  Ошибок отправки: {broadcastResult.failed ?? 0}
                </p>

                {Array.isArray(broadcastResult.sentTelegramIds) &&
                broadcastResult.sentTelegramIds.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-emerald-300/70 bg-white/80 p-3 text-xs text-slate-700 dark:border-emerald-500/30 dark:bg-slate-900/50 dark:text-slate-200">
                    <p className="font-semibold">
                      Telegram ID получателей (успешно):
                    </p>
                    <div className="mt-2 max-h-24 overflow-y-auto break-all">
                      {broadcastResult.sentTelegramIds.join(', ')}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Modal>
      </CabinetLayout>
    </>
  )
}

export default DeveloperPage
