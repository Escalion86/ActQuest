'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PropTypes from 'prop-types'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import requestApiJson from '@helpers/requestApiJson'

const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const emptyGame = {
  storyConfig: {
    nodeLabel: 'Локация',
    startMode: 'common',
    hideTotalNodes: true,
    hideTotalItems: true,
    showInventory: true,
    showScoreToTeam: false,
    showFinalHistoryToTeam: false,
  },
  storyItems: [],
  storyNodes: [],
  storyEdges: [],
  storyEndings: [],
}

const buildNode = (index) => ({
  id: createId('node'),
  title: `Локация ${index + 1}`,
  descriptionRich: '',
  media: [],
  coordinates: { latitude: null, longitude: null, radius: null },
  position: { x: 120 + index * 44, y: 120 + index * 44 },
  visibility: {
    startVisible: index === 0,
    requiredNodeIds: [],
    requiredItemIds: [],
    hiddenUntilUnlocked: true,
  },
  scoring: { scoreForComplete: 0 },
  clues: [],
  codes: [],
  actions: [],
})

const buildItem = (index) => ({
  id: createId('item'),
  title: `Предмет ${index + 1}`,
  image: '',
  descriptionRich: '',
  media: [],
  consumableOnUse: false,
  hiddenUntilObtained: true,
})

const buildEnding = (index) => ({
  id: createId('ending'),
  title: `Концовка ${index + 1}`,
  type: 'success',
  descriptionRich: '',
  media: [],
  conditions: {
    minScore: null,
    requiredItemIds: [],
    requiredCompletedNodeIds: [],
  },
})

const buildCode = () => ({
  id: createId('code'),
  code: '',
  type: 'complete',
  scoreBonus: 0,
  scorePenalty: 0,
  requiredItemIds: [],
  grantsItemIds: [],
  consumesItemIds: [],
  unlocksNodeIds: [],
  completesNode: true,
  endingId: null,
  resultMessageRich: '',
})

const buildAction = () => ({
  id: createId('action'),
  label: 'Действие',
  descriptionRich: '',
  requiredItemIds: [],
  grantsItemIds: [],
  consumesItemIds: [],
  unlocksNodeIds: [],
  scoreBonus: 0,
  scorePenalty: 0,
  completesNode: false,
  endingId: null,
  resultMessageRich: '',
})

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const joinCsv = (value) => normalizeArray(value).join(', ')

const syncEdgesFromNodes = (nodes, existingEdges) => {
  const edgeByKey = new Map(
    normalizeArray(existingEdges).map((edge) => [
      `${edge.fromNodeId}->${edge.toNodeId}`,
      edge,
    ]),
  )
  const edges = []
  nodes.forEach((node) => {
    const unlockTargets = new Set()
    normalizeArray(node.codes).forEach((code) => {
      normalizeArray(code.unlocksNodeIds).forEach((target) =>
        unlockTargets.add(target),
      )
    })
    normalizeArray(node.actions).forEach((action) => {
      normalizeArray(action.unlocksNodeIds).forEach((target) =>
        unlockTargets.add(target),
      )
    })
    unlockTargets.forEach((target) => {
      if (!target || target === node.id) return
      const key = `${node.id}->${target}`
      const existing = edgeByKey.get(key)
      edges.push({
        id: existing?.id || createId('edge'),
        fromNodeId: node.id,
        toNodeId: target,
        type: 'unlock',
        itemId: null,
        actionId: existing?.actionId || null,
        codeId: existing?.codeId || null,
      })
    })
  })
  return edges
}

