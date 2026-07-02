'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import ImagesInput from '@components/cabinet/ImagesInput'
import requestApiJson from '@helpers/requestApiJson'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const NODE_CARD = { width: 190, height: 92 }
const ITEM_CARD = { width: 170, height: 76 }
const ENDING_CARD = { width: 180, height: 76 }
const DRAG_CLICK_SUPPRESS_DISTANCE = 4

const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const normalizeInputMode = (value) =>
  ['all', 'any', 'count'].includes(value) ? value : 'all'

const getDefaultEndingPosition = (index) => ({
  x: 420 + index * 48,
  y: 140 + index * 88,
})

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
  agents: [],
}

const buildNode = (index) => ({
  id: createId('node'),
  title: `Локация ${index + 1}`,
  descriptionRich: '',
  media: [],
  coordinates: { latitude: null, longitude: null, radius: null },
  position: { x: 140 + index * 54, y: 140 + index * 54 },
  visibility: {
    startVisible: index === 0,
    requiredNodeIds: [],
    requiredItemIds: [],
    requiredInputMode: 'all',
    requiredInputCount: 1,
    hiddenUntilUnlocked: true,
  },
  scoring: { scoreForComplete: 0 },
  clues: [],
  codes: [],
  actions: [],
  agentUserIds: [],
})

const buildItem = (index) => ({
  id: createId('item'),
  title: `Предмет ${index + 1}`,
  image: '',
  descriptionRich: '',
  media: [],
  position: { x: 120, y: 420 + index * 96 },
  consumableOnUse: false,
  hiddenUntilObtained: true,
})

