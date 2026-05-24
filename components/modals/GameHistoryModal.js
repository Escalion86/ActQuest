import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import requestApiJson from '@helpers/requestApiJson'

const HISTORY_API_BASE = '/api/cabinet/games'
const isDeveloperRole = (role) =>
  typeof role === 'string' && role.trim().toLowerCase() === 'dev'

const formatDateTime = (value) => {
  if (!value) {
    return 'Неизвестно'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Неизвестно'
  }

  return date.toLocaleString('ru-RU')
}

const PRETTY_ACTION_LABELS = {
  game_created: 'Создание игры',
  game_updated: 'Изменение игры',
  game_status_changed: 'Изменение статуса',
  team_registered: 'Регистрация команды',
  team_unregistered: 'Снятие команды',
  team_adjustments_updated: 'Корректировки времени',
  team_out_of_competition_changed: 'Вне зачёта',
  results_rebuilt: 'Пересчёт результатов',
  rollback_applied: 'Откат',
}

const JsonBlock = ({ value }) => (
  <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
    {JSON.stringify(value, null, 2)}
  </pre>
)

const DiffList = ({ diff }) => {
  if (!Array.isArray(diff) || diff.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-300">
        Нет компактного diff. Смотрите блоки «Было» и «Стало».
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {diff.map((entry, index) => (
        <div
          key={`${entry.path || 'entry'}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60"
        >
          <p className="text-sm font-semibold text-slate-800 dark:text-white">
            {entry.label || entry.path || 'Изменение'}
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <JsonBlock value={entry.beforeValue ?? null} />
            <JsonBlock value={entry.afterValue ?? null} />
          </div>
        </div>
      ))}
    </div>
  )
}

const GameHistoryModal = ({
  selectedGame,
  isOpen,
  onClose,
  onRollbackSuccess,
  currentUserRole,
}) => {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedEntryId, setExpandedEntryId] = useState('')
  const [detailsById, setDetailsById] = useState({})
  const [detailLoadingId, setDetailLoadingId] = useState('')
  const [rollbackEntryId, setRollbackEntryId] = useState('')

  const selectedGameId = typeof selectedGame?.id === 'string' ? selectedGame.id : ''
  const expandedEntry = expandedEntryId ? detailsById[expandedEntryId] : null
  const isGameStarted =
    String(selectedGame?.status || '').trim().toLowerCase() === 'started'
  const canViewRawHistoryState = isDeveloperRole(currentUserRole)

  const loadHistoryList = useCallback(async () => {
    if (!selectedGameId) {
      setItems([])
      setError('')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const { json } = await requestApiJson(
        `${HISTORY_API_BASE}/${encodeURIComponent(selectedGameId)}/history`,
        {
          fallbackMessage: 'Не удалось загрузить историю игры',
        },
      )
      setItems(Array.isArray(json?.data) ? json.data : [])
    } catch (loadError) {
      setError(loadError?.message || 'Не удалось загрузить историю игры')
    } finally {
      setIsLoading(false)
    }
  }, [selectedGameId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    void loadHistoryList()
  }, [isOpen, loadHistoryList])

  useEffect(() => {
    if (!isOpen) {
      setExpandedEntryId('')
      setDetailsById({})
      setDetailLoadingId('')
      setRollbackEntryId('')
    }
  }, [isOpen])

  const loadEntryDetails = useCallback(
    async (entryId) => {
      if (!selectedGameId || !entryId) {
        return
      }

      if (detailsById[entryId]) {
        setExpandedEntryId((prev) => (prev === entryId ? '' : entryId))
        return
      }

      setDetailLoadingId(entryId)
      try {
        const { json } = await requestApiJson(
          `${HISTORY_API_BASE}/${encodeURIComponent(selectedGameId)}/history/${encodeURIComponent(entryId)}`,
          {
            fallbackMessage: 'Не удалось загрузить детали записи истории',
          },
        )

        setDetailsById((prev) => ({
          ...prev,
          [entryId]: json?.data || null,
        }))
        setExpandedEntryId((prev) => (prev === entryId ? '' : entryId))
      } catch (loadError) {
        setError(
          loadError?.message || 'Не удалось загрузить детали записи истории',
        )
      } finally {
        setDetailLoadingId('')
      }
    },
    [detailsById, selectedGameId],
  )

  const rollbackWarnings = useMemo(() => {
    if (!expandedEntry) {
      return []
    }

    const warnings = Array.isArray(expandedEntry?.warnings)
      ? [...expandedEntry.warnings]
      : []
    if (isGameStarted) {
      warnings.unshift(
        'Игра уже запущена. Откат может затронуть живой прогресс команд.',
      )
    }

    return Array.from(new Set(warnings))
  }, [expandedEntry, isGameStarted])

  const handleRollback = useCallback(async () => {
    if (!expandedEntry?.id || !selectedGameId) {
      return
    }

    const confirmLines = [
      'Откат восстановит игру на выбранную точку времени.',
      'Все более новые изменения будут отменены.',
      'Рейтинги и закрытая статистика не пересчитываются автоматически.',
      ...rollbackWarnings,
      '',
      'Продолжить?',
    ]

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(confirmLines.join('\n'))
      if (!confirmed) {
        return
      }
    }

    setRollbackEntryId(expandedEntry.id)
    setError('')
    try {
      const { json } = await requestApiJson(
        `${HISTORY_API_BASE}/${encodeURIComponent(selectedGameId)}/history/${encodeURIComponent(expandedEntry.id)}/rollback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          fallbackMessage: 'Не удалось выполнить откат истории игры',
        },
      )

      await loadHistoryList()
      setExpandedEntryId('')
      setDetailsById({})
      onRollbackSuccess?.(json?.data || null)
    } catch (rollbackError) {
      setError(
        rollbackError?.message || 'Не удалось выполнить откат истории игры',
      )
    } finally {
      setRollbackEntryId('')
    }
  }, [
    expandedEntry,
    loadHistoryList,
    onRollbackSuccess,
    rollbackWarnings,
    selectedGameId,
  ])

  const modalFooter = (
    <CabinetButton onClick={onClose} variant="secondary">
      Закрыть
    </CabinetButton>
  )

  return (
    <Modal
      isOpen={isOpen}
      title={`История игры — ${selectedGame?.name || 'Без названия'}`}
      onClose={onClose}
      footer={modalFooter}
      dialogClassName="md:max-w-6xl"
    >
      <div className="space-y-4">
        {isGameStarted ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/45 dark:bg-rose-500/12 dark:text-rose-200">
            Игра уже запущена. Любой rollback здесь потенциально затронет живой
            прогресс команд.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/45 dark:bg-rose-500/12 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Загружаем историю…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            По этой игре пока нет записей истории.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isExpanded = expandedEntryId === item.id
              const detail = detailsById[item.id]
              const isLoadingDetail = detailLoadingId === item.id
              const actionLabel =
                PRETTY_ACTION_LABELS[item.actionType] || item.actionType

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                        {actionLabel}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {item.summary || 'Без описания'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(item.createdAt)}
                        {item?.actor?.name ? ` · ${item.actor.name}` : ''}
                        {item?.actor?.role ? ` · ${item.actor.role}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(item.warnings) && item.warnings.length > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-400/45 dark:bg-amber-500/12 dark:text-amber-200">
                          Предупреждения: {item.warnings.length}
                        </span>
                      ) : null}
                      <CabinetButton
                        onClick={() => void loadEntryDetails(item.id)}
                        variant="secondary"
                        size="sm"
                      >
                        {isExpanded ? 'Скрыть' : 'Подробнее'}
                      </CabinetButton>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                      {isLoadingDetail && !detail ? (
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                          Загружаем детали…
                        </p>
                      ) : detail ? (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                              Что изменилось
                            </h3>
                            <div className="mt-2">
                              <DiffList diff={detail.diff} />
                            </div>
                          </div>

                          {canViewRawHistoryState &&
                          (detail.before || detail.after) ? (
                            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                              <summary className="cursor-pointer text-sm font-semibold text-slate-800 marker:hidden dark:text-white">
                                Технические данные записи
                              </summary>
                              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                                    Было
                                  </h3>
                                  <div className="mt-2">
                                    <JsonBlock value={detail.before} />
                                  </div>
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                                    Стало
                                  </h3>
                                  <div className="mt-2">
                                    <JsonBlock value={detail.after} />
                                  </div>
                                </div>
                              </div>
                            </details>
                          ) : null}

                          {rollbackWarnings.length > 0 ? (
                            <div>
                              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                                Предупреждения
                              </h3>
                              <div className="mt-2 space-y-2">
                                {rollbackWarnings.map((warning) => (
                                  <div
                                    key={warning}
                                    className={`rounded-2xl border px-4 py-3 text-sm ${
                                      warning.includes('запущена') ||
                                      warning.includes('живой прогресс')
                                        ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/45 dark:bg-rose-500/12 dark:text-rose-200'
                                        : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/45 dark:bg-amber-500/12 dark:text-amber-200'
                                    }`}
                                  >
                                    {warning}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {detail.canRollback ? (
                            <div className="flex justify-end">
                              <CabinetButton
                                onClick={() => void handleRollback()}
                                variant="secondary"
                                tone="danger"
                                disabled={rollbackEntryId === detail.id}
                              >
                                {rollbackEntryId === detail.id
                                  ? 'Откатываем…'
                                  : 'Откатить к этому состоянию'}
                              </CabinetButton>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

JsonBlock.propTypes = {
  value: PropTypes.any,
}

JsonBlock.defaultProps = {
  value: null,
}

DiffList.propTypes = {
  diff: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string,
      label: PropTypes.string,
      kind: PropTypes.string,
      beforeValue: PropTypes.any,
      afterValue: PropTypes.any,
    }),
  ),
}

DiffList.defaultProps = {
  diff: [],
}

GameHistoryModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    status: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRollbackSuccess: PropTypes.func,
  currentUserRole: PropTypes.string,
}

GameHistoryModal.defaultProps = {
  selectedGame: null,
  onRollbackSuccess: undefined,
  currentUserRole: '',
}

export default memo(GameHistoryModal)
