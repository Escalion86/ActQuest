'use client'

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import {
  buildStoryInvestigationGraph,
  getStoryGraphNeighborhood,
} from '@helpers/buildStoryInvestigationGraph'

const elk = new ELK()

const MODE_OPTIONS = [
  { id: 'logic', label: 'Логика' },
  { id: 'locations', label: 'Локации' },
  { id: 'finals', label: 'Финалы' },
]

const NODE_SIZES = {
  interaction: { width: 364, height: 164 },
  location: { width: 250, height: 118 },
  accusation: { width: 280, height: 124 },
  outcome: { width: 300, height: 138 },
  ending: { width: 260, height: 118 },
}

const LOGIC_COLUMN_GAP = 92
const LOGIC_COLUMN_STEP = NODE_SIZES.interaction.width + LOGIC_COLUMN_GAP
const LOGIC_ROW_GAP = 20
const LOGIC_ROW_STEP = NODE_SIZES.interaction.height + LOGIC_ROW_GAP

const getNodeSize = (node) => NODE_SIZES[node?.type] || NODE_SIZES.interaction

const GRAPH_CONTROLS_CLASS_NAME = '!overflow-hidden !rounded-xl !border !border-slate-700 !bg-slate-950/90 !shadow-xl [&>button]:!h-9 [&>button]:!w-9 [&>button]:!border-0 [&>button]:!border-b [&>button]:!border-slate-800 [&>button]:!bg-slate-950 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-800 [&>button:hover]:!text-cyan-200 [&>button>svg]:!fill-current [&>button:last-child]:!border-b-0'

const EDGE_TONES = {
  interaction: { color: '#f59e0b', dash: '7 6' },
  item: { color: '#10b981' },
  evidence: { color: '#06b6d4' },
  topic: { color: '#8b5cf6' },
  character: { color: '#ec4899' },
  flag: { color: '#f59e0b', dash: '3 5' },
  location: { color: '#06b6d4' },
  unlock: { color: '#8b5cf6' },
  outcome: { color: '#f59e0b' },
  ending: { color: '#f43f5e' },
}

const CHIP_TONES = {
  condition: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  item: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  evidence: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100',
  unlock: 'border-violet-400/40 bg-violet-400/10 text-violet-100',
  ending: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const LayoutIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
    <rect x="3" y="4" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="14" y="14" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 7h4a3 3 0 0 1 3 3v4M14.5 11.5 17 14l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const InteractionNode = memo(({ data }) => {
  const required = data.required.slice(0, 2)
  const results = data.results.slice(0, 2)

  return (
    <article
      className={`h-full rounded-xl border bg-slate-950/95 p-3 shadow-lg transition ${
        data.active
          ? 'border-cyan-400 ring-2 ring-cyan-400/20'
          : data.matched
            ? 'border-violet-400 ring-2 ring-violet-400/20'
            : 'border-slate-700'
      } ${data.dimmed ? 'opacity-35' : 'opacity-100'}`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-slate-950 !bg-amber-400" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-slate-950 !bg-cyan-400" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5 text-slate-50" title={data.title}>{data.title}</p>
          {data.subtitle ? <p className="mt-1 truncate text-[11px] text-slate-400" title={data.subtitle}>{data.subtitle}</p> : null}
        </div>
        <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300">
          {data.kindLabel} · {data.timeCostMinutes} мин
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2">
        <ReferenceColumn
          title="Требует"
          empty="Без условий"
          entries={required}
          overflow={data.required.length - required.length}
          onSelect={data.onReferenceSelect}
        />
        <ReferenceColumn
          title="Результат"
          empty="Только ответ"
          entries={results}
          overflow={data.results.length - results.length}
          onSelect={data.onReferenceSelect}
        />
      </div>
    </article>
  )
})

InteractionNode.displayName = 'InteractionNode'
InteractionNode.propTypes = { data: PropTypes.object.isRequired }

const ReferenceColumn = ({ title, empty, entries, overflow, onSelect }) => (
  <div className="min-w-0">
    <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
    <div className="space-y-1">
      {entries.length > 0 ? entries.map((entry) => (
        <button
          key={entry.refKey}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(entry.refKey)
          }}
          className={`block w-full truncate rounded-md border px-1.5 py-1 text-left text-[10px] leading-3 transition hover:brightness-125 ${CHIP_TONES[entry.tone] || CHIP_TONES.unlock}`}
          title={entry.label}
        >
          {entry.label}
        </button>
      )) : <p className="text-[10px] leading-4 text-slate-600">{empty}</p>}
      {overflow > 0 ? <p className="text-[9px] text-slate-500">ещё {overflow}</p> : null}
    </div>
  </div>
)

