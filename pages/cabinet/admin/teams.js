import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { getNounUsers } from '@helpers/getNoun'
import getSessionSafe from '@helpers/getSessionSafe'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnect from '@utils/dbConnect'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'

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

const normalizePhoneLink = (phone) => {
  if (!phone) {
    return ''
  }

  return phone.replace(/[^+\d]/g, '')
}

const AdminTeamsPage = ({ initialTeams, initialLocation, session: initialSession }) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const isAdmin = isUserAdmin({ role: activeSession?.user?.role })

  const [teams, setTeams] = useState(initialTeams)
  const [persistedTeams, setPersistedTeams] = useState(initialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeams[0]?.id ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)

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
          <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
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
        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2 space-y-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <p className="text-sm font-semibold text-primary">Все команды</p>
              <p className="mt-1 text-xs text-slate-500">
                Всего: {summary.total}. Открытых: {summary.open}. Закрытых: {summary.closed}.
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
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
                  className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
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
                  className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Все команды</option>
                  <option value="open">Открытые</option>
                  <option value="closed">Закрытые</option>
                </select>
              </div>
            </div>

            {teamsForList.length > 0 ? (
              <ul className="space-y-3">
                {teamsForList.map((team) => (
                  <li key={team.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full text-left p-4 border rounded-2xl transition ${
                        selectedTeamId === team.id
                          ? 'border-primary bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-primary hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-primary">{team.name}</p>
                          <p className="text-xs text-slate-500">{team.membersLabel}</p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            team.open
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {team.open ? 'Открыта' : 'Закрыта'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">Обновлено {team.updatedLabel}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
                Команды не найдены. Измените параметры фильтра или сбросьте поиск.
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            {selectedTeam ? (
              <div className="space-y-6">
                {!location && (
                  <div className="p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl">
                    Не удалось определить площадку пользователя. Сохранение изменений недоступно.
                  </div>
                )}

                {feedback && (
                  <div
                    className={`p-4 text-sm border rounded-2xl ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        selectedTeam.open
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-slate-600 bg-slate-100 border-slate-200'
                      }`}
                    >
                      {selectedTeam.open ? 'Открыта для заявок' : 'Закрытый состав'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Участников: {selectedTeam.membersCount ?? 0}
                    </span>
                    <span className="text-xs text-slate-500">
                      Участвует в играх: {selectedTeam.gamesCount ?? 0}
                    </span>
                    {selectedTeam.updatedAt && (
                      <span className="text-xs text-slate-500">
                        Обновлено {formatRelativeTimeFromNow(selectedTeam.updatedAt)}
                      </span>
                    )}
                    {selectedTeam.createdAt && (
                      <span className="text-xs text-slate-400">
                        Создана {formatRelativeTimeFromNow(selectedTeam.createdAt)}
                      </span>
                    )}
                  </div>
                </section>

                <fieldset disabled={!canManageSelectedTeam} className="space-y-6 border-0 p-0 m-0">
                  <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="team-name" className="text-sm font-semibold text-primary">
                          Название команды
                        </label>
                        <input
                          id="team-name"
                          type="text"
                          value={selectedTeam.name}
                          onChange={(event) => handleTeamFieldChange('name', event.target.value)}
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-primary" htmlFor="team-open">
                          Доступность команды
                        </label>
                        <div className="flex items-center gap-3 mt-3">
                          <input
                            id="team-open"
                            type="checkbox"
                            checked={Boolean(selectedTeam.open)}
                            onChange={(event) => handleTeamFieldChange('open', event.target.checked)}
                            className="w-4 h-4 text-primary border-slate-300 rounded"
                          />
                          <span className="text-sm text-slate-600">
                            Разрешить новым участникам подавать заявки
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="team-description" className="text-sm font-semibold text-primary">
                        Описание
                      </label>
                      <textarea
                        id="team-description"
                        value={selectedTeam.description}
                        onChange={(event) => handleTeamFieldChange('description', event.target.value)}
                        rows={5}
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </section>

                  <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-primary">Состав команды</h2>
                      {selectedTeam.captain && (
                        <span className="text-xs text-slate-500">
                          Капитан: {selectedTeam.captain.name || 'не указан'}
                        </span>
                      )}
                    </div>

                    {selectedTeam.members?.length > 0 ? (
                      <div className="space-y-3">
                        {selectedTeam.members.map((member) => {
                          const phoneLink = normalizePhoneLink(member.phone)
                          const isProcessing = memberActionId === member.id

                          return (
                            <div
                              key={member.id}
                              className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-primary">
                                    {member.name || 'Без имени'}
                                    {member.isCaptain ? ' · Капитан' : ''}
                                  </p>
                                  {member.username && (
                                    <p className="mt-1 text-xs text-slate-500">@{member.username}</p>
                                  )}
                                  {member.userRole && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      Роль в системе: {member.userRole}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  {member.phone && (
                                    <a
                                      href={phoneLink ? `tel:${phoneLink}` : undefined}
                                      className="block text-xs text-primary hover:underline"
                                    >
                                      {member.phone}
                                    </a>
                                  )}
                                </div>
                              </div>

                              {canManageSelectedTeam && (
                                <div className="flex flex-col gap-2 mt-3 md:flex-row">
                                  {!member.isCaptain && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetCaptain(member.id)}
                                      disabled={isProcessing}
                                      className={`inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                                        isProcessing
                                          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                                          : 'border-primary text-primary hover:bg-blue-50'
                                      }`}
                                    >
                                      Назначить капитаном
                                    </button>
                                  )}
                                  {!member.isCaptain && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMember(member.id)}
                                      disabled={isProcessing}
                                      className={`inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                                        isProcessing
                                          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                                          : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                      }`}
                                    >
                                      Удалить из команды
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        В команде пока нет участников.
                      </p>
                    )}
                  </section>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={handleSaveTeam}
                      disabled={!canManageSelectedTeam || !location || !isDirty || isSaving}
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                        !canManageSelectedTeam || !location || !isDirty || isSaving
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-primary hover:bg-blue-700'
                      }`}
                    >
                      {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetTeam}
                      disabled={!canManageSelectedTeam || !isDirty}
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold rounded-xl border transition ${
                        !canManageSelectedTeam || !isDirty
                          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'border-primary text-primary hover:bg-blue-50'
                      }`}
                    >
                      Отменить изменения
                    </button>
                  </div>
                </fieldset>

                <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-base font-semibold text-primary">Игры команды</h3>

                  {selectedTeam.games?.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedTeam.games.map((game) => (
                        <li
                          key={game.id}
                          className="p-4 border border-slate-200 rounded-2xl flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-primary">{game.name || 'Без названия'}</p>
                            <p className="text-xs text-slate-500">
                              Статус: {getGameStatusLabel(game.status)}
                            </p>
                          </div>
                          <p className="text-xs text-slate-400">
                            {game.dateStart
                              ? `Старт ${formatRelativeTimeFromNow(game.dateStart)}`
                              : 'Дата старта неизвестна'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Команда ещё не участвовала в играх.</p>
                  )}
                </section>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-white border border-dashed border-slate-200 rounded-2xl">
                <p className="text-sm text-slate-500">Выберите команду из списка слева, чтобы просмотреть детали.</p>
              </div>
            )}
          </div>
        </section>
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
  session: PropTypes.object,
}

AdminTeamsPage.defaultProps = {
  initialTeams: [],
  initialLocation: null,
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

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        initialTeams = await fetchTeamsForCabinet({ db })
      }
    } catch (error) {
      console.error('Failed to load admin teams', error)
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

export default AdminTeamsPage
