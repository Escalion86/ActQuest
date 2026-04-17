import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import TiptapContentView from '@components/cabinet/TiptapContentView'
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

  // Исторический дефолт: 0,0 трактуем как "координаты не заданы".
  if (Math.abs(latitude) < 1e-9 && Math.abs(longitude) < 1e-9) {
    return null
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  return { latitude, longitude }
}

const normalizeCodeRows = (values) =>
  (Array.isArray(values) ? values : [])
    .map((item) => {
      if (typeof item === 'string') {
        const code = item.trim()
        return code ? { code, image: '' } : null
      }

      if (!item || typeof item !== 'object') {
        return null
      }

      const code =
        (typeof item.code === 'string' && item.code.trim()) ||
        (typeof item.value === 'string' && item.value.trim()) ||
        (typeof item.text === 'string' && item.text.trim()) ||
        ''

      if (!code) {
        return null
      }

      const image = typeof item.image === 'string' ? item.image.trim() : ''
      return { code, image }
    })
    .filter(Boolean)

const GameTasksViewModal = ({
  isTasksViewModalOpen,
  handleCloseTasksViewModal,
  selectedGame,
  canViewCodePhotos,
  showAllTaskDetails,
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
    [selectedGame?.tasks],
  )

  const toggleTask = useCallback((taskId) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
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

  const renderCodeGroup = (title, rows, tone) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return null
    }

    const palette =
      tone === 'bonus'
        ? {
            badge:
              'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200',
            summary:
              'text-emerald-700 dark:text-emerald-200',
          }
        : tone === 'penalty'
          ? {
              badge:
                'border-red-300/70 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/12 dark:text-red-200',
              summary:
                'text-red-700 dark:text-red-200',
            }
          : {
              badge:
                'border-cyan-300/70 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/12 dark:text-cyan-200',
              summary:
                'text-cyan-700 dark:text-cyan-200',
            }

    const photos = canViewCodePhotos
      ? rows
          .map((item, index) => ({
            key: `${title}-${index}`,
            code: item.code,
            image:
              typeof item.image === 'string' ? item.image.trim() : '',
          }))
          .filter((item) => Boolean(item.image))
      : []

    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
          {title}
        </p>
        <div className="flex flex-wrap gap-2">
          {rows.map((item, index) => (
            <span
              key={`${title}-${item.code}-${index}`}
              className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${palette.badge}`}
            >
              {item.code}
            </span>
          ))}
        </div>
        {photos.length > 0 && (
          <details className="rounded-lg border border-slate-200/80 bg-white/60 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/50">
            <summary
              className={`cursor-pointer select-none text-xs font-semibold ${palette.summary}`}
            >
              Фото кодов ({photos.length})
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((item) => (
                <a
                  key={`${item.key}-${item.code}`}
                  href={item.image}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  title={`Открыть фото для кода ${item.code}`}
                >
                  <img
                    src={item.image}
                    alt={`Фото для кода ${item.code}`}
                    className="h-24 w-full object-cover"
                  />
                </a>
              ))}
            </div>
          </details>
        )}
      </div>
    )
  }

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
              <p className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
                Координаты
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {coordinates.latitude.toFixed(6)},{' '}
                {coordinates.longitude.toFixed(6)}
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

    const mainCodes = normalizeCodeRows(
      (Array.isArray(task?.codes) ? task.codes : []).map((code, index) => ({
        code,
        image: Array.isArray(task?.codePhotos) ? task.codePhotos[index] : '',
      })),
    )
    const bonusCodes = normalizeCodeRows(task?.bonusCodes)
    const penaltyCodes = normalizeCodeRows(task?.penaltyCodes)
    const hasAnyCodes =
      mainCodes.length > 0 || bonusCodes.length > 0 || penaltyCodes.length > 0

    if (!hasAnyCodes) {
      return (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Ответ для этого задания не задан.
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {renderCodeGroup('Основные коды', mainCodes, 'main')}
        {renderCodeGroup('Бонусные коды', bonusCodes, 'bonus')}
        {renderCodeGroup('Штрафные коды', penaltyCodes, 'penalty')}
        {hasCoordinates && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
              Координаты
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {coordinates.latitude.toFixed(6)},{' '}
              {coordinates.longitude.toFixed(6)}
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
          <ModalSection className="p-4 sm:p-5">
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
            const visibleClues = showAllTaskDetails
              ? clues
              : clues.slice(0, revealState.cluesOpened)
            const hasMoreClues = showAllTaskDetails
              ? false
              : revealState.cluesOpened < clues.length
            const canShowAnswer =
              !showAllTaskDetails && !hasMoreClues && !revealState.answerOpened
            const canRevealNext = hasMoreClues || canShowAnswer
            const actionLabel = hasMoreClues
              ? 'Открыть подсказку'
              : 'Показать ответ'
            const isAnswerVisible =
              showAllTaskDetails || revealState.answerOpened

            return (
              <ModalSection key={taskId} className="overflow-hidden" noPadding>
                <button
                  type="button"
                  onClick={() => toggleTask(taskId)}
                  className="flex items-center justify-between w-full gap-3 px-4 py-3 text-sm font-semibold text-left transition bg-slate-50 text-slate-700 hover:bg-blue-50 dark:bg-slate-800/70 dark:text-white dark:hover:bg-sky-500/10"
                >
                  <span>
                    {index + 1}. {task?.title || 'Без названия'}
                  </span>
                  <span className="text-xs">
                    {isExpanded ? 'Свернуть' : 'Развернуть'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 py-4 space-y-4">
                    <div>
                      <ModalSectionTitle>Описание задания</ModalSectionTitle>
                      <div className="mt-2">
                        <TiptapContentView
                          html={task?.taskRich}
                          text={task?.task}
                          emptyText="Описание отсутствует."
                          className="text-sm leading-relaxed text-slate-700 dark:prose-invert dark:text-slate-200"
                          textClassName="text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                          emptyClassName="text-sm text-slate-500 dark:text-slate-300"
                        />
                      </div>
                    </div>

                    {visibleClues.length > 0 && (
                      <div className="space-y-3">
                        <ModalSectionTitle>Подсказки</ModalSectionTitle>
                        {visibleClues.map((clue, clueIndex) => (
                          <div
                            key={`${taskId}-clue-${clueIndex}`}
                            className="px-3 py-2 border rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
                          >
                            <p className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-300">
                              Подсказка {clueIndex + 1}
                            </p>
                            <div className="mt-1">
                              <TiptapContentView
                                html={clue?.clueRich}
                                text={clue?.clue}
                                emptyText="Текст подсказки отсутствует."
                                className="text-sm leading-relaxed text-slate-700 dark:prose-invert dark:text-slate-200"
                                textClassName="text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                                emptyClassName="text-sm text-slate-500 dark:text-slate-300"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isAnswerVisible && (
                      <div className="px-3 py-3 space-y-2 border rounded-xl border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-500/35 dark:bg-emerald-500/10">
                        <ModalSectionTitle>Ответ</ModalSectionTitle>
                        {renderAnswer(task)}
                        {typeof task?.howToSolve === 'string' &&
                          task.howToSolve.trim() && (
                            <div className="pt-2 border-t border-emerald-300/50 dark:border-emerald-500/30">
                              <ModalSectionTitle>
                                Как разгадать?
                              </ModalSectionTitle>
                              <div className="mt-1">
                                <TiptapContentView
                                  text={task.howToSolve}
                                  emptyText="Описание разгадки не задано."
                                  className="text-sm leading-relaxed text-slate-700 dark:prose-invert dark:text-slate-200"
                                  textClassName="text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                                  emptyClassName="text-sm text-slate-500 dark:text-slate-300"
                                />
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {canRevealNext && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            revealNextStep({ ...task, id: taskId })
                          }
                          className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold transition border cursor-pointer rounded-xl border-cyan-300/70 bg-cyan-50 text-cyan-700 hover:border-cyan-500 hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/12 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
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
  canViewCodePhotos: PropTypes.bool,
  showAllTaskDetails: PropTypes.bool,
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string,
    tasks: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        title: PropTypes.string,
        task: PropTypes.string,
        howToSolve: PropTypes.string,
        taskRich: PropTypes.string,
        coordinates: PropTypes.shape({
          latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
          longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        }),
        codes: PropTypes.arrayOf(PropTypes.string),
        codePhotos: PropTypes.arrayOf(PropTypes.string),
        bonusCodes: PropTypes.arrayOf(
          PropTypes.shape({
            code: PropTypes.string,
            image: PropTypes.string,
          }),
        ),
        penaltyCodes: PropTypes.arrayOf(
          PropTypes.shape({
            code: PropTypes.string,
            image: PropTypes.string,
          }),
        ),
        clues: PropTypes.arrayOf(
          PropTypes.shape({
            clue: PropTypes.string,
            clueRich: PropTypes.string,
          }),
        ),
      }),
    ),
  }),
}

GameTasksViewModal.defaultProps = {
  selectedGame: null,
  canViewCodePhotos: false,
  showAllTaskDetails: false,
}

export default memo(GameTasksViewModal)