const buildEnding = (index) => ({
  id: createId('ending'),
  title: `Концовка ${index + 1}`,
  type: 'success',
  descriptionRich: '',
  media: [],
  position: getDefaultEndingPosition(index),
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

const buildClue = () => ({
  id: createId('clue'),
  title: 'Подсказка',
  contentRich: '',
  media: [],
  scorePenalty: 0,
})

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const joinCsv = (value) => normalizeArray(value).join(', ')

const buildEdgeKey = (edge) =>
  `${edge?.type || 'required_node'}:${edge?.fromNodeId || edge?.fromItemId || ''}->${edge?.toNodeId || ''}`

const syncNodesFromEdges = (nodes, edges) => {
  const requiredNodeIdsByNode = new Map()
  const requiredItemIdsByNode = new Map()

  normalizeArray(edges).forEach((edge) => {
    const toNodeId = normalizeText(edge?.toNodeId)
    if (!toNodeId) return

    if (edge?.type === 'required_item' && edge?.fromItemId) {
      const itemIds = requiredItemIdsByNode.get(toNodeId) || new Set()
      itemIds.add(edge.fromItemId)
      requiredItemIdsByNode.set(toNodeId, itemIds)
      return
    }

    if (edge?.fromNodeId) {
      const nodeIds = requiredNodeIdsByNode.get(toNodeId) || new Set()
      nodeIds.add(edge.fromNodeId)
      requiredNodeIdsByNode.set(toNodeId, nodeIds)
    }
  })

  return normalizeArray(nodes).map((node) => ({
    ...node,
    visibility: {
      ...node.visibility,
      requiredNodeIds: Array.from(requiredNodeIdsByNode.get(node.id) || []),
      requiredItemIds: Array.from(requiredItemIdsByNode.get(node.id) || []),
      requiredInputMode: normalizeInputMode(node?.visibility?.requiredInputMode),
      requiredInputCount: Math.max(
        1,
        Math.trunc(Number(node?.visibility?.requiredInputCount) || 1),
      ),
    },
  }))
}

const sanitizeEdges = (edges, nodes, items) => {
  const nodeIds = new Set(normalizeArray(nodes).map((node) => node.id))
  const itemIds = new Set(normalizeArray(items).map((item) => item.id))
  const seen = new Set()
  const result = []

  normalizeArray(edges).forEach((edge) => {
    const toNodeId = normalizeText(edge?.toNodeId)
    const fromNodeId = normalizeText(edge?.fromNodeId)
    const fromItemId = normalizeText(edge?.fromItemId)
    const type = fromItemId ? 'required_item' : 'required_node'

    if (!toNodeId || !nodeIds.has(toNodeId)) return
    if (fromNodeId && (!nodeIds.has(fromNodeId) || fromNodeId === toNodeId)) {
      return
    }
    if (fromItemId && !itemIds.has(fromItemId)) return
    if (!fromNodeId && !fromItemId) return

    const nextEdge = {
      id: normalizeText(edge?.id) || createId('edge'),
      fromNodeId: fromNodeId || null,
      fromItemId: fromItemId || null,
      toNodeId,
      type,
      itemId: null,
      actionId: normalizeText(edge?.actionId) || null,
      codeId: normalizeText(edge?.codeId) || null,
    }
    const key = buildEdgeKey(nextEdge)
    if (seen.has(key)) return
    seen.add(key)
    result.push(nextEdge)
  })

  return result
}

const getNodeInputPoint = (node) => ({
  x: Number(node?.position?.x) || 0,
  y: (Number(node?.position?.y) || 0) + NODE_CARD.height / 2,
})

const getNodeOutputPoint = (node) => ({
  x: (Number(node?.position?.x) || 0) + NODE_CARD.width,
  y: (Number(node?.position?.y) || 0) + NODE_CARD.height / 2,
})

const getItemOutputPoint = (item) => ({
  x: (Number(item?.position?.x) || 0) + ITEM_CARD.width,
  y: (Number(item?.position?.y) || 0) + ITEM_CARD.height / 2,
})

const fieldClassName =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

const StoryEditorPageClient = ({ session: _session }) => {
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId') || ''
  const canvasRef = useRef(null)
  const suppressNextNodeClickRef = useRef(false)
  const suppressNextItemClickRef = useRef(false)
  const [game, setGame] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedEndingId, setSelectedEndingId] = useState('')
  const [editingNodeId, setEditingNodeId] = useState('')
  const [editingItemId, setEditingItemId] = useState('')
  const [connectSource, setConnectSource] = useState(null)
  const [dragState, setDragState] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const nodes = normalizeArray(game?.storyNodes)
  const items = normalizeArray(game?.storyItems)
  const endings = normalizeArray(game?.storyEndings)
  const edges = normalizeArray(game?.storyEdges)
  const editingNode = nodes.find((node) => node.id === editingNodeId) || null
  const selectedItem = items.find((item) => item.id === selectedItemId) || null
  const editingItem = items.find((item) => item.id === editingItemId) || null
  const selectedEnding =
    endings.find((ending) => ending.id === selectedEndingId) || null

  const agents = useMemo(
    () =>
      normalizeArray(game?.agents)
        .filter((agent) => agent?.active !== false)
        .map((agent) => ({
          userId: normalizeText(agent?.userId ?? agent?.id ?? agent),
          name:
            normalizeText(agent?.name) ||
            normalizeText(agent?.username) ||
            normalizeText(agent?.userName) ||
            normalizeText(agent?.email) ||
            normalizeText(agent?.phone) ||
            normalizeText(agent?.userId ?? agent?.id ?? agent),
        }))
        .filter((agent) => agent.userId),
    [game?.agents],
  )

  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  )
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
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
      const nextEdges = sanitizeEdges(
        loadedGame.storyEdges,
        loadedGame.storyNodes,
        loadedGame.storyItems,
      )
      const nextGame = {
        ...loadedGame,
        storyEdges: nextEdges,
        storyNodes: syncNodesFromEdges(loadedGame.storyNodes, nextEdges),
      }
      setGame(nextGame)
      setSelectedNodeId(nextGame.storyNodes?.[0]?.id || '')
      setSelectedItemId(nextGame.storyItems?.[0]?.id || '')
      setSelectedEndingId(nextGame.storyEndings?.[0]?.id || '')
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

  const removeNode = useCallback(
    (nodeId) => {
      if (!nodeId) return
      if (!window.confirm('Удалить локацию и связи с ней?')) return
      updateGame((prev) => {
        const storyNodes = normalizeArray(prev.storyNodes).filter(
          (node) => node.id !== nodeId,
        )
        const storyEdges = normalizeArray(prev.storyEdges).filter(
          (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
        )
        const syncedNodes = syncNodesFromEdges(storyNodes, storyEdges)
        setSelectedNodeId(syncedNodes[0]?.id || '')
        setEditingNodeId('')
        return { ...prev, storyNodes: syncedNodes, storyEdges }
      })
    },
    [updateGame],
  )

  const removeItem = useCallback(
    (itemId) => {
      if (!itemId) return
      if (!window.confirm('Удалить предмет и связи с ним?')) return
      updateGame((prev) => {
        const storyItems = normalizeArray(prev.storyItems).filter(
          (item) => item.id !== itemId,
        )
        const storyEdges = normalizeArray(prev.storyEdges).filter(
          (edge) => edge.fromItemId !== itemId,
        )
        const storyNodes = syncNodesFromEdges(prev.storyNodes, storyEdges)
        setSelectedItemId(storyItems[0]?.id || '')
        setEditingItemId('')
        return { ...prev, storyItems, storyNodes, storyEdges }
      })
    },
    [updateGame],
  )

  const addEdge = useCallback(
    (targetNodeId) => {
      if (!connectSource?.id || !targetNodeId) return
      if (connectSource.type === 'node' && connectSource.id === targetNodeId) {
        setConnectSource(null)
        return
      }

      updateGame((prev) => {
        const nextEdge = {
          id: createId('edge'),
          fromNodeId: connectSource.type === 'node' ? connectSource.id : null,
          fromItemId: connectSource.type === 'item' ? connectSource.id : null,
          toNodeId: targetNodeId,
          type:
            connectSource.type === 'item' ? 'required_item' : 'required_node',
          itemId: null,
          actionId: null,
          codeId: null,
        }
        const nextEdges = sanitizeEdges(
          [...normalizeArray(prev.storyEdges), nextEdge],
          prev.storyNodes,
          prev.storyItems,
        )
        return {
          ...prev,
          storyEdges: nextEdges,
          storyNodes: syncNodesFromEdges(prev.storyNodes, nextEdges),
        }
      })
      setConnectSource(null)
    },
    [connectSource, updateGame],
  )

  const removeEdge = useCallback(
    (edgeId) => {
      updateGame((prev) => {
        const storyEdges = normalizeArray(prev.storyEdges).filter(
          (edge) => edge.id !== edgeId,
        )
        return {
          ...prev,
          storyEdges,
          storyNodes: syncNodesFromEdges(prev.storyNodes, storyEdges),
        }
      })
    },
    [updateGame],
  )

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragState || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const movedDistance = Math.hypot(
        event.clientX - dragState.startClientX,
        event.clientY - dragState.startClientY,
      )
      const hasDragged =
        dragState.hasDragged ||
        movedDistance > DRAG_CLICK_SUPPRESS_DISTANCE
      if (hasDragged && !dragState.hasDragged) {
        setDragState((current) =>
          current && current.id === dragState.id
            ? { ...current, hasDragged: true }
            : current,
        )
      }
      const x = event.clientX - rect.left - dragState.offsetX
      const y = event.clientY - rect.top - dragState.offsetY
      const nextPosition = {
        x: Math.max(20, Math.round(x)),
        y: Math.max(20, Math.round(y)),
      }
      if (dragState.type === 'item') {
        updateItem(dragState.id, (item) => ({
          ...item,
          position: nextPosition,
        }))
        return
      }
      if (dragState.type === 'ending') {
        updateEnding(dragState.id, (ending) => ({
          ...ending,
          position: nextPosition,
        }))
        return
      }
      updateNode(dragState.id, (node) => ({
        ...node,
        position: nextPosition,
      }))
    },
    [dragState, updateEnding, updateItem, updateNode],
  )

  const handlePointerUp = useCallback(() => {
    if (dragState?.type === 'node' && dragState?.hasDragged) {
      suppressNextNodeClickRef.current = true
    }
    if (dragState?.type === 'item' && dragState?.hasDragged) {
      suppressNextItemClickRef.current = true
    }
    setDragState(null)
  }, [dragState])

  const saveEditor = useCallback(async () => {
    if (!gameId || !game) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const storyEdges = sanitizeEdges(
        game.storyEdges,
        game.storyNodes,
        game.storyItems,
      )
      const storyNodes = syncNodesFromEdges(game.storyNodes, storyEdges)
      const { json } = await requestApiJson('/api/cabinet/admin/story-editor', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gameId,
          storyConfig: game.storyConfig,
          storyItems: game.storyItems,
          storyNodes,
          storyEdges,
          storyEndings: game.storyEndings,
        }),
      })
      if (!json?.success) {
        throw new Error(json?.error || 'Не удалось сохранить сценарий')
      }
      const nextGame = {
        ...emptyGame,
        ...(json.data?.game || {}),
        storyConfig: {
          ...emptyGame.storyConfig,
          ...(json.data?.game?.storyConfig || {}),
        },
      }
      setGame({
        ...nextGame,
        storyEdges: sanitizeEdges(
          nextGame.storyEdges,
          nextGame.storyNodes,
          nextGame.storyItems,
        ),
      })
      setFeedback('Сценарий сохранен')
    } catch (saveError) {
      setError(saveError?.message || 'Не удалось сохранить сценарий')
    } finally {
      setSaving(false)
    }
  }, [game, gameId])

  const canvasSize = useMemo(() => {
    const nodeMaxX = Math.max(
      ...nodes.map((node) => Number(node.position?.x) || 0),
      900,
    )
    const nodeMaxY = Math.max(
      ...nodes.map((node) => Number(node.position?.y) || 0),
      520,
    )
    const itemMaxX = Math.max(
      ...items.map((item) => Number(item.position?.x) || 0),
      0,
    )
    const itemMaxY = Math.max(
      ...items.map((item) => Number(item.position?.y) || 0),
      0,
    )
    const endingMaxX = Math.max(
      ...endings.map((ending) => Number(ending.position?.x) || 0),
      0,
    )
    const endingMaxY = Math.max(
      ...endings.map((ending) => Number(ending.position?.y) || 0),
      0,
    )
    return {
      width: Math.max(nodeMaxX + 320, itemMaxX + 280, endingMaxX + 300),
      height: Math.max(nodeMaxY + 220, itemMaxY + 160, endingMaxY + 160),
    }
  }, [endings, items, nodes])

  const incomingEdgesByNode = useMemo(() => {
    const map = new Map()
    edges.forEach((edge) => {
      const list = map.get(edge.toNodeId) || []
      list.push(edge)
      map.set(edge.toNodeId, list)
    })
    return map
  }, [edges])

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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Граф сценария
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {connectSource
                  ? 'Нажмите на левую точку локации, чтобы завершить связь'
                  : 'Правая точка - выход, левая точка локации - вход'}
              </span>
            </div>
            <div
              ref={canvasRef}
              className="relative h-[660px] overflow-auto"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => setDragState(null)}
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
                    const to = nodesById.get(edge.toNodeId)
                    const fromNode = edge.fromNodeId
                      ? nodesById.get(edge.fromNodeId)
                      : null
                    const fromItem = edge.fromItemId
                      ? itemsById.get(edge.fromItemId)
                      : null
                    if (!to || (!fromNode && !fromItem)) return null
                    const start = fromItem
                      ? getItemOutputPoint(fromItem)
                      : getNodeOutputPoint(fromNode)
                    const end = getNodeInputPoint(to)
                    const midX = Math.round((start.x + end.x) / 2)
                    const stroke =
                      edge.type === 'required_item'
                        ? 'rgb(16 185 129)'
                        : 'rgb(6 182 212)'
                    return (
                      <g key={edge.id}>
                        <path
                          d={`M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`}
                          fill="none"
                          stroke={stroke}
                          strokeWidth="2.5"
                        />
                        <circle cx={end.x} cy={end.y} r="4" fill={stroke} />
                      </g>
                    )
                  })}
                </svg>

                {edges.map((edge) => {
                  const to = nodesById.get(edge.toNodeId)
                  const fromNode = edge.fromNodeId
                    ? nodesById.get(edge.fromNodeId)
                    : null
                  const fromItem = edge.fromItemId
                    ? itemsById.get(edge.fromItemId)
                    : null
                  if (!to || (!fromNode && !fromItem)) return null
                  const start = fromItem
                    ? getItemOutputPoint(fromItem)
                    : getNodeOutputPoint(fromNode)
                  const end = getNodeInputPoint(to)
                  const x = Math.round((start.x + end.x) / 2)
                  const y = Math.round((start.y + end.y) / 2)
                  return (
                    <button
                      key={`remove-${edge.id}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeEdge(edge.id)
                      }}
                      className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-rose-300 bg-white text-sm font-bold leading-none text-rose-600 shadow-sm transition hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-500/15"
                      style={{ left: x, top: y }}
                      title="Удалить связь"
                      aria-label="Удалить связь"
                    >
                      ×
                    </button>
                  )
                })}

                {nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId
                  const incomingCount = incomingEdgesByNode.get(node.id)?.length || 0
                  return (
                    <div
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if (suppressNextNodeClickRef.current) {
                          event.preventDefault()
                          suppressNextNodeClickRef.current = false
                          return
                        }
                        setSelectedNodeId(node.id)
                        setEditingNodeId(node.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedNodeId(node.id)
                          setEditingNodeId(node.id)
                        }
                      }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        const target = event.target
                        if (target?.dataset?.connector) return
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        setDragState({
                          type: 'node',
                          id: node.id,
                          offsetX: event.clientX - rect.left,
                          offsetY: event.clientY - rect.top,
                          startClientX: event.clientX,
                          startClientY: event.clientY,
                          hasDragged: false,
                        })
                        setSelectedNodeId(node.id)
                      }}
                      className={`absolute select-none rounded-2xl border p-3 text-left shadow-sm transition ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-300 dark:bg-cyan-500/15'
                          : 'border-slate-300 bg-white hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      style={{
                        left: Number(node.position?.x) || 0,
                        top: Number(node.position?.y) || 0,
                        width: NODE_CARD.width,
                        height: NODE_CARD.height,
                      }}
                    >
                      <button
                        type="button"
                        data-connector="input"
                        onClick={(event) => {
                          event.stopPropagation()
                          addEdge(node.id)
                        }}
                        className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-500 shadow hover:bg-cyan-500"
                        title="Вход локации"
                      />
                      <button
                        type="button"
                        data-connector="output"
                        onClick={(event) => {
                          event.stopPropagation()
                          setConnectSource({ type: 'node', id: node.id })
                        }}
                        className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-500 shadow hover:bg-cyan-400"
                        title="Выход локации"
                      />
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                        {node.title || node.id}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                        {node.visibility?.startVisible
                          ? 'Стартовая'
                          : `${incomingCount} входов`}
                      </span>
                      <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                        {normalizeInputMode(node.visibility?.requiredInputMode) ===
                        'count'
                          ? `Нужно ${node.visibility?.requiredInputCount || 1}`
                          : normalizeInputMode(
                              node.visibility?.requiredInputMode,
                            ) === 'any'
                            ? 'Любой вход'
                            : 'Все входы'}
                      </span>
                    </div>
                  )
                })}

                {items.map((item) => {
                  const isSelected = item.id === selectedItemId
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if (suppressNextItemClickRef.current) {
                          event.preventDefault()
                          suppressNextItemClickRef.current = false
                          return
                        }
                        setSelectedItemId(item.id)
                        setEditingItemId(item.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedItemId(item.id)
                          setEditingItemId(item.id)
                        }
                      }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        const target = event.target
                        if (target?.dataset?.connector) return
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        setDragState({
                          type: 'item',
                          id: item.id,
                          offsetX: event.clientX - rect.left,
                          offsetY: event.clientY - rect.top,
                          startClientX: event.clientX,
                          startClientY: event.clientY,
                          hasDragged: false,
                        })
                        setSelectedItemId(item.id)
                      }}
                      className={`absolute select-none rounded-2xl border p-3 text-left shadow-sm transition ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 dark:bg-emerald-500/15'
                          : 'border-emerald-200 bg-white hover:border-emerald-300 dark:border-emerald-700 dark:bg-slate-800'
                      }`}
                      style={{
                        left: Number(item.position?.x) || 0,
                        top: Number(item.position?.y) || 0,
                        width: ITEM_CARD.width,
                        height: ITEM_CARD.height,
                      }}
                    >
                      <button
                        type="button"
                        data-connector="output"
                        onClick={(event) => {
                          event.stopPropagation()
                          setConnectSource({ type: 'item', id: item.id })
                        }}
                        className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow hover:bg-emerald-400"
                        title="Выход предмета"
                      />
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                        {item.title || item.id}
                      </span>
                      <span className="mt-1 block text-xs text-emerald-700 dark:text-emerald-200">
                        Предмет
                      </span>
                    </div>
                  )
                })}

                {endings.map((ending) => {
                  const isSelected = ending.id === selectedEndingId
                  return (
                    <div
                      key={ending.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEndingId(ending.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedEndingId(ending.id)
                        }
                      }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        setDragState({
                          type: 'ending',
                          id: ending.id,
                          offsetX: event.clientX - rect.left,
                          offsetY: event.clientY - rect.top,
                          startClientX: event.clientX,
                          startClientY: event.clientY,
                          hasDragged: false,
                        })
                        setSelectedEndingId(ending.id)
                      }}
                      className={`absolute select-none rounded-2xl border p-3 text-left shadow-sm transition ${
                        isSelected
                          ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-300 dark:bg-violet-500/15'
                          : 'border-violet-200 bg-white hover:border-violet-300 dark:border-violet-700 dark:bg-slate-800'
                      }`}
                      style={{
                        left: Number(ending.position?.x) || 0,
                        top: Number(ending.position?.y) || 0,
                        width: ENDING_CARD.width,
                        height: ENDING_CARD.height,
                      }}
                    >
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                        {ending.title || ending.id}
                      </span>
                      <span className="mt-1 block text-xs text-violet-700 dark:text-violet-200">
                        Концовка
                      </span>
                      <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                        {ending.type || 'success'}
                      </span>
                    </div>
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
                    className={fieldClassName}
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
                  Связи
                </h2>
                {connectSource ? (
                  <button
                    type="button"
                    onClick={() => setConnectSource(null)}
                    className="text-sm font-semibold text-rose-600"
                  >
                    Отмена
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2">
                {edges.length > 0 ? (
                  edges.map((edge) => {
                    const sourceLabel = edge.fromItemId
                      ? itemsById.get(edge.fromItemId)?.title || edge.fromItemId
                      : nodesById.get(edge.fromNodeId)?.title || edge.fromNodeId
                    const targetLabel =
                      nodesById.get(edge.toNodeId)?.title || edge.toNodeId
                    return (
                      <div
                        key={edge.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                          {sourceLabel} {'->'} {targetLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEdge(edge.id)}
                          className="shrink-0 text-xs font-semibold text-rose-600"
                        >
                          Удалить
                        </button>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Связей пока нет. Нажмите правую точку локации или предмета,
                    затем левую точку целевой локации.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  Предмет
                </h2>
                {selectedItem ? (
                  <button
                    type="button"
                    onClick={() => removeItem(selectedItem.id)}
                    className="text-sm font-semibold text-rose-600"
                  >
                    Удалить
                  </button>
                ) : null}
              </div>
              {selectedItem ? (
                <div className="mt-3 grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedItem.title || selectedItem.id}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {selectedItem.consumableOnUse
                        ? 'Расходуется после применения'
                        : 'Остается в инвентаре'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingItemId(selectedItem.id)}
                    className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  >
                    Редактировать предмет
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Выберите предмет на схеме.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Концовки
              </h2>
              <select
                value={selectedEndingId}
                onChange={(event) => setSelectedEndingId(event.target.value)}
                className={`mt-3 w-full ${fieldClassName}`}
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
                    className={fieldClassName}
                  />
                  <select
                    value={selectedEnding.type || 'success'}
                    onChange={(event) =>
                      updateEnding(selectedEnding.id, (ending) => ({
                        ...ending,
                        type: event.target.value,
                      }))
                    }
                    className={fieldClassName}
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
                    className={fieldClassName}
                  />
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>

      {editingNode ? (
        <Modal
          isOpen={Boolean(editingNode)}
          title="Редактирование локации"
          onClose={() => setEditingNodeId('')}
          dialogClassName="md:max-w-5xl"
          bodyClassName="space-y-5"
          footer={
            <>
              <button
                type="button"
                onClick={() => removeNode(editingNode.id)}
                className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
              >
                Удалить локацию
              </button>
              <button
                type="button"
                onClick={() => setEditingNodeId('')}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Готово
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Входы локации задаются линиями на схеме. Здесь выбирается правило,
            сколько входов должно быть включено.
          </p>

          <div className="grid gap-5">
              <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Основное
                </h3>
                <input
                  value={editingNode.title || ''}
                  onChange={(event) =>
                    updateNode(editingNode.id, (node) => ({
                      ...node,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Название"
                  className={fieldClassName}
                />
                <TaskRichEditor
                  value={editingNode.descriptionRich || ''}
                  directory={`games/${gameId || 'draft'}/story/nodes/${editingNode.id}/description/editor`}
                  contentMaxHeight="none"
                  placeholder="Описание локации. Можно использовать форматирование, картинки и аудио."
                  onChange={({ html, media }) =>
                    updateNode(editingNode.id, (node) => ({
                      ...node,
                      descriptionRich: typeof html === 'string' ? html : '',
                      media: Array.isArray(media) ? media : [],
                    }))
                  }
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(editingNode.visibility?.startVisible)}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
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
                      value={editingNode.scoring?.scoreForComplete || 0}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          scoring: {
                            ...node.scoring,
                            scoreForComplete: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                    Открывается когда
                    <select
                      value={normalizeInputMode(
                        editingNode.visibility?.requiredInputMode,
                      )}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          visibility: {
                            ...node.visibility,
                            requiredInputMode: event.target.value,
                          },
                        }))
                      }
                      className={fieldClassName}
                    >
                      <option value="all">Все входы включены</option>
                      <option value="any">Любой вход включен</option>
                      <option value="count">Заданное количество</option>
                    </select>
                  </label>
                </div>
                {normalizeInputMode(editingNode.visibility?.requiredInputMode) ===
                'count' ? (
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300 md:max-w-xs">
                    Количество включенных входов
                    <input
                      type="number"
                      min="1"
                      value={editingNode.visibility?.requiredInputCount || 1}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          visibility: {
                            ...node.visibility,
                            requiredInputCount: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          },
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                ) : null}
              </section>

              <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Коды
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      updateNode(editingNode.id, (node) => ({
                        ...node,
                        codes: [...normalizeArray(node.codes), buildCode()],
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    + Код
                  </button>
                </div>
                {normalizeArray(editingNode.codes).map((code) => (
                  <div
                    key={code.id}
                    className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <input
                      value={code.code || ''}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          codes: normalizeArray(node.codes).map((item) =>
                            item.id === code.id
                              ? { ...item, code: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      placeholder="Код"
                      className={fieldClassName}
                    />
                    <div className="grid gap-2 md:grid-cols-3">
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={code.completesNode !== false}
                          onChange={(event) =>
                            updateNode(editingNode.id, (node) => ({
                              ...node,
                              codes: normalizeArray(node.codes).map((item) =>
                                item.id === code.id
                                  ? {
                                      ...item,
                                      completesNode: event.target.checked,
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                        Завершает локацию
                      </label>
                      <input
                        value={joinCsv(code.grantsItemIds)}
                        onChange={(event) =>
                          updateNode(editingNode.id, (node) => ({
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
                        placeholder="Выдает предметы"
                        className={fieldClassName}
                      />
                      <input
                        value={joinCsv(code.consumesItemIds)}
                        onChange={(event) =>
                          updateNode(editingNode.id, (node) => ({
                            ...node,
                            codes: normalizeArray(node.codes).map((item) =>
                              item.id === code.id
                                ? {
                                    ...item,
                                    consumesItemIds: parseCsv(
                                      event.target.value,
                                    ),
                                  }
                                : item,
                            ),
                          }))
                        }
                        placeholder="Тратит предметы"
                        className={fieldClassName}
                      />
                    </div>
                  </div>
                ))}
              </section>

              <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Действия
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      updateNode(editingNode.id, (node) => ({
                        ...node,
                        actions: [...normalizeArray(node.actions), buildAction()],
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    + Действие
                  </button>
                </div>
                {normalizeArray(editingNode.actions).map((action) => (
                  <div
                    key={action.id}
                    className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <input
                      value={action.label || ''}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          actions: normalizeArray(node.actions).map((item) =>
                            item.id === action.id
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      placeholder="Название кнопки"
                      className={fieldClassName}
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(action.completesNode)}
                        onChange={(event) =>
                          updateNode(editingNode.id, (node) => ({
                            ...node,
                            actions: normalizeArray(node.actions).map((item) =>
                              item.id === action.id
                                ? {
                                    ...item,
                                    completesNode: event.target.checked,
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                      Завершает локацию
                    </label>
                  </div>
                ))}
              </section>

              <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Подсказки
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      updateNode(editingNode.id, (node) => ({
                        ...node,
                        clues: [...normalizeArray(node.clues), buildClue()],
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    + Подсказка
                  </button>
                </div>
                {normalizeArray(editingNode.clues).map((clue) => (
                  <div
                    key={clue.id}
                    className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <input
                      value={clue.title || ''}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          clues: normalizeArray(node.clues).map((item) =>
                            item.id === clue.id
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      placeholder="Название подсказки"
                      className={fieldClassName}
                    />
                    <textarea
                      value={clue.contentRich || ''}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          clues: normalizeArray(node.clues).map((item) =>
                            item.id === clue.id
                              ? { ...item, contentRich: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      rows={3}
                      placeholder="Текст подсказки"
                      className={fieldClassName}
                    />
                  </div>
                ))}
              </section>

              <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Агенты
                </h3>
                {agents.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {agents.map((agent) => {
                      const checked = normalizeArray(
                        editingNode.agentUserIds,
                      ).includes(agent.userId)
                      return (
                        <label
                          key={agent.userId}
                          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              updateNode(editingNode.id, (node) => {
                                const current = new Set(
                                  normalizeArray(node.agentUserIds),
                                )
                                if (event.target.checked) {
                                  current.add(agent.userId)
                                } else {
                                  current.delete(agent.userId)
                                }
                                return {
                                  ...node,
                                  agentUserIds: Array.from(current),
                                }
                              })
                            }
                          />
                          {agent.name}
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Сначала добавьте агентов в настройках игры.
                  </p>
                )}
              </section>
            </div>
        </Modal>
      ) : null}

      {editingItem ? (
        <Modal
          isOpen={Boolean(editingItem)}
          title="Редактирование предмета"
          onClose={() => setEditingItemId('')}
          dialogClassName="md:max-w-3xl"
          bodyClassName="space-y-4"
          footer={
            <>
              <button
                type="button"
                onClick={() => removeItem(editingItem.id)}
                className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
              >
                Удалить предмет
              </button>
              <button
                type="button"
                onClick={() => setEditingItemId('')}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Готово
              </button>
            </>
          }
        >
          <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Основное
            </h3>
            <input
              value={editingItem.title || ''}
              onChange={(event) =>
                updateItem(editingItem.id, (item) => ({
                  ...item,
                  title: event.target.value,
                }))
              }
              placeholder="Название предмета"
              className={fieldClassName}
            />
            <ImagesInput
              label="Изображение предмета"
              images={editingItem.image ? [editingItem.image] : []}
              onChange={(nextImages) =>
                updateItem(editingItem.id, (item) => ({
                  ...item,
                  image: nextImages?.[0] ?? '',
                }))
              }
              directory={`games/${gameId || 'draft'}/story/items/${editingItem.id}`}
              imageName="item"
              maxImages={1}
              previewShape="square"
            />
            <TaskRichEditor
              value={editingItem.descriptionRich || ''}
              directory={`games/${gameId || 'draft'}/story/items/${editingItem.id}/description/editor`}
              contentMaxHeight="none"
              placeholder="Описание предмета. Можно использовать форматирование, картинки и аудио."
              onChange={({ html, media }) =>
                updateItem(editingItem.id, (item) => ({
                  ...item,
                  descriptionRich: typeof html === 'string' ? html : '',
                  media: Array.isArray(media) ? media : [],
                }))
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(editingItem.consumableOnUse)}
                  onChange={(event) =>
                    updateItem(editingItem.id, (item) => ({
                      ...item,
                      consumableOnUse: event.target.checked,
                    }))
                  }
                />
                Исчезает после применения
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={editingItem.hiddenUntilObtained !== false}
                  onChange={(event) =>
                    updateItem(editingItem.id, (item) => ({
                      ...item,
                      hiddenUntilObtained: event.target.checked,
                    }))
                  }
                />
                Скрыт до получения
              </label>
            </div>
          </section>
        </Modal>
      ) : null}
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