ReferenceColumn.propTypes = {
  title: PropTypes.string.isRequired,
  empty: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(PropTypes.object).isRequired,
  overflow: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
}

const LocationGroupNode = memo(({ data }) => (
  <section className={`h-full rounded-2xl border bg-slate-950/45 ${data.active ? 'border-cyan-400/80' : 'border-slate-700/80'}`}>
    <div className="flex h-11 items-center justify-between gap-3 border-b border-slate-700/80 px-4">
      <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-slate-200" title={data.title}>{data.title}</p>
      <span className="text-[10px] text-slate-500">
        {data.startVisible ? 'стартовая · ' : ''}{data.interactionCount} действий
      </span>
    </div>
  </section>
))

LocationGroupNode.displayName = 'LocationGroupNode'
LocationGroupNode.propTypes = { data: PropTypes.object.isRequired }

const EntityNode = memo(({ data }) => {
  const tone = data.entityType === 'ending'
    ? 'border-rose-400/60'
    : data.entityType === 'outcome'
      ? 'border-amber-400/60'
      : data.entityType === 'accusation'
        ? 'border-violet-400/60'
        : 'border-cyan-400/50'
  return (
    <article className={`h-full rounded-xl border bg-slate-950/95 p-4 shadow-lg transition ${data.active ? `${tone} ring-2 ring-cyan-400/20` : 'border-slate-700'} ${data.dimmed ? 'opacity-35' : ''}`}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-slate-950 !bg-amber-400" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-slate-950 !bg-cyan-400" />
      <p className="truncate text-sm font-semibold text-slate-50" title={data.title}>{data.title}</p>
      {data.subtitle ? <p className="mt-2 truncate text-[11px] leading-4 text-slate-400" title={data.subtitle}>{data.subtitle}</p> : null}
      {Number.isFinite(data.interactionCount) ? (
        <p className="mt-3 text-[10px] uppercase tracking-wide text-cyan-300">{data.interactionCount} действий</p>
      ) : null}
    </article>
  )
})

EntityNode.displayName = 'EntityNode'
EntityNode.propTypes = { data: PropTypes.object.isRequired }

const nodeTypes = {
  interaction: InteractionNode,
  locationGroup: LocationGroupNode,
  entity: EntityNode,
}

