'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PropTypes from 'prop-types'

import requestApiJson from '@helpers/requestApiJson'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import FullscreenImageViewer from '@components/FullscreenImageViewer'

const getTaskPhotos = (team, taskIndex) => {
  const entries = Array.isArray(team?.photos) ? team.photos : []
  const entry = entries[taskIndex]
  return {
    photos: Array.isArray(entry?.photos) ? entry.photos : [],
    checks: entry?.checks && typeof entry.checks === 'object' ? entry.checks : {},
  }
}

const calculateTaskScore = ({ task, checks }) => {
  if (!checks?.accepted) return 0
  const base = Number(task?.taskBonusForComplite) || 0
  const subTasks = Array.isArray(task?.subTasks) ? task.subTasks : []
  return subTasks.reduce((acc, subTask) => {
    if (!checks?.[subTask.id]) return acc
    return acc + (Number(subTask.bonus) || 0)
  }, base)
}

export default function PhotoReviewPageClient({ session: _session }) {
  const searchParams = useSearchParams()
  const initialGameId = searchParams.get('gameId') || ''
  const [gameIdInput, setGameIdInput] = useState(initialGameId)
  const [activeGameId, setActiveGameId] = useState(initialGameId)
  const [data, setData] = useState(null)
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0)
  const [collapsedTeams, setCollapsedTeams] = useState({})
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [viewerImage, setViewerImage] = useState(null)

  const selectedTask = useMemo(() => {
    const tasks = Array.isArray(data?.tasks) ? data.tasks : []
    return tasks[selectedTaskIndex] || null
  }, [data?.tasks, selectedTaskIndex])

  const fetchData = useCallback(async () => {
    const normalizedGameId = activeGameId.trim()
    if (!normalizedGameId) {
      setData(null)
      return
    }

    setLoading(true)
    setError('')
    try {
      const { json } = await requestApiJson(
        `/api/cabinet/admin/photo-review?gameId=${encodeURIComponent(normalizedGameId)}`,
        { fallbackMessage: 'Не удалось загрузить фото для проверки' },
      )
      setData(json?.data || null)
      setSelectedTaskIndex((prev) => {
        const tasksCount = Array.isArray(json?.data?.tasks)
          ? json.data.tasks.length
          : 0
        if (tasksCount <= 0) return 0
        return prev >= tasksCount ? 0 : prev
      })
      setCollapsedTeams({})
    } catch (requestError) {
      setData(null)
      setError(requestError?.message || 'Не удалось загрузить фото для проверки')
    } finally {
      setLoading(false)
    }
  }, [activeGameId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleLoadGame = (event) => {
    event.preventDefault()
    setActiveGameId(gameIdInput.trim())
  }

  const updateCheck = async ({ team, checkKey, checked }) => {
    if (!data?.game?.id || !team?.gameTeamId || !selectedTask) return

    const requestKey = `${team.gameTeamId}:${selectedTaskIndex}:${checkKey}`
    setSavingKey(requestKey)
    setError('')
    try {
      const { json } = await requestApiJson('/api/cabinet/admin/photo-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: data.game.id,
          gameTeamId: team.gameTeamId,
          taskIndex: selectedTaskIndex,
          checkKey,
          checked,
        }),
        fallbackMessage: 'Не удалось сохранить проверку фото',
      })

      const nextChecks =
        json?.data?.checks && typeof json.data.checks === 'object'
          ? json.data.checks
          : { ...getTaskPhotos(team, selectedTaskIndex).checks, [checkKey]: checked }

      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          teams: prev.teams.map((item) => {
            if (item.gameTeamId !== team.gameTeamId) return item
            const photos = Array.isArray(item.photos) ? [...item.photos] : []
            photos[selectedTaskIndex] = {
              ...(photos[selectedTaskIndex] || { photos: [] }),
              checks: nextChecks,
            }
            return { ...item, photos }
          }),
        }
      })
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось сохранить проверку фото')
    } finally {
      setSavingKey('')
    }
  }

  const toggleTeam = (teamId) => {
    setCollapsedTeams((prev) => ({ ...prev, [teamId]: !prev[teamId] }))
  }

  const teams = Array.isArray(data?.teams) ? data.teams : []
  const teamsWithPhotosCount = teams.filter(
    (team) => getTaskPhotos(team, selectedTaskIndex).photos.length > 0,
  ).length

  return (
    <CabinetLayout
      title="Проверка фотоквеста"
      description="Проверяйте фото по заданиям: сначала все команды для выбранного задания, затем переходите к следующему."
      activePage="admin"
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleLoadGame}>
            <input
              type="text"
              value={gameIdInput}
              onChange={(event) => setGameIdInput(event.target.value)}
              placeholder="ID фотоквеста"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || !gameIdInput.trim()}
            >
              {loading ? 'Загрузка...' : 'Открыть проверку'}
            </button>
          </form>
          {error ? (
            <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}
        </section>

        {data?.game ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Фотоквест
                </p>
                <h2 className="text-xl font-semibold text-primary dark:text-white">
                  {data.game.name || data.game.id}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Статус: {data.game.status || 'не указан'} · результатов не видно
                  командам до публикации.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={fetchData}
                disabled={loading}
              >
                Обновить
              </button>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {(data.tasks || []).map((task) => {
                const isSelected = task.taskIndex === selectedTaskIndex
                return (
                  <button
                    key={task.taskIndex}
                    type="button"
                    onClick={() => setSelectedTaskIndex(task.taskIndex)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {task.taskIndex + 1}. {task.title}
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        {selectedTask ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
              <b>{selectedTask.title}</b> · фото отправили {teamsWithPhotosCount} из{' '}
              {teams.length} команд · базовый зачёт {selectedTask.taskBonusForComplite} б.
            </div>

            {teams.map((team) => {
              const taskPhotos = getTaskPhotos(team, selectedTaskIndex)
              const isCollapsed = Boolean(collapsedTeams[team.gameTeamId])
              const score = calculateTaskScore({
                task: selectedTask,
                checks: taskPhotos.checks,
              })
              const acceptedKey = `${team.gameTeamId}:${selectedTaskIndex}:accepted`
              const isSavingAccepted = savingKey === acceptedKey

              return (
                <article
                  key={team.gameTeamId}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <button
                    type="button"
                    onClick={() => toggleTeam(team.gameTeamId)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
                  >
                    <span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {team.teamName}
                      </span>
                      <span className="ml-2 text-sm text-slate-500">
                        Фото: {taskPhotos.photos.length} · Баллы: {score}
                      </span>
                    </span>
                    <span className="text-sm text-slate-500">
                      {isCollapsed ? 'Развернуть' : 'Свернуть'}
                    </span>
                  </button>

                  {!isCollapsed ? (
                    <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-700">
                      {taskPhotos.photos.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {taskPhotos.photos.map((photoUrl, index) => (
                            <button
                              key={`${photoUrl}-${index}`}
                              type="button"
                              onClick={() =>
                                setViewerImage({
                                  src: photoUrl,
                                  alt: `${team.teamName}, фото ${index + 1}`,
                                })
                              }
                              className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                            >
                              <img
                                src={photoUrl}
                                alt={`${team.teamName}, фото ${index + 1}`}
                                className="h-48 w-full object-cover transition group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
                          На это задание команда ещё не отправляла фото.
                        </p>
                      )}

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(taskPhotos.checks.accepted)}
                            disabled={Boolean(savingKey)}
                            onChange={(event) =>
                              updateCheck({
                                team,
                                checkKey: 'accepted',
                                checked: event.target.checked,
                              })
                            }
                          />
                          <span className="font-medium text-slate-900 dark:text-white">
                            Основное задание принято ({selectedTask.taskBonusForComplite} б.)
                          </span>
                          {isSavingAccepted ? (
                            <span className="text-xs text-slate-400">сохраняем...</span>
                          ) : null}
                        </label>

                        {(selectedTask.subTasks || []).map((subTask) => {
                          const requestKey = `${team.gameTeamId}:${selectedTaskIndex}:${subTask.id}`
                          return (
                            <label
                              key={subTask.id}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(taskPhotos.checks[subTask.id])}
                                disabled={Boolean(savingKey) || !taskPhotos.checks.accepted}
                                onChange={(event) =>
                                  updateCheck({
                                    team,
                                    checkKey: subTask.id,
                                    checked: event.target.checked,
                                  })
                                }
                              />
                              <span className="text-slate-900 dark:text-white">
                                {subTask.name || subTask.task || 'Подзадача'} ({subTask.bonus} б.)
                              </span>
                              {savingKey === requestKey ? (
                                <span className="text-xs text-slate-400">сохраняем...</span>
                              ) : null}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </section>
        ) : data?.game ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
            В этой игре нет заданий для проверки.
          </section>
        ) : null}
      </div>

      <FullscreenImageViewer
        isOpen={Boolean(viewerImage?.src)}
        src={viewerImage?.src || ''}
        alt={viewerImage?.alt || 'Фото ответа'}
        onClose={() => setViewerImage(null)}
      />
    </CabinetLayout>
  )
}

PhotoReviewPageClient.propTypes = {
  session: PropTypes.shape({}),
}

PhotoReviewPageClient.defaultProps = {
  session: null,
}
