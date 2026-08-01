'use client'

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PropTypes from 'prop-types'
import { useSession } from 'next-auth/react'
import Modal from '@components/Modal'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import UserTeamCard from '@components/cabinet/cards/UserTeamCard'
import ParticipationGameCard from '@components/cabinet/cards/ParticipationGameCard'
import NoticeBanner from '@components/NoticeBanner'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import fetchCabinetUserDetails from '@helpers/fetchCabinetUserDetails'
import fetchCabinetGameDetails from '@helpers/fetchCabinetGameDetails'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'
import requestApiJson from '@helpers/requestApiJson'
import CopyableId from '@components/cabinet/CopyableId'
import UnifiedGameDescriptionModal from '@components/modals/UnifiedGameDescriptionModal'
import isUserAdmin from '@helpers/isUserAdmin'
import getTelegramUserHref from '@helpers/getTelegramUserHref'
import { LOCATIONS } from '@server/serverConstants'

const modalSectionTitleClass = 'aq-modal-section-title text-base font-semibold'
const modalItemTitleClass = 'aq-modal-item-title text-lg font-semibold'

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

const formatPhoneValue = (value) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(value)
  }
  return ''
}

const normalizePhoneHref = (value) => {
  const raw = formatPhoneValue(value)
  if (!raw) {
    return ''
  }

  const normalized = raw.replace(/[^\d+]/g, '')
  return normalized
}

const normalizeTelegramUsername = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/^@+/, '')
}