const layoutGraph = async (graph) => {
  const isLogic = graph.mode === 'logic'
  const entityNodes = graph.nodes.filter((node) => node.type !== 'location-group')
  const groupNodes = graph.nodes.filter((node) => node.type === 'location-group')
  const layoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.spacing.nodeNode': '34',
    'elk.layered.spacing.nodeNodeBetweenLayers': '92',
    'elk.layered.spacing.edgeNodeBetweenLayers': '34',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  }

  const elkGraph = {
    id: 'root',
    layoutOptions,
    children: entityNodes.map((node) => ({ id: node.id, ...getNodeSize(node) })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  }

  try {
    const result = await elk.layout(elkGraph)
    const positions = new Map()
    const groups = new Map()
    if (isLogic) {
      const elkPositions = new Map(
        normalizeArray(result.children).map((node) => [node.id, {
          x: Number(node.x) || 0,
          y: Number(node.y) || 0,
        }]),
      )
      const columns = new Map(
        entityNodes.map((node) => [
          node.id,
          Math.max(0, Math.round((elkPositions.get(node.id)?.x || 0) / LOGIC_COLUMN_STEP)),
        ]),
      )
      const maxColumn = Math.max(0, ...columns.values())
      const groupWidth = Math.max(
        NODE_SIZES.interaction.width + 48,
        maxColumn * LOGIC_COLUMN_STEP + NODE_SIZES.interaction.width + 48,
      )
      let groupY = 24

      groupNodes.forEach((group) => {
        const children = entityNodes.filter((node) => node.locationId === group.id)
        const rowsByColumn = new Map()
        children
          .toSorted((left, right) =>
            (elkPositions.get(left.id)?.y || 0) - (elkPositions.get(right.id)?.y || 0),
          )
          .forEach((node) => {
            const column = columns.get(node.id) || 0
            const row = rowsByColumn.get(column) || 0
            rowsByColumn.set(column, row + 1)
            positions.set(node.id, {
              x: 24 + column * LOGIC_COLUMN_STEP,
              y: 62 + row * LOGIC_ROW_STEP,
            })
          })
        const rowCount = Math.max(1, ...rowsByColumn.values())
        const groupHeight = 82 + rowCount * LOGIC_ROW_STEP
        groups.set(group.id, {
          x: 24,
          y: groupY,
          width: groupWidth,
          height: groupHeight,
        })
        groupY += groupHeight + 34
      })
    } else {
      result.children?.forEach((node) => positions.set(node.id, {
        x: node.x || 0,
        y: node.y || 0,
      }))
    }
    return { positions, groups }
  } catch {
    const positions = new Map()
    const groups = new Map()
    if (isLogic) {
      const maxChildren = Math.max(
        1,
        ...groupNodes.map((group) =>
          entityNodes.filter((node) => node.locationId === group.id).length,
        ),
      )
      const groupWidth = 48
        + (maxChildren - 1) * LOGIC_COLUMN_STEP
        + NODE_SIZES.interaction.width
      let groupY = 24
      groupNodes.forEach((group) => {
        const children = entityNodes.filter((node) => node.locationId === group.id)
        const groupHeight = 266
        groups.set(group.id, {
          x: 30,
          y: groupY,
          width: groupWidth,
          height: groupHeight,
        })
        children.forEach((node, index) => positions.set(node.id, {
          x: 24 + index * LOGIC_COLUMN_STEP,
          y: 58,
        }))
        groupY += groupHeight + 34
      })
    } else {
      entityNodes.forEach((node, index) => positions.set(node.id, {
        x: (index % 4) * 360,
        y: Math.floor(index / 4) * 190,
      }))
    }
    return { positions, groups }
  }
}

