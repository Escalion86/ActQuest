import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'

const getTaskRevealState = (state, taskId) => {
  const current = state?.[taskId]
  if (current && typeof current === 'object') {
    return {
      cluesOpened: Number(current.cluesOpened) || 0,
      answerOpened: Boolean(current.answerOpened),
    }
  }

  return {
    cluesOpened: 0,
    answerOpened: false,
  }
}

const getTaskCoordinates = (task) => {
  const latitude = Number(task?.coordinates?.latitude)
  const longitude = Number(task?.coordinates?.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return { latitude, longitude }
}

const GameTasksViewModal = ({
  isTasksViewModalOpen,
  handleCloseTasksViewModal,
  selectedGame,
}) => {
  const [expandedTaskIds, setExpandedTaskIds] = useState([])
  const [taskRevealState, setTaskRevealState] = useState({})

  useEffect(() => {
    if (!isTasksViewModalOpen) {
      setExpandedTaskIds([])
      setTaskRevealState({})
      return
    }

    setExpandedTaskIds([])
    setTaskRevealState({})
  }, [isTasksViewModalOpen, selectedGame?.id])

  const tasks = useMemo(
    () => (Array.isArray(selectedGame?.tasks) ? selectedGame.tasks : []),
    [selectedGame?.tasks]
  )

  const toggleTask = useCallback((taskId) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    )
  }, [])

  const revealNextStep = useCallback((task) => {
    if (!task?.id) {
      return
    }

    const clues = Array.isArray(task.clues) ? task.clues : []
    const cluesCount = clues.length

    setTaskRevealState((prev) => {
      const current = getTaskRevealState(prev, task.id)
      const canOpenClue = current.cluesOpened < cluesCount

      if (canOpenClue) {
        return {
          ...prev,
          [task.id]: {
            ...current,
            cluesOpened: current.cluesOpened + 1,
          },
        }
      }

      if (!current.answerOpened) {
        return {
          ...prev,
          [task.id]: {
            ...current,
            answerOpened: true,
          },
        }
      }

      return prev
    })
  }, [])

  const renderAnswer = (task) => {
    const coordinates = getTaskCoordinates(task)
    const hasCoordinates = Boolean(coordinates)
    const yandexLink = hasCoordinates
      ? `https://yandex.ru/maps/?ll=${coordinates.longitude}%2C${coordinates.latitude}&z=17&pt=${coordinates.longitude},${coordinates.latitude},pm2rdm`
      : ''
    const twoGisLink = hasCoordinates
      ? `https://2gis.ru/search/${coordinates.latitude}%2C${coordinates.longitude}`
      : ''

    if (selectedGame?.type === 'photo') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Для фотоквеста ответом является отправка фото по заданию.
          </p>
          {hasCoordinates && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Координаты
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={twoGisLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center rounded-lg border border-sky-300/70 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-500 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/12 dark:text-sky-200 dark:hover:bg-sky-500/20"
                >
                  Открыть в 2GIS
                </a>
                <a
                  href={yandexLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-500 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/12 dark:text-amber-200 dark:hover:bg-amber-500/20"
                >
                  Открыть в Yandex
                </a>
              </div>
            </div>
          )}
        </div>
      )
    }

    const codes = (Array.isArray(task?.codes) ? task.codes : [])
      .map((code) => (typeof code === 'string' ? code.trim() : ''))
      .filter(Boolean)

    if (codes.length === 0) {
      return (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Ответ для этого задания не задан.
        </p>
      )
    }

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Коды ответа
          </p>
          <div className="flex flex-wrap gap-2">
            {codes.map((code, index) => (
              <span
                key={`${task.id}-answer-code-${index}`}
                className="inline-flex items-center rounded-lg border border-emerald-300/70 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
        {hasCoordinates && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Координаты
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={twoGisLink}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center rounded-lg border border-sky-300/70 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-500 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/12 dark:text-sky-200 dark:hover:bg-sky-500/20"
              >
                Открыть в 2GIS
              </a>
              <a
                href={yandexLink}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-500 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/12 dark:text-amber-200 dark:hover:bg-amber-500/20"
              >
                Открыть в Yandex
              </a>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Modal
      isOpen={isTasksViewModalOpen}
      title={`Задания — ${selectedGame?.name || 'Игра'}`}
      onClose={handleCloseTasksViewModal}
    >
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <ModalSection className="p-5">
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Для этой игры пока нет заданий.
            </p>
          </ModalSection>
        ) : (
          tasks.map((task, index) => {
            const taskId = task.id || String(index)
            const isExpanded = expandedTaskIds.includes(taskId)
            const clues = Array.isArray(task.clues) ? task.clues : []
            const revealState = getTaskRevealState(taskRevealState, taskId)
            const visibleClues = clues.slice(0, revealState.cluesOpened)
            const hasMoreClues = revealState.cluesOpened < clues.length
            const canShowAnswer = !hasMoreClues && !revealState.answerOpened
            const canRevealNext = hasMoreClues || canShowAnswer
            const actionLabel = hasMoreClues
              ? 'Открыть подсказку'
              : 'Показать ответ'

            return (
              <ModalSection key={taskId} className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => toggleTask(taskId)}
                  className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-blue-50 dark:bg-slate-800/70 dark:text-white dark:hover:bg-sky-500/10"
                >
                  <span>
                    {index + 1}. {task?.title || 'Без названия'}
                  </span>
                  <span className="text-xs">{isExpanded ? 'Свернуть' : 'Развернуть'}</span>
                </button>

                {isExpanded && (
                  <div className="space-y-4 px-4 py-4">
                    <div>
                      <ModalSectionTitle>Описание задания</ModalSectionTitle>
                      {typeof task?.taskRich === 'string' && task.taskRich.trim() ? (
                        <div
                          className="aq-task-content mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                          dangerouslySetInnerHTML={{ __html: task.taskRich }}
                        />
                      ) : (
                        <p className="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
                          {task?.task || 'Описание отсутствует.'}
                        </p>
                      )}
                    </div>

                    {visibleClues.length > 0 && (
                      <div className="space-y-3">
                        <ModalSectionTitle>Подсказки</ModalSectionTitle>
                        {visibleClues.map((clue, clueIndex) => (
                          <div
                            key={`${taskId}-clue-${clueIndex}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                              Подсказка {clueIndex + 1}
                            </p>
                            {typeof clue?.clueRich === 'string' && clue.clueRich.trim() ? (
                              <div
                                className="aq-task-content mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                                dangerouslySetInnerHTML={{ __html: clue.clueRich }}
                              />
                            ) : (
                              <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
                                {clue?.clue || 'Текст подсказки отсутствует.'}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {revealState.answerOpened && (
                      <div className="space-y-2 rounded-xl border border-emerald-300/60 bg-emerald-50/70 px-3 py-3 dark:border-emerald-500/35 dark:bg-emerald-500/10">
                        <ModalSectionTitle>Ответ</ModalSectionTitle>
                        {renderAnswer(task)}
                      </div>
                    )}

                    {canRevealNext && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => revealNextStep({ ...task, id: taskId })}
                          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/12 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                        >
                          {actionLabel}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </ModalSection>
            )
          })
        )}
      </div>
    </Modal>
  )
}

GameTasksViewModal.propTypes = {
  isTasksViewModalOpen: PropTypes.bool.isRequired,
  handleCloseTasksViewModal: PropTypes.func.isRequired,
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string,
    tasks: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        title: PropTypes.string,
        task: PropTypes.string,
        taskRich: PropTypes.string,
        coordinates: PropTypes.shape({
          latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
          longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        }),
        codes: PropTypes.arrayOf(PropTypes.string),
        clues: PropTypes.arrayOf(
          PropTypes.shape({
            clue: PropTypes.string,
            clueRich: PropTypes.string,
          })
        ),
      })
    ),
  }),
}

GameTasksViewModal.defaultProps = {
  selectedGame: null,
}

export default memo(GameTasksViewModal)