const UserViewModal = ({
  userId,
  isOpen,
  onClose,
  onOpenTeam,
  canViewContacts,
}) => {
  const { data: session } = useSession()
  const canViewIds = isUserAdmin({ role: session?.user?.role ?? 'client' })
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchCabinetUserDetails({ userId }),
    enabled: isOpen && !!userId,
    staleTime: 1000 * 60 * 5, // 5 минут
  })

  const [selectedTeam, setSelectedTeam] = useState(null)
  const [userGamesState, setUserGamesState] = useState({
    isLoading: false,
    error: null,
    games: [],
  })
  const [showAllGames, setShowAllGames] = useState(false)
  const [isGameDetailsModalOpen, setIsGameDetailsModalOpen] = useState(false)
  const [selectedGameDetails, setSelectedGameDetails] = useState(null)

  const loadUserGames = useCallback(async () => {
    if (!user) {
      return
    }

    setUserGamesState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams()
      if (typeof user.id === 'string' && user.id) {
        params.set('userId', user.id)
      }

      const { json } = await requestApiJson(
        `/api/cabinet/admin/user-games?${params.toString()}`,
        {
          fallbackMessage: 'Не удалось загрузить игры пользователя',
        },
      )

      const gamesRaw = Array.isArray(json?.data) ? json.data : []
      const games = gamesRaw.sort((first, second) => {
        const firstTime = first?.dateStart
          ? new Date(first.dateStart).getTime()
          : 0
        const secondTime = second?.dateStart
          ? new Date(second.dateStart).getTime()
          : 0
        return secondTime - firstTime
      })

      setUserGamesState((prev) => ({ ...prev, games, isLoading: false }))
    } catch (err) {
      setUserGamesState((prev) => ({
        ...prev,
        error: err?.message || 'Не удалось загрузить игры',
        isLoading: false,
      }))
    }
  }, [user])

  const handleOpenTeam = useCallback(
    (team) => {
      setSelectedTeam(team)
      if (onOpenTeam) {
        onOpenTeam(team)
      }
    },
    [onOpenTeam],
  )

  const handleCloseModal = useCallback(() => {
    setShowAllGames(false)
    onClose()
  }, [onClose])

  const handleOpenGameDetails = useCallback((game) => {
    setSelectedGameDetails(game)
    setIsGameDetailsModalOpen(true)
  }, [])

  const handleCloseGameDetailsModal = useCallback(() => {
    setIsGameDetailsModalOpen(false)
    setSelectedGameDetails(null)
  }, [])

  // Загружаем полные данные игры с помощью React Query
  const { data: gameDetails, isLoading: isGameLoading } = useQuery({
    queryKey: ['game', selectedGameDetails?.id, selectedGameDetails?.location],
    queryFn: () =>
      fetchCabinetGameDetails({
        gameId: selectedGameDetails?.id,
        location: selectedGameDetails?.location,
      }),
    enabled: isGameDetailsModalOpen && !!selectedGameDetails?.id,
    staleTime: 1000 * 60 * 5,
  })

  if (!user && !isLoading && error) {
    return (
      <Modal isOpen={isOpen} onClose={handleCloseModal} title="Ошибка загрузки">
        <NoticeBanner tone="error" variant="neon">
          {error}
        </NoticeBanner>
      </Modal>
    )
  }

  const displayName = user?.name || 'Без имени'
  const phoneValue = formatPhoneValue(user?.phone)
  const phoneHref = normalizePhoneHref(user?.phone)
  const telegramUsername = normalizeTelegramUsername(user?.username)
  const userTelegramId = user?.telegramId || ''

  const shouldBeOpen = isOpen && (isLoading || user)

  return (
    <>
      <Modal
        isOpen={shouldBeOpen}
        onClose={handleCloseModal}
        title={`Пользователь — ${displayName}`}
      >
        {isLoading ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Загружаем данные пользователя...
            </p>
          </div>
        ) : user ? (
          <div className="space-y-6">
            <FormSectionCard className="space-y-6">
              <div className="flex items-start gap-3">
                <img
                  src={getUserAvatarSrc(user)}
                  alt={displayName}
                  className="h-[200px] w-[200px] shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <h2 className={modalItemTitleClass}>{displayName}</h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl dark:bg-sky-500/10 dark:border-sky-500/30">
                  <p className="text-xs text-blue-600 dark:text-sky-300">
                    Команд
                  </p>
                  <p className="mt-1 text-xl font-semibold text-primary dark:text-sky-100">
                    {user.teamsCount || 0}
                  </p>
                </div>
                <div className="p-4 border bg-emerald-50 border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-500/30">
                  <p className="text-xs text-emerald-600 dark:text-emerald-300">
                    Игры
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-100">
                    {user.gamesCount || 0}
                  </p>
                </div>
                <div className="p-4 border bg-slate-50 border-slate-200 dark:bg-slate-800/70 dark:border-slate-700 rounded-xl">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Последнее обновление
                  </p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                    {user.updatedAt
                      ? formatRelativeTimeFromNow(user.updatedAt)
                      : 'Неизвестно'}
                  </p>
                </div>
              </div>

              {user.rating?.isEligible &&
                Number.isFinite(user.rating?.rank) && (
                  <div className="p-4 border rounded-xl border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Рейтинг пользователя
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-100">
                      #{user.rating.rank} ·{' '}
                      {Number(user.rating?.finalScore || 0).toFixed(2)}
                    </p>
                  </div>
                )}
            </FormSectionCard>

            {Array.isArray(user.teams) && user.teams.length > 0 && (
              <FormSectionCard className="space-y-4">
                <h3 className={modalSectionTitleClass}>Команды пользователя</h3>
                <ul className="space-y-3">
                  {user.teams.map((team) => (
                    <li key={team.id}>
                      <UserTeamCard team={team} onOpen={handleOpenTeam} />
                    </li>
                  ))}
                </ul>
              </FormSectionCard>
            )}

            <FormSectionCard className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className={modalSectionTitleClass}>Игры участия</h3>
                {userGamesState.games.length > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    Всего: {userGamesState.games.length}
                  </span>
                )}
              </div>

              {userGamesState.isLoading ? (
                <p className="text-sm text-slate-500">
                  Загружаем игры пользователя...
                </p>
              ) : userGamesState.error ? (
                <p className="text-sm text-rose-500">{userGamesState.error}</p>
              ) : userGamesState.games.length > 0 ? (
                <div className="space-y-3">
                  <ul className="space-y-3">
                    {(showAllGames
                      ? userGamesState.games
                      : userGamesState.games.slice(0, 5)
                    ).map((game) => (
                      <li key={game.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenGameDetails(game)}
                          className="w-full text-left transition-opacity hover:opacity-80 focus:outline-none"
                        >
                          <ParticipationGameCard game={game} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!showAllGames && userGamesState.games.length > 5 && (
                    <button
                      onClick={() => setShowAllGames(true)}
                      className="w-full py-2 text-xs font-medium text-primary hover:underline dark:text-sky-300"
                    >
                      Показать остальные {userGamesState.games.length - 5} игр
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Загружайте игры, чтобы увидеть историю участия
                </p>
              )}

              {userGamesState.games.length === 0 &&
                !userGamesState.isLoading && (
                  <button
                    onClick={loadUserGames}
                    className="text-xs text-primary hover:underline"
                  >
                    Загрузить игры
                  </button>
                )}
            </FormSectionCard>

            <FormSectionCard className="space-y-4">
              <h3 className={modalSectionTitleClass}>
                Дополнительная информация
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Сыграно игр</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                    {user.gamesCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Рейтинг</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                    {user.rating?.isEligible &&
                    Number.isFinite(user.rating?.rank)
                      ? `#${user.rating.rank} (${Number(user.rating?.finalScore || 0).toFixed(2)})`
                      : 'Нет рейтинга'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Город</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                    {resolveLocationLabel(user.currentLocation)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Создан</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                    {user.createdAt
                      ? formatRelativeTimeFromNow(user.createdAt)
                      : 'Неизвестно'}
                  </p>
                </div>
                {canViewIds && user.id ? (
                  <div>
                    <p className="text-xs text-slate-500">ID</p>
                    <div className="mt-1">
                      <CopyableId id={user.id} label="User ID" />
                    </div>
                  </div>
                ) : null}
              </div>

              {Array.isArray(user.preferences) &&
                user.preferences.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Предпочтения</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {user.preferences.map((preference) => (
                        <span
                          key={preference}
                          className="px-3 py-1 text-xs font-medium border border-blue-200 rounded-full text-primary bg-blue-50 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-200"
                        >
                          {preference}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {user.about && (
                <div>
                  <p className="text-xs text-slate-500">О себе</p>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-500">
                    {user.about.trim()}
                  </p>
                </div>
              )}
            </FormSectionCard>

            {canViewContacts ? (
              <FormSectionCard className="space-y-4">
                <h3 className={modalSectionTitleClass}>Контакты</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Телефон</p>
                    {phoneValue && phoneHref ? (
                      <a
                        href={`tel:${phoneHref}`}
                        className="inline-block mt-1 text-sm text-primary underline-offset-2 hover:underline dark:text-sky-300"
                      >
                        {phoneValue}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                        Не указан
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Telegram username</p>
                    {telegramUsername ? (
                      <a
                        href={getTelegramUserHref(telegramUsername, {
                          type: 'username',
                        })}
                        className="inline-block mt-1 text-sm text-primary underline-offset-2 hover:underline dark:text-sky-300"
                      >
                        @{telegramUsername}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                        Не указан
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Telegram ID</p>
                    {userTelegramId ? (
                      <a
                        href={`tg://user?id=${userTelegramId}`}
                        className="inline-block mt-1 text-sm text-primary underline-offset-2 hover:underline dark:text-sky-300"
                      >
                        {userTelegramId}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                        Не указан
                      </p>
                    )}
                  </div>
                  {phoneHref ? (
                    <div>
                      <p className="text-xs text-slate-500">
                        Telegram по номеру телефона
                      </p>
                      <a
                        href={getTelegramUserHref(phoneHref, { type: 'phone' })}
                        className="inline-block mt-1 text-sm text-primary underline-offset-2 hover:underline dark:text-sky-300"
                      >
                        {phoneValue}
                      </a>
                    </div>
                  ) : null}
                </div>
              </FormSectionCard>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Модален для просмотра команды внутри этого модала */}
      {selectedTeam && onOpenTeam && (
        <div className="hidden">
          {/* onOpenTeam должна сама открыть систему модалей для команды если нужно */}
        </div>
      )}

      {/* Модальное окно для просмотра деталей игры */}
      {selectedGameDetails && (
        <UnifiedGameDescriptionModal
          selectedGame={isGameLoading ? null : gameDetails}
          isOpen={isGameDetailsModalOpen}
          onClose={handleCloseGameDetailsModal}
          canViewRestrictedGameInfo={canViewIds}
          canViewGameResults={true}
          onOpenTeam={onOpenTeam}
        />
      )}
    </>
  )
}

UserViewModal.propTypes = {
  userId: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onOpenTeam: PropTypes.func,
  canViewContacts: PropTypes.bool,
}

UserViewModal.defaultProps = {
  userId: null,
  onOpenTeam: null,
  canViewContacts: false,
}

export default UserViewModal