const StoryLogicGraphInner = ({
  game,
  selectedInteractionId,
  onSelectInteraction,
  onEditInteraction,
  onOpenLocations,
  onOpenEndings,
  onOpenAccusation,
}) => {
  const [mode, setMode] = useState('logic')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(selectedInteractionId || '')
  const [selectedReferenceKey, setSelectedReferenceKey] = useState('')
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [layout, setLayout] = useState({ positions: new Map(), groups: new Map() })
  const [isLayoutPending, setIsLayoutPending] = useState(true)
  const deferredQuery = useDeferredValue(query)
  const { fitView, setCenter } = useReactFlow()

  const graph = useMemo(
    () => buildStoryInvestigationGraph(game, { mode, query: deferredQuery }),
    [deferredQuery, game, mode],
  )

  useEffect(() => {
    let active = true
    setIsLayoutPending(true)
    layoutGraph(graph).then((nextLayout) => {
      if (!active) return
      setLayout(nextLayout)
      setIsLayoutPending(false)
      requestAnimationFrame(() => fitView({ padding: 0.12, duration: 350, maxZoom: 1 }))
    })
    return () => { active = false }
  }, [fitView, graph, layoutVersion])

  useEffect(() => {
    if (mode === 'logic' && selectedInteractionId) setSelectedId(selectedInteractionId)
  }, [mode, selectedInteractionId])

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) {
      setSelectedId('')
      setSelectedReferenceKey('')
    }
  }, [graph.nodes, selectedId])

  const selectedNode = graph.nodes.find((node) => node.id === selectedId)
  const showInspector = Boolean(selectedNode)
  const neighborhood = useMemo(
    () => getStoryGraphNeighborhood(graph, selectedId),
    [graph, selectedId],
  )
  const referenceNodeIds = useMemo(() => {
    if (!selectedReferenceKey) return new Set()
    return new Set([
      ...normalizeArray(graph.index?.producers?.get(selectedReferenceKey)),
      ...normalizeArray(graph.index?.consumers?.get(selectedReferenceKey)),
    ])
  }, [graph.index, selectedReferenceKey])
  const selectedReferenceLabel = useMemo(() => {
    if (!selectedReferenceKey) return ''
    for (const graphNode of graph.nodes) {
      const reference = [
        ...normalizeArray(graphNode.required),
        ...normalizeArray(graphNode.results),
      ].find((entry) => entry.refKey === selectedReferenceKey)
      if (reference) return reference.shortLabel
    }
    return 'Выбранная сущность'
  }, [graph.nodes, selectedReferenceKey])
  const hasFocus = Boolean(selectedId || selectedReferenceKey)

  const handleReferenceSelect = useCallback((refKey) => {
    setSelectedReferenceKey((current) => current === refKey ? '' : refKey)
  }, [])

  const flowNodes = useMemo(() => {
    const result = []
    graph.nodes.filter((node) => node.type === 'location-group').forEach((node) => {
      const groupLayout = layout.groups.get(node.id) || { x: 0, y: 0, width: 360, height: 240 }
      result.push({
        id: `group:${node.id}`,
        type: 'locationGroup',
        position: { x: groupLayout.x, y: groupLayout.y },
        style: { width: groupLayout.width, height: groupLayout.height, zIndex: -1 },
        selectable: false,
        draggable: false,
        data: {
          ...node,
          active: graph.nodes.some((entry) => entry.id === selectedId && entry.locationId === node.id),
        },
      })
    })
    graph.nodes.filter((node) => node.type !== 'location-group').forEach((node) => {
      const position = layout.positions.get(node.id) || { x: 0, y: 0 }
      const size = getNodeSize(node)
      const related = selectedReferenceKey
        ? referenceNodeIds.has(node.id)
        : neighborhood.nodeIds.has(node.id)
      const matched = graph.matchedIds?.has(node.id)
      result.push({
        id: node.id,
        type: node.type === 'interaction' ? 'interaction' : 'entity',
        parentId: mode === 'logic' ? `group:${node.locationId}` : undefined,
        extent: mode === 'logic' ? 'parent' : undefined,
        position,
        style: { width: size.width, height: size.height },
        draggable: false,
        data: {
          ...node,
          entityType: node.type,
          active: node.id === selectedId || related,
          matched,
          dimmed: hasFocus && !related && node.id !== selectedId && !matched,
          onReferenceSelect: handleReferenceSelect,
        },
      })
    })
    return result
  }, [graph.matchedIds, graph.nodes, handleReferenceSelect, hasFocus, layout.groups, layout.positions, mode, neighborhood.nodeIds, referenceNodeIds, selectedId, selectedReferenceKey])

  const flowEdges = useMemo(() => graph.edges.flatMap((edge) => {
    const connectedToSelection = edge.source === selectedId || edge.target === selectedId
    const relatedByReference = selectedReferenceKey && edge.refKey === selectedReferenceKey
    const visible = edge.persistent || connectedToSelection || relatedByReference
    if (!visible) return []
    const tone = EDGE_TONES[edge.relation] || EDGE_TONES.location
    const active = connectedToSelection || relatedByReference
    return [{
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: active,
      label: active ? edge.label : undefined,
      labelStyle: { fill: tone.color, fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: '#020617', fillOpacity: 0.92 },
      labelBgPadding: [5, 3],
      labelBgBorderRadius: 5,
      markerEnd: { type: MarkerType.ArrowClosed, color: tone.color, width: 16, height: 16 },
      style: {
        stroke: tone.color,
        strokeWidth: active ? 2.7 : 1.6,
        strokeDasharray: tone.dash,
        opacity: hasFocus && !active ? 0.22 : 0.82,
      },
    }]
  }), [graph.edges, hasFocus, selectedId, selectedReferenceKey])

  const selectNode = useCallback((id) => {
    setSelectedId(id)
    setSelectedReferenceKey('')
    const node = graph.nodes.find((entry) => entry.id === id)
    if (node?.type === 'interaction') onSelectInteraction(id)
    const position = layout.positions.get(id)
    const group = mode === 'logic' && node ? layout.groups.get(node.locationId) : null
    if (position && node) {
      const size = getNodeSize(node)
      setCenter(
        position.x + (group?.x || 0) + size.width / 2,
        position.y + (group?.y || 0) + size.height / 2,
        { zoom: 1, duration: 350 },
      )
    }
  }, [graph.nodes, layout.groups, layout.positions, mode, onSelectInteraction, setCenter])

  const outlineGroups = useMemo(() => {
    if (mode !== 'logic') return [{ id: mode, title: mode === 'locations' ? 'Локации' : 'Финалы', nodes: graph.nodes }]
    return graph.nodes.filter((node) => node.type === 'location-group').map((group) => ({
      id: group.id,
      title: group.title,
      nodes: graph.nodes.filter((node) => node.locationId === group.id),
    }))
  }, [graph.nodes, mode])

  const mobileNodes = useMemo(() => {
    const entityNodes = graph.nodes.filter((node) => node.type !== 'location-group')
    if (selectedReferenceKey) return entityNodes.filter((node) => referenceNodeIds.has(node.id))
    if (selectedId) return entityNodes.filter((node) => neighborhood.nodeIds.has(node.id))
    return entityNodes.slice(0, 8)
  }, [graph.nodes, neighborhood.nodeIds, referenceNodeIds, selectedId, selectedReferenceKey])

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-[#050915] text-slate-100 shadow-2xl shadow-slate-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#080d1b] px-3 py-3">
        <div className="flex rounded-xl border border-slate-700 bg-slate-950/70 p-1" aria-label="Режим карты">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setMode(option.id)
                setSelectedReferenceKey('')
                setSelectedId('')
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === option.id ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {mode === 'logic' ? (
            <label className="flex min-w-[190px] max-w-sm flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-400">
              <SearchIcon />
              <span className="sr-only">Поиск по логике сценария</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Действие, предмет, улика…"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-600"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => setLayoutVersion((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/60 hover:text-white"
          >
            <LayoutIcon />
            <span className="hidden sm:inline">Разместить</span>
          </button>
        </div>
      </div>

      <div className={`hidden min-h-[680px] xl:grid ${showInspector ? 'xl:grid-cols-[230px_minmax(0,1fr)_300px]' : 'xl:grid-cols-[230px_minmax(0,1fr)]'}`}>
        <GraphOutline groups={outlineGroups} selectedId={selectedId} onSelect={selectNode} />
        <div className="relative min-w-0 border-x border-slate-800">
          {isLayoutPending ? (
            <div className="absolute inset-x-0 top-3 z-20 mx-auto w-fit rounded-full border border-cyan-400/30 bg-slate-950/90 px-3 py-1.5 text-[10px] font-semibold text-cyan-200">
              Выстраиваем причинные связи…
            </div>
          ) : null}
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              if (!node.id.startsWith('group:')) selectNode(node.id)
            }}
            onPaneClick={() => {
              setSelectedId('')
              setSelectedReferenceKey('')
            }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.18}
            maxZoom={1.4}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#26324a" gap={24} size={1} />
            <Controls
              showInteractive={false}
              position="bottom-left"
              className={GRAPH_CONTROLS_CLASS_NAME}
            />
          </ReactFlow>
          <GraphLegend />
        </div>
        {showInspector ? (
          <GraphInspector
            mode={mode}
            node={selectedNode}
            selectedReferenceKey={selectedReferenceKey}
            selectedReferenceLabel={selectedReferenceLabel}
            referenceNodeCount={referenceNodeIds.size}
            diagnostics={graph.diagnostics}
            onEditInteraction={onEditInteraction}
            onOpenLocations={onOpenLocations}
            onOpenEndings={onOpenEndings}
            onOpenAccusation={onOpenAccusation}
            onReferenceSelect={handleReferenceSelect}
          />
        ) : null}
      </div>

      <div className="xl:hidden">
        <div className="border-b border-slate-800 px-3 py-3 text-xs text-slate-400">
          На узком экране показана выбранная причинная цепочка. Для полного полотна разверните устройство горизонтально или откройте редактор на широком экране.
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-2">
            {mobileNodes.length > 0 ? mobileNodes.map((node, index) => (
              <button
                key={node.id}
                type="button"
                onClick={() => selectNode(node.id)}
                className={`relative w-full rounded-xl border p-3 text-left ${node.id === selectedId ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700 bg-slate-950/70'}`}
              >
                {index > 0 ? <span className="absolute -top-3 left-6 h-3 border-l border-cyan-400/50" /> : null}
                <p className="text-sm font-semibold text-slate-100">{node.title}</p>
                <p className="mt-1 text-xs text-slate-400">{node.locationTitle || node.subtitle || node.type}</p>
              </button>
            )) : <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Ничего не найдено.</p>}
          </div>
          <GraphInspector
            mode={mode}
            node={selectedNode}
            selectedReferenceKey={selectedReferenceKey}
            selectedReferenceLabel={selectedReferenceLabel}
            referenceNodeCount={referenceNodeIds.size}
            diagnostics={graph.diagnostics}
            onEditInteraction={onEditInteraction}
            onOpenLocations={onOpenLocations}
            onOpenEndings={onOpenEndings}
            onOpenAccusation={onOpenAccusation}
            onReferenceSelect={handleReferenceSelect}
            compact
          />
        </div>
      </div>
    </div>
  )
}

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

StoryLogicGraphInner.propTypes = {
  game: PropTypes.object.isRequired,
  selectedInteractionId: PropTypes.string,
  onSelectInteraction: PropTypes.func.isRequired,
  onEditInteraction: PropTypes.func.isRequired,
  onOpenLocations: PropTypes.func.isRequired,
  onOpenEndings: PropTypes.func.isRequired,
  onOpenAccusation: PropTypes.func.isRequired,
}

StoryLogicGraphInner.defaultProps = { selectedInteractionId: '' }

const GraphOutline = ({ groups, selectedId, onSelect }) => (
  <aside className="max-h-[680px] overflow-y-auto bg-[#080d1b] p-3">
    <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Структура сценария</p>
    <div className="mt-3 space-y-4">
      {groups.map((group) => (
        <section key={group.id}>
          <p className="truncate px-2 text-xs font-semibold text-slate-300">{group.title}</p>
          <div className="mt-1 space-y-0.5">
            {group.nodes.filter((node) => node.type !== 'location-group').map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id)}
                title={node.title}
                className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-[11px] transition ${node.id === selectedId ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                {node.title}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  </aside>
)

GraphOutline.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
}
GraphOutline.defaultProps = { selectedId: '' }

const GraphInspector = ({
  mode,
  node,
  selectedReferenceKey,
  selectedReferenceLabel,
  referenceNodeCount,
  diagnostics,
  onEditInteraction,
  onOpenLocations,
  onOpenEndings,
  onOpenAccusation,
  onReferenceSelect,
  compact,
}) => (
  <aside className={`${compact ? 'rounded-xl border border-slate-800' : 'max-h-[680px] overflow-y-auto'} bg-[#080d1b] p-4`}>
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Инспектор</p>
    {node ? (
      <div className="mt-3">
        <p className="text-base font-semibold leading-6 text-slate-50">{node.title}</p>
        {node.locationTitle ? <p className="mt-1 text-xs text-cyan-300">{node.locationTitle}</p> : null}
        {node.subtitle ? <p className="mt-2 text-xs leading-5 text-slate-400">{node.subtitle}</p> : null}
        {node.type === 'interaction' ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <p className="text-slate-500">Тип</p><p className="mt-1 text-slate-200">{node.kindLabel}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <p className="text-slate-500">Стоимость</p><p className="mt-1 text-slate-200">{node.timeCostMinutes} мин.</p>
              </div>
            </div>
            <InspectorReferences title="Условия" entries={node.required} onSelect={onReferenceSelect} />
            <InspectorReferences title="Результаты" entries={node.results} onSelect={onReferenceSelect} />
            <button type="button" onClick={() => onEditInteraction(node.id)} className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300">
              Редактировать взаимодействие
            </button>
          </>
        ) : null}
        {mode === 'locations' ? (
          <button type="button" onClick={onOpenLocations} className="mt-4 w-full rounded-xl border border-cyan-400/40 px-4 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10">Открыть редактор локаций</button>
        ) : null}
        {mode === 'finals' && ['accusation', 'outcome'].includes(node.type) ? (
          <button type="button" onClick={() => onOpenAccusation(node.type === 'outcome' ? node.id : '')} className="mt-4 w-full rounded-xl border border-violet-400/40 px-4 py-2.5 text-xs font-bold text-violet-200 hover:bg-violet-400/10">Редактировать финальное обвинение и исходы</button>
        ) : null}
        {mode === 'finals' && node.type === 'ending' ? (
          <button type="button" onClick={onOpenEndings} className="mt-4 w-full rounded-xl border border-rose-400/40 px-4 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-400/10">Открыть редактор концовок</button>
        ) : null}
      </div>
    ) : (
      <p className="mt-3 text-xs leading-5 text-slate-500">Выберите блок на карте или в структуре слева.</p>
    )}
    {selectedReferenceKey ? (
      <div className="mt-4 rounded-xl border border-violet-400/30 bg-violet-400/10 p-3 text-xs text-violet-100">
        Показана связь «{selectedReferenceLabel}» · {referenceNodeCount} действий
      </div>
    ) : null}
    {diagnostics.length > 0 ? (
      <details className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-rose-200">Ошибки ссылок · {diagnostics.length}</summary>
        <ul className="mt-2 space-y-2 text-[11px] leading-4 text-rose-100/80">
          {diagnostics.slice(0, 8).map((diagnostic) => <li key={`${diagnostic.interactionId}:${diagnostic.message}`}>{diagnostic.message}</li>)}
        </ul>
      </details>
    ) : null}
  </aside>
)

GraphInspector.propTypes = {
  mode: PropTypes.string.isRequired,
  node: PropTypes.object,
  selectedReferenceKey: PropTypes.string,
  selectedReferenceLabel: PropTypes.string,
  referenceNodeCount: PropTypes.number.isRequired,
  diagnostics: PropTypes.arrayOf(PropTypes.object).isRequired,
  onEditInteraction: PropTypes.func.isRequired,
  onOpenLocations: PropTypes.func.isRequired,
  onOpenEndings: PropTypes.func.isRequired,
  onOpenAccusation: PropTypes.func.isRequired,
  onReferenceSelect: PropTypes.func.isRequired,
  compact: PropTypes.bool,
}
GraphInspector.defaultProps = { node: null, selectedReferenceKey: '', selectedReferenceLabel: '', compact: false }

const InspectorReferences = ({ title, entries, onSelect }) => (
  <section className="mt-4">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
    <div className="mt-2 space-y-1.5">
      {entries.length > 0 ? entries.map((entry) => (
        <button key={entry.refKey} type="button" onClick={() => onSelect(entry.refKey)} className={`block w-full rounded-lg border px-2 py-1.5 text-left text-[11px] leading-4 transition hover:brightness-125 ${CHIP_TONES[entry.tone] || CHIP_TONES.unlock}`}>
          {entry.label}
        </button>
      )) : <p className="text-xs text-slate-600">Нет</p>}
    </div>
  </section>
)

InspectorReferences.propTypes = {
  title: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(PropTypes.object).isRequired,
  onSelect: PropTypes.func.isRequired,
}

const GraphLegend = () => (
  <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-wrap justify-end gap-x-3 gap-y-1 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-[9px] font-semibold text-slate-400">
    <span className="text-amber-300">— условие</span>
    <span className="text-emerald-300">— предмет</span>
    <span className="text-cyan-300">— улика / переход</span>
    <span className="text-violet-300">— открытие</span>
    <span className="text-rose-300">— финал</span>
  </div>
)

const StoryLogicGraph = (props) => (
  <ReactFlowProvider>
    <StoryLogicGraphInner {...props} />
  </ReactFlowProvider>
)

StoryLogicGraph.propTypes = StoryLogicGraphInner.propTypes
StoryLogicGraph.defaultProps = StoryLogicGraphInner.defaultProps

export default StoryLogicGraph