const StoryEditorPageClient = ({ session: _session }) => {
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId') || ''
  const canvasRef = useRef(null)
  const [game, setGame] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedEndingId, setSelectedEndingId] = useState('')
  const [connectFromNodeId, setConnectFromNodeId] = useState('')
  const [dragState, setDragState] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const nodes = normalizeArray(game?.storyNodes)
  const items = normalizeArray(game?.storyItems)
  const endings = normalizeArray(game?.storyEndings)
  const edges = normalizeArray(game?.storyEdges)
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null
  const selectedItem = items.find((item) => item.id === selectedItemId) || null
  const selectedEnding =
    endings.find((ending) => ending.id === selectedEndingId) || null

  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  )

  const loadEditor = useCallback(async () => {
    if (!gameId) return
    setLoading(true)
    setError('')
    try {
      const { json } = await requestApiJson(
        `/api/cabinet/admin/story-editor?gameId=${encodeURIComponent(gameId)}`,
      )
      if (!json?.success) {
        throw new Error(json?.error || 'Не удалось загрузить редактор')
      }
      const loadedGame = {
        ...emptyGame,
        ...(json.data?.game || {}),
        storyConfig: {
          ...emptyGame.storyConfig,
          ...(json.data?.game?.storyConfig || {}),
        },
      }
      setGame(loadedGame)
      setSelectedNodeId(loadedGame.storyNodes?.[0]?.id || '')
      setSelectedItemId(loadedGame.storyItems?.[0]?.id || '')
      setSelectedEndingId(loadedGame.storyEndings?.[0]?.id || '')
    } catch (loadError) {
      setError(loadError?.message || 'Не удалось загрузить редактор')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    void loadEditor()
  }, [loadEditor])

  const updateGame = useCallback((updater) => {
    setGame((prev) => {
      const base = prev || emptyGame
      return typeof updater === 'function' ? updater(base) : updater
    })
  }, [])

  const updateNode = useCallback(
    (nodeId, updater) => {
      updateGame((prev) => ({
        ...prev,
        storyNodes: normalizeArray(prev.storyNodes).map((node) =>
          node.id === nodeId ? updater(node) : node,
        ),
      }))
    },
    [updateGame],
  )

  const updateItem = useCallback(
    (itemId, updater) => {
      updateGame((prev) => ({
        ...prev,
        storyItems: normalizeArray(prev.storyItems).map((item) =>
          item.id === itemId ? updater(item) : item,
        ),
      }))
    },
    [updateGame],
  )

  const updateEnding = useCallback(
    (endingId, updater) => {
      updateGame((prev) => ({
        ...prev,
        storyEndings: normalizeArray(prev.storyEndings).map((ending) =>
          ending.id === endingId ? updater(ending) : ending,
        ),
      }))
    },
    [updateGame],
  )

  const addNode = useCallback(() => {
    updateGame((prev) => {
      const nextNode = buildNode(normalizeArray(prev.storyNodes).length)
      setSelectedNodeId(nextNode.id)
      return {
        ...prev,
        storyNodes: [...normalizeArray(prev.storyNodes), nextNode],
      }
    })
  }, [updateGame])

  const addItem = useCallback(() => {
    updateGame((prev) => {
      const nextItem = buildItem(normalizeArray(prev.storyItems).length)
      setSelectedItemId(nextItem.id)
      return {
        ...prev,
        storyItems: [...normalizeArray(prev.storyItems), nextItem],
      }
    })
  }, [updateGame])

  const addEnding = useCallback(() => {
    updateGame((prev) => {
      const nextEnding = buildEnding(normalizeArray(prev.storyEndings).length)
      setSelectedEndingId(nextEnding.id)
      return {
        ...prev,
        storyEndings: [...normalizeArray(prev.storyEndings), nextEnding],
      }
    })
  }, [updateGame])

  const removeNode = useCallback(() => {
    if (!selectedNodeId) return
    if (!window.confirm('Удалить локацию и связи с ней?')) return
    updateGame((prev) => {
      const storyNodes = normalizeArray(prev.storyNodes)
        .filter((node) => node.id !== selectedNodeId)
        .map((node) => ({
          ...node,
          visibility: {
            ...node.visibility,
            requiredNodeIds: normalizeArray(
              node.visibility?.requiredNodeIds,
            ).filter((id) => id !== selectedNodeId),
          },
          codes: normalizeArray(node.codes).map((code) => ({
            ...code,
            unlocksNodeIds: normalizeArray(code.unlocksNodeIds).filter(
              (id) => id !== selectedNodeId,
            ),
          })),
          actions: normalizeArray(node.actions).map((action) => ({
            ...action,
            unlocksNodeIds: normalizeArray(action.unlocksNodeIds).filter(
              (id) => id !== selectedNodeId,
            ),
          })),
        }))
      const storyEdges = normalizeArray(prev.storyEdges).filter(
        (edge) =>
          edge.fromNodeId !== selectedNodeId && edge.toNodeId !== selectedNodeId,
      )
      setSelectedNodeId(storyNodes[0]?.id || '')
      return { ...prev, storyNodes, storyEdges }
    })
  }, [selectedNodeId, updateGame])

  const connectNode = useCallback(
    (targetNodeId) => {
      if (!connectFromNodeId || connectFromNodeId === targetNodeId) {
        setConnectFromNodeId(targetNodeId)
        return
      }
      updateNode(connectFromNodeId, (node) => {
        const actions = normalizeArray(node.actions)
        const unlockAction = actions[0] || {
          ...buildAction(),
          label: 'Открыть локацию',
        }
        const nextUnlockAction = {
          ...unlockAction,
          unlocksNodeIds: Array.from(
            new Set([...normalizeArray(unlockAction.unlocksNodeIds), targetNodeId]),
          ),
        }
        return {
          ...node,
          actions:
            actions.length > 0
              ? actions.map((action, index) =>
                  index === 0 ? nextUnlockAction : action,
                )
              : [nextUnlockAction],
        }
      })
      updateGame((prev) => {
        const edgeExists = normalizeArray(prev.storyEdges).some(
          (edge) =>
            edge.fromNodeId === connectFromNodeId &&
            edge.toNodeId === targetNodeId,
        )
        return {
          ...prev,
          storyEdges: edgeExists
            ? prev.storyEdges
            : [
                ...normalizeArray(prev.storyEdges),
                {
                  id: createId('edge'),
                  fromNodeId: connectFromNodeId,
                  toNodeId: targetNodeId,
                  type: 'unlock',
                  itemId: null,
                  actionId: null,
                  codeId: null,
                },
              ],
        }
      })
      setConnectFromNodeId('')
    },
    [connectFromNodeId, updateGame, updateNode],
  )

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragState || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left - dragState.offsetX
      const y = event.clientY - rect.top - dragState.offsetY
      updateNode(dragState.nodeId, (node) => ({
        ...node,
        position: {
          x: Math.max(20, Math.round(x)),
          y: Math.max(20, Math.round(y)),
        },
      }))
    },
    [dragState, updateNode],
  )

  const handlePointerUp = useCallback(() => {
    setDragState(null)
  }, [])

  const saveEditor = useCallback(async () => {
    if (!gameId || !game) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const storyEdges = syncEdgesFromNodes(game.storyNodes, game.storyEdges)
      const { json } = await requestApiJson('/api/cabinet/admin/story-editor', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gameId,
          storyConfig: game.storyConfig,
          storyItems: game.storyItems,
          storyNodes: game.storyNodes,
          storyEdges,
          storyEndings: game.storyEndings,
        }),
      })
      if (!json?.success) {
        throw new Error(json?.error || 'Не удалось сохранить сценарий')
      }
      setGame({
        ...emptyGame,
        ...(json.data?.game || {}),
        storyConfig: {
          ...emptyGame.storyConfig,
          ...(json.data?.game?.storyConfig || {}),
        },
      })
      setFeedback('Сценарий сохранен')
    } catch (saveError) {
      setError(saveError?.message || 'Не удалось сохранить сценарий')
    } finally {
      setSaving(false)
    }
  }, [game, gameId])

  const canvasSize = useMemo(() => {
    const maxX = Math.max(...nodes.map((node) => Number(node.position?.x) || 0), 900)
    const maxY = Math.max(...nodes.map((node) => Number(node.position?.y) || 0), 520)
    return { width: maxX + 260, height: maxY + 180 }
  }, [nodes])

  if (!gameId) {
    return (
      <CabinetLayout
        title="Story-редактор"
        description="Откройте редактор из карточки конкретной story-игры."
        activePage="admin"
      >
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Не указан `gameId`. Откройте редактор по ссылке вида
          `/cabinet/admin/story-editor?gameId=...`.
        </div>
      </CabinetLayout>
    )
  }

  return (
    <CabinetLayout
      title="Story-редактор"
      description={game?.name || 'Редактирование сценарного графа'}
      activePage="admin"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addNode}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              Добавить локацию
            </button>
            <button
              type="button"
              onClick={addItem}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Добавить предмет
            </button>
            <button
              type="button"
              onClick={addEnding}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Добавить концовку
            </button>
          </div>
          <button
            type="button"
            onClick={() => void saveEditor()}
            disabled={saving || loading}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Сохраняем...' : 'Сохранить сценарий'}
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}
        {feedback ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
            {feedback}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Граф сценария
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {connectFromNodeId
                  ? 'Выберите вторую локацию для связи'
                  : 'Перетаскивайте локации мышью'}
              </span>
            </div>
            <div
              ref={canvasRef}
              className="relative h-[620px] overflow-auto"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <div
                className="relative"
                style={{ width: canvasSize.width, height: canvasSize.height }}
              >
                <svg
                  className="absolute inset-0 h-full w-full"
                  width={canvasSize.width}
                  height={canvasSize.height}
                >
                  {edges.map((edge) => {
                    const from = nodesById.get(edge.fromNodeId)
                    const to = nodesById.get(edge.toNodeId)
                    if (!from || !to) return null
                    const x1 = (Number(from.position?.x) || 0) + 88
                    const y1 = (Number(from.position?.y) || 0) + 42
                    const x2 = (Number(to.position?.x) || 0) + 88
                    const y2 = (Number(to.position?.y) || 0) + 42
                    return (
                      <g key={edge.id}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="rgb(6 182 212)"
                          strokeWidth="2"
                          strokeDasharray={edge.type === 'requires_item' ? '6 5' : ''}
                        />
                        <circle cx={x2} cy={y2} r="4" fill="rgb(6 182 212)" />
                      </g>
                    )
                  })}
                </svg>
                {nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId
                  const isConnectSource = node.id === connectFromNodeId
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setSelectedNodeId(node.id)
                        if (connectFromNodeId) {
                          connectNode(node.id)
                        }
                      }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        const rect = event.currentTarget.getBoundingClientRect()
                        setDragState({
                          nodeId: node.id,
                          offsetX: event.clientX - rect.left,
                          offsetY: event.clientY - rect.top,
                        })
                        setSelectedNodeId(node.id)
                      }}
                      className={`absolute w-44 rounded-2xl border p-3 text-left shadow-sm transition ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-300 dark:bg-cyan-500/15'
                          : isConnectSource
                            ? 'border-violet-400 bg-violet-50 dark:bg-violet-500/15'
                            : 'border-slate-300 bg-white hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      style={{
                        left: Number(node.position?.x) || 0,
                        top: Number(node.position?.y) || 0,
                      }}
                    >
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                        {node.title || node.id}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                        {node.visibility?.startVisible ? 'Стартовая' : 'Локация'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Настройки
              </h2>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  Название блока
                  <input
                    value={game?.storyConfig?.nodeLabel || 'Локация'}
                    onChange={(event) =>
                      updateGame((prev) => ({
                        ...prev,
                        storyConfig: {
                          ...prev.storyConfig,
                          nodeLabel: event.target.value,
                        },
                      }))
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(game?.storyConfig?.showScoreToTeam)}
                    onChange={(event) =>
                      updateGame((prev) => ({
                        ...prev,
                        storyConfig: {
                          ...prev.storyConfig,
                          showScoreToTeam: event.target.checked,
                        },
                      }))
                    }
                  />
                  Показывать баллы команде
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  Локация
                </h2>
                {selectedNode ? (
                  <button
                    type="button"
                    onClick={removeNode}
                    className="text-sm font-semibold text-rose-600 hover:text-rose-500"
                  >
                    Удалить
                  </button>
                ) : null}
              </div>
              {selectedNode ? (
                <div className="mt-3 grid gap-3">
                  <input
                    value={selectedNode.title || ''}
                    onChange={(event) =>
                      updateNode(selectedNode.id, (node) => ({
                        ...node,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Название"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <textarea
                    value={selectedNode.descriptionRich || ''}
                    onChange={(event) =>
                      updateNode(selectedNode.id, (node) => ({
                        ...node,
                        descriptionRich: event.target.value,
                      }))
                    }
                    rows={5}
                    placeholder="Описание HTML/rich-text"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedNode.visibility?.startVisible)}
                        onChange={(event) =>
                          updateNode(selectedNode.id, (node) => ({
                            ...node,
                            visibility: {
                              ...node.visibility,
                              startVisible: event.target.checked,
                            },
                          }))
                        }
                      />
                      Стартовая
                    </label>
                    <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                      Баллы
                      <input
                        type="number"
                        value={selectedNode.scoring?.scoreForComplete || 0}
                        onChange={(event) =>
                          updateNode(selectedNode.id, (node) => ({
                            ...node,
                            scoring: {
                              ...node.scoring,
                              scoreForComplete: Number(event.target.value) || 0,
                            },
                          }))
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                    Предметы для доступа, через запятую
                    <input
                      value={joinCsv(selectedNode.visibility?.requiredItemIds)}
                      onChange={(event) =>
                        updateNode(selectedNode.id, (node) => ({
                          ...node,
                          visibility: {
                            ...node.visibility,
                            requiredItemIds: parseCsv(event.target.value),
                          },
                        }))
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setConnectFromNodeId(selectedNode.id)}
                      className="rounded-xl border border-cyan-300 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/40 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                    >
                      Связать с локацией
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateNode(selectedNode.id, (node) => ({
                          ...node,
                          codes: [...normalizeArray(node.codes), buildCode()],
                        }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      + Код
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateNode(selectedNode.id, (node) => ({
                          ...node,
                          actions: [...normalizeArray(node.actions), buildAction()],
                        }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      + Действие
                    </button>
                  </div>
                  {normalizeArray(selectedNode.codes).map((code) => (
                    <div
                      key={code.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Код
                      </p>
                      <div className="mt-2 grid gap-2">
                        <input
                          value={code.code || ''}
                          onChange={(event) =>
                            updateNode(selectedNode.id, (node) => ({
                              ...node,
                              codes: normalizeArray(node.codes).map((item) =>
                                item.id === code.id
                                  ? { ...item, code: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="Код"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                        />
                        <input
                          value={joinCsv(code.grantsItemIds)}
                          onChange={(event) =>
                            updateNode(selectedNode.id, (node) => ({
                              ...node,
                              codes: normalizeArray(node.codes).map((item) =>
                                item.id === code.id
                                  ? {
                                      ...item,
                                      grantsItemIds: parseCsv(event.target.value),
                                    }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="Выдаёт предметы: item-id"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Выберите локацию.</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Предметы
              </h2>
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Выберите предмет</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title || item.id}
                  </option>
                ))}
              </select>
              {selectedItem ? (
                <div className="mt-3 grid gap-2">
                  <input
                    value={selectedItem.title || ''}
                    onChange={(event) =>
                      updateItem(selectedItem.id, (item) => ({
                        ...item,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Название предмета"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <input
                    value={selectedItem.image || ''}
                    onChange={(event) =>
                      updateItem(selectedItem.id, (item) => ({
                        ...item,
                        image: event.target.value,
                      }))
                    }
                    placeholder="URL картинки"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedItem.consumableOnUse)}
                      onChange={(event) =>
                        updateItem(selectedItem.id, (item) => ({
                          ...item,
                          consumableOnUse: event.target.checked,
                        }))
                      }
                    />
                    Исчезает после применения
                  </label>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Концовки
              </h2>
              <select
                value={selectedEndingId}
                onChange={(event) => setSelectedEndingId(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Выберите концовку</option>
                {endings.map((ending) => (
                  <option key={ending.id} value={ending.id}>
                    {ending.title || ending.id}
                  </option>
                ))}
              </select>
              {selectedEnding ? (
                <div className="mt-3 grid gap-2">
                  <input
                    value={selectedEnding.title || ''}
                    onChange={(event) =>
                      updateEnding(selectedEnding.id, (ending) => ({
                        ...ending,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Название концовки"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <select
                    value={selectedEnding.type || 'success'}
                    onChange={(event) =>
                      updateEnding(selectedEnding.id, (ending) => ({
                        ...ending,
                        type: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="success">Успех</option>
                    <option value="failed">Провал</option>
                    <option value="neutral">Нейтральная</option>
                    <option value="secret">Секретная</option>
                  </select>
                  <textarea
                    value={selectedEnding.descriptionRich || ''}
                    onChange={(event) =>
                      updateEnding(selectedEnding.id, (ending) => ({
                        ...ending,
                        descriptionRich: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Описание финала"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </CabinetLayout>
  )
}

StoryEditorPageClient.propTypes = {
  session: PropTypes.object,
}

StoryEditorPageClient.defaultProps = {
  session: null,
}

export default StoryEditorPageClient
