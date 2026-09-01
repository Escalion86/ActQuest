'use client'

import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const fieldClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60'

const sourceValue = (edge) =>
  edge?.fromItemId
    ? `item:${edge.fromItemId}`
    : edge?.fromNodeId
      ? `node:${edge.fromNodeId}`
      : ''

const entityTitle = (entries, id, fallback) =>
  entries.find((entry) => entry.id === id)?.title || fallback

const StoryEdgesEditor = ({
  isOpen,
  onClose,
  edges,
  nodes,
  items,
  onChange,
  disabled,
}) => {
  const [selectedEdgeId, setSelectedEdgeId] = useState('')
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) || null
  const selectedSourceNode = selectedEdge?.fromNodeId
    ? nodes.find((node) => node.id === selectedEdge.fromNodeId) || null
    : null
  const sourceActions = normalizeArray(selectedSourceNode?.actions)
  const sourceCodes = normalizeArray(selectedSourceNode?.codes)

  useEffect(() => {
    if (!isOpen) return
    if (!edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(edges[0]?.id || '')
    }
  }, [edges, isOpen, selectedEdgeId])

  const references = useMemo(
    () =>
      edges.map((edge) => {
        const source = edge.fromItemId
          ? entityTitle(items, edge.fromItemId, 'Неизвестный предмет')
          : entityTitle(nodes, edge.fromNodeId, 'Неизвестная локация')
        const target = entityTitle(nodes, edge.toNodeId, 'Неизвестная локация')
        return { ...edge, source, target }
      }),
    [edges, items, nodes],
  )

  const patchEdge = (patch) => {
    if (!selectedEdge) return
    onChange(
      edges.map((edge) =>
        edge.id === selectedEdge.id ? { ...edge, ...patch } : edge,
      ),
    )
  }

  const removeEdge = () => {
    if (!selectedEdge || disabled) return
    if (!window.confirm('Удалить выбранную связь?')) return
    const nextEdges = edges.filter((edge) => edge.id !== selectedEdge.id)
    onChange(nextEdges)
    setSelectedEdgeId(nextEdges[0]?.id || '')
  }

  return (
    <Modal
      isOpen={isOpen}
      title={`Связи сценария · ${edges.length}`}
      onClose={onClose}
      dialogClassName="md:max-w-6xl"
      bodyClassName="bg-slate-50/80 dark:bg-slate-950/40"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Готово
        </button>
      }
    >
      <p className="mb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Основная связь определяет, какая локация или предмет открывает следующую
        локацию. Дополнительные привязки позволяют явно указать связанное
        действие, код и предмет без редактирования служебного JSON.
      </p>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="max-h-[620px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          {references.length > 0 ? (
            references.map((edge) => (
              <button
                key={edge.id}
                type="button"
                onClick={() => setSelectedEdgeId(edge.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  edge.id === selectedEdgeId
                    ? 'border-cyan-400 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-500/10'
                    : 'border-slate-200 hover:border-cyan-300 dark:border-slate-700 dark:hover:border-cyan-600'
                }`}
              >
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {edge.source}
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                  → {edge.target}
                </span>
              </button>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
              Связей пока нет. Создайте их точками входа и выхода на графе.
            </p>
          )}
        </aside>

        {selectedEdge ? (
          <section className="rounded-2xl border border-cyan-200 bg-white p-4 dark:border-cyan-500/30 dark:bg-slate-900">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                Источник связи
                <select
                  value={sourceValue(selectedEdge)}
                  disabled={disabled}
                  onChange={(event) => {
                    const [sourceType, id] = event.target.value.split(':')
                    const isItem = sourceType === 'item'
                    patchEdge({
                      fromNodeId: isItem ? null : id || null,
                      fromItemId: isItem ? id || null : null,
                      type: isItem ? 'required_item' : 'required_node',
                      actionId: null,
                      codeId: null,
                    })
                  }}
                  className={fieldClassName}
                >
                  <optgroup label="Локации">
                    {nodes
                      .filter((node) => node.id !== selectedEdge.toNodeId)
                      .map((node) => (
                        <option key={`node:${node.id}`} value={`node:${node.id}`}>
                          {node.title || 'Локация без названия'}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Предметы">
                    {items.map((item) => (
                      <option key={`item:${item.id}`} value={`item:${item.id}`}>
                        {item.title || 'Предмет без названия'}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                Открываемая локация
                <select
                  value={selectedEdge.toNodeId || ''}
                  disabled={disabled}
                  onChange={(event) => patchEdge({ toNodeId: event.target.value })}
                  className={fieldClassName}
                >
                  {nodes
                    .filter((node) => node.id !== selectedEdge.fromNodeId)
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.title || 'Локация без названия'}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Дополнительные служебные привязки
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Поля необязательны. В списках показываются понятные названия,
                внутренние идентификаторы редактор сохранит сам.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  Связанное действие
                  <select
                    value={selectedEdge.actionId || ''}
                    disabled={disabled || !selectedSourceNode}
                    onChange={(event) =>
                      patchEdge({ actionId: event.target.value || null })
                    }
                    className={fieldClassName}
                  >
                    <option value="">Не привязывать</option>
                    {sourceActions.map((action) => (
                      <option key={action.id} value={action.id}>
                        {action.label || 'Действие без названия'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  Связанный код
                  <select
                    value={selectedEdge.codeId || ''}
                    disabled={disabled || !selectedSourceNode}
                    onChange={(event) =>
                      patchEdge({ codeId: event.target.value || null })
                    }
                    className={fieldClassName}
                  >
                    <option value="">Не привязывать</option>
                    {sourceCodes.map((code, index) => (
                      <option key={code.id} value={code.id}>
                        {code.code || `Код ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
                  Связанный предмет
                  <select
                    value={selectedEdge.itemId || ''}
                    disabled={disabled}
                    onChange={(event) =>
                      patchEdge({ itemId: event.target.value || null })
                    }
                    className={fieldClassName}
                  >
                    <option value="">Не привязывать</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title || 'Предмет без названия'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={disabled}
                onClick={removeEdge}
                className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-200"
              >
                Удалить связь
              </button>
            </div>
          </section>
        ) : (
          <section className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Выберите связь слева или создайте её на графе.
          </section>
        )}
      </div>
    </Modal>
  )
}

StoryEdgesEditor.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  edges: PropTypes.arrayOf(PropTypes.object).isRequired,
  nodes: PropTypes.arrayOf(PropTypes.object).isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

StoryEdgesEditor.defaultProps = {
  disabled: false,
}

export default StoryEdgesEditor
