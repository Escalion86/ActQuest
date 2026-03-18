import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CardActionIconButton, { EditCardIcon } from '@components/cabinet/CardActionIconButton'
import NoticeBanner from '@components/NoticeBanner'
import Modal from '@components/Modal'
import TeamEditModal from '@components/modals/TeamEditModal'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import { getNounUsers } from '@helpers/getNoun'
import getSessionSafe from '@helpers/getSessionSafe'
import isUserAdmin from '@helpers/isUserAdmin'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'

const TEAMS_PAGE_SIZE = 10

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

const AdminTeamsPage = ({
  initialTeams,
  initialHasMore,
  initialLocation,
  session: initialSession,
}) => {
  const safeInitialTeams = Array.isArray(initialTeams) ? initialTeams : []
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const isAdmin = isUserAdmin({ role: effectiveRole })

  const [teams, setTeams] = useState(safeInitialTeams)
  const [persistedTeams, setPersistedTeams] = useState(safeInitialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(safeInitialTeams[0]?.id ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [hasMoreTeams, setHasMoreTeams] = useState(Boolean(initialHasMore))
  const [isLoadingMoreTeams, setIsLoadingMoreTeams] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)
  const [isTeamIdCopied, setIsTeamIdCopied] = useState(false)
  const copyTimeoutRef = useRef(null)
  const [teamDescriptionModal, setTeamDescriptionModal] = useState({
    isOpen: false,
    title: '',
    description: '',
  })

  useEffect(() => {
    setTeams(safeInitialTeams)
    setPersistedTeams(safeInitialTeams)
    setHasMoreTeams(Boolean(initialHasMore))
    setSelectedTeamId((prev) => {
      if (prev && safeInitialTeams.some((team) => team.id === prev)) {
        return prev
      }

      return safeInitialTeams[0]?.id ?? null
    })
  }, [initialHasMore, safeInitialTeams])

  const filteredTeams = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return teams.filter((team) => {
      if (visibilityFilter === 'open' && !team.open) {
        return false
      }

      if (visibilityFilter === 'closed' && team.open) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const memberNames = Array.isArray(team.members)
        ? team.members.map((member) => member.name || '').join(' ')
        : ''

      const haystack = [team.name, team.description, team.captain?.name, memberNames]
        .filter(Boolean)
        .map((value) => value.toLowerCase())

      return haystack.some((value) => value.includes(normalizedQuery))
    })
  }, [teams, searchQuery, visibilityFilter])

  useEffect(() => {
    if (filteredTeams.length === 0) {
      setSelectedTeamId(null)
      return
    }

    setSelectedTeamId((prev) => {
      if (prev && filteredTeams.some((team) => team.id === prev)) {
        return prev
      }

      return filteredTeams[0]?.id ?? null
    })
  }, [filteredTeams])

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

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teams]
  )

  const persistedSelectedTeam = useMemo(
    () => persistedTeams.find((team) => team.id === selectedTeamId) ?? null,
    [persistedTeams, selectedTeamId]
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

  useEffect(() => () => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = null
    }
  }, [])

  const closeTeamDescriptionModal = useCallback(() => {
    setTeamDescriptionModal({ isOpen: false, title: '', description: '' })
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

  const canManageSelectedTeam = isAdmin && Boolean(location)

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

        const original = persistedTeams.find((item) => item.id === selectedTeamId)
        return original ? { ...original } : team
      })
    )
    setFeedback(null)
  }, [canManageSelectedTeam, persistedTeams, selectedTeamId])

  const handleSaveTeam = useCallback(async () => {
    if (!selectedTeam || !location || !canManageSelectedTeam) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/${location}/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: buildTeamUpdatePayload(selectedTeam) }),
      })

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось сохранить команду')
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
        prevTeams.map((team) => (team.id === selectedTeamId ? updatedTeam : team))
      )
      setPersistedTeams((prevTeams) =>
        prevTeams.map((team) => (team.id === selectedTeamId ? updatedTeam : team))
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
          message: 'Нельзя удалить капитана команды. Назначьте нового капитана и повторите действие.',
        })
        return
      }

      setMemberActionId(memberId)
      setFeedback(null)

      try {
        const response = await fetch(`/api/${location}/teamsusers/${memberId}`, {
          method: 'DELETE',
        })
        const json = await response.json()

        if (!response.ok || json?.success === false) {
          throw new Error(json?.error || 'Не удалось удалить участника')
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
          prevTeams.map((team) => (team.id === selectedTeamId ? updatedTeam : team))
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) => (team.id === selectedTeamId ? updatedTeam : team))
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
            throw new Error(payloads[index]?.error || 'Не удалось обновить роль участника')
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
          prevTeams.map((team) => (team.id === selectedTeamId ? updatedTeam : team))
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) => (team.id === selectedTeamId ? updatedTeam : team))
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

  const teamsForList = useMemo(() => {
    return filteredTeams.map((team) => {
      const updatedLabel = team.updatedAt
        ? formatRelativeTimeFromNow(team.updatedAt)
        : '—'

      return {
        id: team.id,
        name: team.name || 'Без названия',
        membersLabel: getNounUsers(team.membersCount ?? 0),
        updatedLabel,
        open: Boolean(team.open),
      }
    })
  }, [filteredTeams])

  const summary = useMemo(() => {
    const total = teams.length
    const open = teams.filter((team) => team.open).length
    return {
      total,
      open,
      closed: total - open,
    }
  }, [teams])

  const handleLoadMoreTeams = useCallback(async () => {
    if (isLoadingMoreTeams || !hasMoreTeams) {
      return
    }

    setIsLoadingMoreTeams(true)
    setFeedback(null)

    try {
      const params = new URLSearchParams({
        offset: String(teams.length),
        limit: String(TEAMS_PAGE_SIZE),
      })

      const response = await fetch(`/api/cabinet/admin/teams-list?${params.toString()}`)
      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось загрузить команды')
      }

      const nextTeams = Array.isArray(json?.data) ? json.data : []
      const nextHasMore = Boolean(json?.meta?.hasMore)

      if (nextTeams.length > 0) {
        setTeams((prevTeams) => [...prevTeams, ...nextTeams])
        setPersistedTeams((prevTeams) => [...prevTeams, ...nextTeams])
      }

      setHasMoreTeams(nextHasMore)
    } catch (error) {
      console.error('Failed to load more teams', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось загрузить дополнительные команды',
      })
    } finally {
      setIsLoadingMoreTeams(false)
    }
  }, [hasMoreTeams, isLoadingMoreTeams, teams.length])

  if (!isAdmin) {
    return (
      <>
        <Head>
          <title>ActQuest — Управление командами</title>
        </Head>
        <CabinetLayout
          title="Управление командами"
          description="Доступ ограничен: административные права отсутствуют."
          activePage="admin"
        >
          <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
            <p className="text-sm text-slate-600">
              У вас нет доступа к управлению командами. Если вы считаете, что это ошибка, обратитесь к главному
              организатору.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Управление командами</title>
      </Head>
      <CabinetLayout
        title="Управление командами"
        description="Редактируйте составы, управляйте капитанами и следите за активностью команд."
        activePage="admin"
      >
        <section className="grid gap-6">
          <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
            <p className="text-sm font-semibold text-primary dark:text-slate-100">Все команды</p>
            <p className="mt-1 text-xs text-slate-500">
              Загружено: {summary.total}. Открытых: {summary.open}. Закрытых: {summary.closed}.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-3">
            <div>
              <label htmlFor="team-search" className="text-xs font-semibold text-slate-500">
                Поиск
              </label>
              <input
                id="team-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Введите название команды или участника"
                className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="team-visibility-filter" className="text-xs font-semibold text-slate-500">
                Доступность
              </label>
              <select
                id="team-visibility-filter"
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value)}
                className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="all">Все команды</option>
                <option value="open">Открытые</option>
                <option value="closed">Закрытые</option>
              </select>
            </div>
          </div>

          {feedback && (
            <NoticeBanner
              tone={feedback.type === 'success' ? 'success' : 'error'}
              variant="neon"
            >
              {feedback.message}
            </NoticeBanner>
          )}

          {!location && (
            <NoticeBanner tone="warning" variant="neon">
              Не удалось определить площадку пользователя. Редактирование команд недоступно.
            </NoticeBanner>
          )}

          {teamsForList.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-3">
                {teamsForList.map((team) => (
                  <li key={team.id}>
                    <button
                      type="button"
                      onClick={() => handleTeamCardClick(team)}
                      className="w-full cursor-pointer text-left p-4 border rounded-2xl transition border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 hover:border-primary hover:bg-blue-50 dark:hover:border-[#7A00FF]/60 dark:hover:bg-[#110a24]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-primary dark:text-slate-100">{team.name}</p>
                          <p className="text-xs text-slate-500">{team.membersLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              team.open
                                ? 'border border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]'
                                : 'border border-violet-300 bg-violet-100 text-violet-700 dark:border-[#7A00FF]/35 dark:bg-[#7A00FF]/12 dark:text-[#d9c8ff]'
                            }`}
                          >
                            {team.open ? 'Открыта' : 'Закрыта'}
                          </span>
                          {canManageSelectedTeam ? (
                            <CardActionIconButton
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
                      </div>
                      <p className="mt-2 text-xs text-slate-400">Обновлено {team.updatedLabel}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {hasMoreTeams && (
                <button
                  type="button"
                  onClick={handleLoadMoreTeams}
                  disabled={isLoadingMoreTeams}
                  className={`w-full rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    isLoadingMoreTeams
                      ? 'cursor-wait border-slate-300 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                      : 'cursor-pointer border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/10'
                  }`}
                >
                  {isLoadingMoreTeams ? 'Загружаем…' : 'Загрузить ещё'}
                </button>
              )}
            </div>
          ) : (
            <div className="p-6 text-sm text-center text-slate-500 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
              Команды не найдены. Измените параметры фильтра или сбросьте поиск.
            </div>
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
          location={location}
        />
        <Modal
          isOpen={teamDescriptionModal.isOpen}
          onClose={closeTeamDescriptionModal}
          title={`Описание команды — ${teamDescriptionModal.title || 'Без названия'}`}
        >
          {teamDescriptionModal.description ? (
            <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
              {teamDescriptionModal.description}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Описание для этой команды пока не заполнено.
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
  initialHasMore: PropTypes.bool,
  session: PropTypes.object,
}

AdminTeamsPage.defaultProps = {
  initialTeams: [],
  initialLocation: null,
  initialHasMore: false,
  session: null,
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/admin/teams'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  if (!isUserAdmin({ role: session?.user?.role })) {
    return {
      redirect: {
        destination: '/cabinet',
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  let initialTeams = []
  let initialHasMore = false

  if (location) {
    try {
      const db = await dbConnectGlobal()

      if (db) {
        const result = await fetchTeamsForCabinet({
          db,
          offset: 0,
          limit: TEAMS_PAGE_SIZE,
          returnMeta: true,
        })
        initialTeams = Array.isArray(result)
          ? result
          : Array.isArray(result?.teams)
            ? result.teams
            : []
        initialHasMore = Array.isArray(result)
          ? result.length === TEAMS_PAGE_SIZE
          : Boolean(result?.hasMore)
      }
    } catch (error) {
      console.error('Failed to load admin teams', error)
    }
  }

  return {
    props: {
      session,
      initialTeams,
      initialHasMore,
      initialLocation: location,
    },
  }
}

export default AdminTeamsPage
