import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import getSessionSafe from '@helpers/getSessionSafe'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { getNounUsers } from '@helpers/getNoun'
import normalizeTeamForCabinet from '@helpers/normalizeTeamForCabinet'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import dbConnect from '@utils/dbConnect'

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

const TeamsPage = ({
  initialTeams,
  initialLocation,
  session: initialSession,
}) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const userRole = activeSession?.user?.role ?? 'client'
  const currentTelegramId = activeSession?.user?.telegramId ?? null
  const currentTelegramIdString =
    currentTelegramId === null || currentTelegramId === undefined
      ? null
      : String(currentTelegramId)

  const [teams, setTeams] = useState(initialTeams)
  const [persistedTeams, setPersistedTeams] = useState(initialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(
    initialTeams[0]?.id ?? null
  )
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

  useEffect(() => {
    setFeedback(null)
    setMemberActionId(null)
  }, [selectedTeamId])

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  )

  const persistedSelectedTeam = useMemo(
    () => persistedTeams.find((team) => team.id === selectedTeamId) ?? null,
    [persistedTeams, selectedTeamId]
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
    if (!selectedTeam || !currentTelegramIdString) {
      return false
    }

    return selectedTeam.members?.some(
      (member) =>
        member.isCaptain && member.telegramId === currentTelegramIdString
    )
  }, [currentTelegramIdString, selectedTeam])

  const canManageSelectedTeam = isAdmin || isTeamCaptain

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

        const original = persistedTeams.find(
          (item) => item.id === selectedTeamId
        )
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
      const response = await fetch(
        `/api/${location}/teams/${selectedTeam.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: buildTeamUpdatePayload(selectedTeam) }),
        }
      )

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
        prevTeams.map((team) =>
          team.id === selectedTeamId ? updatedTeam : team
        )
      )
      setPersistedTeams((prevTeams) =>
        prevTeams.map((team) =>
          team.id === selectedTeamId ? updatedTeam : team
        )
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
          message:
            'Нельзя удалить капитана команды. Назначьте нового капитана и повторите действие.',
        })
        return
      }

      setMemberActionId(memberId)
      setFeedback(null)

      try {
        const response = await fetch(
          `/api/${location}/teamsusers/${memberId}`,
          {
            method: 'DELETE',
          }
        )
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
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
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
            throw new Error(
              payloads[index]?.error || 'Не удалось обновить роль участника'
            )
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
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
        )
        setPersistedTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === selectedTeamId ? updatedTeam : team
          )
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

  const teamRestrictionMessage = useMemo(() => {
    if (!selectedTeam || canManageSelectedTeam) {
      return null
    }

    if (
      selectedTeam.captain &&
      selectedTeam.captain.telegramId === currentTelegramIdString
    ) {
      return null
    }

    return 'Изменять данные может только администратор или капитан команды. Вы можете просматривать информацию.'
  }, [canManageSelectedTeam, currentTelegramIdString, selectedTeam])

  const teamsForList = useMemo(() => {
    if (!Array.isArray(teams)) {
      return []
    }

    return teams.map((team) => {
      const updatedLabel = team.updatedAt
        ? formatRelativeTimeFromNow(team.updatedAt)
        : '—'

      return {
        id: team.id,
        name: team.name || 'Без названия',
        membersCount: getNounUsers(team.membersCount ?? 0),
        gamesCount: team.gamesCount ?? 0,
        updatedLabel,
        open: Boolean(team.open),
      }
    })
  }, [teams])

  return (
    <>
      <Head>
        <title>ActQuest — Мои команды</title>
      </Head>
      <CabinetLayout
        title="Мои команды"
        description="Следите за составом, назначайте капитанов и контролируйте участие в играх."
        activePage="teams"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="space-y-4 md:col-span-2">
            <div className="p-4 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
              <p className="text-sm font-semibold text-primary">Ваши команды</p>
              <p className="mt-1 text-xs text-slate-500">
                Выберите команду, чтобы просмотреть состав и изменить основные
                параметры.
              </p>
            </div>

            {teamsForList.length > 0 ? (
              <ul className="space-y-3">
                {teamsForList.map((team) => (
                  <li key={team.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTeamId(team.id)}
                        className={`w-full text-left p-4 border rounded-2xl transition hover:border-primary hover:bg-blue-50 dark:hover:bg-violet-500/10 ${
                          selectedTeamId === team.id
                            ? 'border-primary bg-blue-50 shadow-sm dark:border-violet-400 dark:bg-violet-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80'
                        }`}
                      >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-primary">
                          {team.name}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            team.open
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {team.open ? 'Открыта' : 'Закрыта'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {team.membersCount}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {team.gamesCount > 0
                          ? `Игр: ${team.gamesCount} · Обновлено ${team.updatedLabel}`
                          : `Обновлено ${team.updatedLabel}`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center bg-white dark:bg-slate-900/80 border shadow-sm text-slate-500 border-slate-200 dark:border-slate-700 rounded-2xl">
                У вас пока нет команд. Создайте команду в телеграм-боте, чтобы
                она появилась в списке.
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            {selectedTeam ? (
              <div className="space-y-6">
                <div className="p-5 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        selectedTeam.open
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-slate-600 bg-slate-100 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {selectedTeam.open
                        ? 'Открыта для заявок'
                        : 'Закрытый состав'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Участников: {selectedTeam.membersCount ?? 0}
                    </span>
                    <span className="text-xs text-slate-500">
                      Участвует в играх: {selectedTeam.gamesCount ?? 0}
                    </span>
                    {selectedTeam.updatedAt && (
                      <span className="text-xs text-slate-500">
                        Обновлено{' '}
                        {formatRelativeTimeFromNow(selectedTeam.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {!location && (
                  <div className="p-4 text-sm border text-amber-700 bg-amber-50 border-amber-200 rounded-2xl">
                    Не удалось определить площадку пользователя. Сохранение
                    изменений недоступно.
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

                {teamRestrictionMessage && (
                  <div className="p-4 text-sm border text-amber-700 bg-amber-50 border-amber-200 rounded-2xl">
                    {teamRestrictionMessage}
                  </div>
                )}

                <fieldset
                  disabled={!canManageSelectedTeam}
                  className="p-0 m-0 space-y-6 border-0"
                >
                  <section className="p-6 space-y-5 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="team-name"
                          className="text-sm font-semibold text-primary"
                        >
                          Название команды
                        </label>
                        <input
                          id="team-name"
                          type="text"
                          value={selectedTeam.name}
                          onChange={(event) =>
                            handleTeamFieldChange('name', event.target.value)
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          className="text-sm font-semibold text-primary"
                          htmlFor="team-open"
                        >
                          Доступность команды
                        </label>
                        <div className="flex items-center gap-3 mt-3">
                          <input
                            id="team-open"
                            type="checkbox"
                            checked={Boolean(selectedTeam.open)}
                            onChange={(event) =>
                              handleTeamFieldChange(
                                'open',
                                event.target.checked
                              )
                            }
                            className="w-4 h-4 rounded text-primary border-slate-300"
                          />
                          <span className="text-sm text-slate-600">
                            Разрешить новым участникам подавать заявки
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="team-description"
                        className="text-sm font-semibold text-primary"
                      >
                        Описание
                      </label>
                      <textarea
                        id="team-description"
                        value={selectedTeam.description}
                        onChange={(event) =>
                          handleTeamFieldChange(
                            'description',
                            event.target.value
                          )
                        }
                        rows={5}
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </section>

                  <section className="p-6 space-y-5 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-primary">
                        Состав команды
                      </h2>
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
                              className="p-4 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-primary">
                                    {member.name || 'Без имени'}
                                    {member.isCaptain ? ' · Капитан' : ''}
                                  </p>
                                  {member.username && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      @{member.username}
                                    </p>
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
                                      href={
                                        phoneLink
                                          ? `tel:${phoneLink}`
                                          : undefined
                                      }
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
                                      onClick={() =>
                                        handleSetCaptain(member.id)
                                      }
                                      disabled={isProcessing}
                                      className={`inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                                        isProcessing
                                          ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                                          : 'border-primary text-primary hover:bg-blue-50 dark:hover:bg-violet-500/10'
                                      }`}
                                    >
                                      Назначить капитаном
                                    </button>
                                  )}
                                  {!member.isCaptain && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveMember(member.id)
                                      }
                                      disabled={isProcessing}
                                      className={`inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                                        isProcessing
                                          ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
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
                        Пока нет участников. Пригласите игроков через
                        телеграм-бота, чтобы они появились здесь.
                      </p>
                    )}
                  </section>

                  <section className="p-6 space-y-4 bg-white dark:bg-slate-900/80 border shadow-sm border-slate-200 dark:border-slate-700 rounded-2xl">
                    <h2 className="text-lg font-semibold text-primary">
                      Игры команды
                    </h2>
                    {selectedTeam.games?.length > 0 ? (
                      <ul className="space-y-3">
                        {selectedTeam.games.map((game) => (
                          <li
                            key={game.id}
                            className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-primary">
                                {game.name || 'Без названия'}
                              </p>
                              <span className="text-xs text-slate-500">
                                {game.dateStart
                                  ? new Date(game.dateStart).toLocaleString(
                                      'ru-RU',
                                      {
                                        dateStyle: 'short',
                                        timeStyle: 'short',
                                      }
                                    )
                                  : 'Дата не указана'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {getGameStatusLabel(game.status)}
                              {game.hidden ? ' · Скрыта' : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Команда пока не зарегистрирована ни в одной игре.
                      </p>
                    )}
                  </section>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={handleSaveTeam}
                      disabled={
                        !canManageSelectedTeam ||
                        !location ||
                        !isDirty ||
                        isSaving
                      }
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                        !canManageSelectedTeam ||
                        !location ||
                        !isDirty ||
                        isSaving
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
                          ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                          : 'border-primary text-primary hover:bg-blue-50 dark:hover:bg-violet-500/10'
                      }`}
                    >
                      Отменить изменения
                    </button>
                  </div>
                </fieldset>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-white dark:bg-slate-900/80 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <p className="text-sm text-slate-500">
                  Выберите команду из списка слева, чтобы просмотреть детали.
                </p>
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

TeamsPage.propTypes = {
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

TeamsPage.defaultProps = {
  initialTeams: [],
  initialLocation: null,
  session: null,
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/teams'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(
          callbackTarget
        )}`,
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  const rawTelegramId = session?.user?.telegramId
  const numericTelegramId =
    rawTelegramId === null || rawTelegramId === undefined
      ? null
      : Number(rawTelegramId)

  let initialTeams = []

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const TeamsUsersModel = db.model('TeamsUsers')
        if (Number.isFinite(numericTelegramId)) {
          const memberships = await TeamsUsersModel.find({
            userTelegramId: numericTelegramId,
          })
            .select({ teamId: 1 })
            .lean()

          const teamIds = [
            ...new Set(
              memberships
                .map((membership) =>
                  membership?.teamId ? membership.teamId.toString() : null
                )
                .filter(Boolean)
            ),
          ]

          if (teamIds.length > 0) {
            initialTeams = await fetchTeamsForCabinet({ db, teamIds })
          }
        }
      }
    } catch (error) {
      console.error('Failed to load teams for cabinet', error)
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

export default TeamsPage
