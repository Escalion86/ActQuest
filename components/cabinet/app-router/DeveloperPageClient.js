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
  const [isClosingFinished, setIsClosingFinished] = useState(false)
  const [result, setResult] = useState(null)
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
