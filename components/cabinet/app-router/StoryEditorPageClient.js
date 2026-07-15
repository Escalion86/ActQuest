'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import ImagesInput from '@components/cabinet/ImagesInput'
import InvestigationFlowEditor from '@components/cabinet/story-editor/InvestigationFlowEditor'
import StoryEndingsEditor from '@components/cabinet/story-editor/StoryEndingsEditor'
import requestApiJson from '@helpers/requestApiJson'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const NODE_CARD = { width: 190, height: 92 }
const ITEM_CARD = { width: 170, height: 76 }
const ENDING_CARD = { width: 180, height: 76 }
const DRAG_CLICK_SUPPRESS_DISTANCE = 4
const ENDING_TYPE_LABELS = {
  success: 'Успех',
  failed: 'Провал',
  neutral: 'Нейтральная',
  secret: 'Секретная',
}

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
    experienceMode: 'quest',
    nodeLabel: 'Локация',
    startMode: 'common',
    hideTotalNodes: true,
    hideTotalItems: true,
    showInventory: true,
    showScoreToTeam: false,
    showFinalHistoryToTeam: false,
    investigation: {
      startNodeId: null,
      startClockMinutes: 0,
      deadlineMinutes: 240,
      defaultTravelTimeMinutes: 10,
      defaultInteractionTimeMinutes: 10,
      accusationTimeMinutes: 10,
      allowFreeReplay: true,
      showClockToTeam: true,
      showEvidenceToTeam: true,
      autoFailOnDeadline: true,
      revealSolutionAfterFinish: false,
    },
  },
  storyItems: [],
  storyNodes: [],
  storyEdges: [],
  storyEndings: [],
  storyCharacters: [],
  storyTopics: [],
  storyInteractions: [],
  storyEvidence: [],
  storyAccusation: {},
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
  manualOnly: false,
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
  repeatable: false,
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
  repeatable: false,
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

const StoryReferenceChecklist = ({ label, options, value, onChange }) => {
  const selectedIds = new Set(normalizeArray(value))

  return (
    <fieldset className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </legend>
      {options.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(option.id)}
                onChange={(event) => {
                  const nextIds = new Set(selectedIds)
                  if (event.target.checked) nextIds.add(option.id)
                  else nextIds.delete(option.id)
                  onChange(Array.from(nextIds))
                }}
              />
              <span className="truncate">{option.title || 'Без названия'}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Подходящих элементов пока нет.
        </p>
      )}
    </fieldset>
  )
}

StoryReferenceChecklist.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
}

StoryReferenceChecklist.defaultProps = {
  value: [],
}

const StoryEffectFields = ({ effect, kind, items, nodes, endings, onChange }) => {
  const patchEffect = (patch) => onChange({ ...effect, ...patch })

  return (
    <div className="grid gap-3">
      {kind === 'code' ? (
        <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
          Тип кода
          <select
            value={effect.type || 'complete'}
            onChange={(event) => patchEffect({ type: event.target.value })}
            className={fieldClassName}
          >
            <option value="complete">Основной код</option>
            <option value="bonus">Бонусный код</option>
            <option value="effect">Код с эффектом</option>
          </select>
        </label>
      ) : (
        <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
          Описание действия
          <textarea
            value={effect.descriptionRich || ''}
            onChange={(event) =>
              patchEffect({ descriptionRich: event.target.value })
            }
            rows={2}
            className={fieldClassName}
          />
        </label>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
          Начислить баллы
          <input
            type="number"
            value={effect.scoreBonus || 0}
            onChange={(event) =>
              patchEffect({ scoreBonus: Number(event.target.value) || 0 })
            }
            className={fieldClassName}
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
          Списать баллы
          <input
            type="number"
            min="0"
            value={effect.scorePenalty || 0}
            onChange={(event) =>
              patchEffect({
                scorePenalty: Math.max(0, Number(event.target.value) || 0),
              })
            }
            className={fieldClassName}
          />
        </label>
      </div>

      <StoryReferenceChecklist
        label="Требует предметы"
        options={items}
        value={effect.requiredItemIds}
        onChange={(requiredItemIds) => patchEffect({ requiredItemIds })}
      />
      <StoryReferenceChecklist
        label="Выдаёт предметы"
        options={items}
        value={effect.grantsItemIds}
        onChange={(grantsItemIds) => patchEffect({ grantsItemIds })}
      />
      <StoryReferenceChecklist
        label="Тратит предметы"
        options={items}
        value={effect.consumesItemIds}
        onChange={(consumesItemIds) => patchEffect({ consumesItemIds })}
      />
      <StoryReferenceChecklist
        label="Открывает локации"
        options={nodes}
        value={effect.unlocksNodeIds}
        onChange={(unlocksNodeIds) => patchEffect({ unlocksNodeIds })}
      />

      <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
        Перейти к концовке
        <select
          value={effect.endingId || ''}
          onChange={(event) =>
            patchEffect({ endingId: event.target.value || null })
          }
          className={fieldClassName}
        >
          <option value="">Не завершать сюжет</option>
          {endings.map((ending) => (
            <option key={ending.id} value={ending.id}>
              {ending.title || 'Концовка без названия'}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
        Сообщение после выполнения
        <textarea
          value={effect.resultMessageRich || ''}
          onChange={(event) =>
            patchEffect({ resultMessageRich: event.target.value })
          }
          rows={2}
          placeholder="Необязательный текст для команды"
          className={fieldClassName}
        />
      </label>
    </div>
  )
}

StoryEffectFields.propTypes = {
  effect: PropTypes.object.isRequired,
  kind: PropTypes.oneOf(['code', 'action']).isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  nodes: PropTypes.arrayOf(PropTypes.object).isRequired,
  endings: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
}

const JsonScenarioField = ({ label, value, expectedType, onChange }) => {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2))
  const [jsonError, setJsonError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setDraft(JSON.stringify(value, null, 2))
  }, [value])

  const visibleItems = Array.isArray(value)
    ? value.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
      )
    : []

  const applyJson = () => {
    try {
      const parsed = JSON.parse(draft)
      const valid =
        expectedType === 'array'
          ? Array.isArray(parsed)
          : parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      if (!valid) {
        throw new Error(
          expectedType === 'array' ? 'Ожидается JSON-массив.' : 'Ожидается JSON-объект.',
        )
      }
      onChange(parsed)
      setJsonError('')
    } catch (parseError) {
      setJsonError(parseError?.message || 'Некорректный JSON')
    }
  }

  return (
    <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
        {label}{Array.isArray(value) ? ` · ${value.length}` : ''}
      </summary>
      {Array.isArray(value) && value.length > 0 ? (
        <div className="mt-3">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Фильтр по ID или названию" className={fieldClassName} />
          <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-500">
            {visibleItems.slice(0, 30).map((item, index) => (
              <p key={item?.id || index}>{item?.title || item?.label || 'Без названия'}</p>
            ))}
          </div>
        </div>
      ) : null}
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={12} spellCheck={false} className={`${fieldClassName} mt-3 font-mono text-xs`} />
      {jsonError ? <p className="mt-2 text-sm text-rose-600">{jsonError}</p> : null}
      <button type="button" onClick={applyJson} className="mt-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">Применить JSON</button>
    </details>
  )
}

JsonScenarioField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
  expectedType: PropTypes.oneOf(['array', 'object']).isRequired,
  onChange: PropTypes.func.isRequired,
}

const InvestigationEditorSection = ({ game, updateGame }) => {
  const investigation = {
    ...emptyGame.storyConfig.investigation,
    ...(game?.storyConfig?.investigation || {}),
  }
  const setInvestigationField = (field, value) =>
    updateGame((previous) => ({
      ...previous,
      storyConfig: {
        ...previous.storyConfig,
        investigation: {
          ...previous.storyConfig?.investigation,
          [field]: value,
        },
      },
    }))
  const numberFields = [
    ['startClockMinutes', 'Старт, минут от начала суток'],
    ['deadlineMinutes', 'Дедлайн, минут'],
    ['defaultTravelTimeMinutes', 'Переход, минут'],
    ['defaultInteractionTimeMinutes', 'Взаимодействие, минут'],
    ['accusationTimeMinutes', 'Обвинение, минут'],
  ]

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-violet-500/5">
      <h2 className="font-semibold text-slate-900 dark:text-slate-100">Настройки расследования</h2>
      <p className="mt-1 text-xs text-slate-500">Основные справочники редактируются через визуальные окна над картой логики. JSON ниже оставлен для точечной диагностики и сложных массовых правок.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Стартовая локация
          <select value={investigation.startNodeId || ''} onChange={(event) => setInvestigationField('startNodeId', event.target.value || null)} className={fieldClassName}>
            <option value="">Выберите локацию</option>
            {normalizeArray(game?.storyNodes).map((node) => <option key={node.id} value={node.id}>{node.title || 'Локация без названия'}</option>)}
          </select>
        </label>
        {numberFields.map(([field, label]) => (
          <label key={field} className="grid gap-1 text-sm">{label}
            <input type="number" min="0" value={investigation[field] ?? ''} onChange={(event) => setInvestigationField(field, event.target.value === '' ? null : Number(event.target.value))} className={fieldClassName} />
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          ['allowFreeReplay', 'Бесплатное повторное воспроизведение'],
          ['showClockToTeam', 'Показывать игровые часы'],
          ['showEvidenceToTeam', 'Показывать доску доказательств'],
          ['autoFailOnDeadline', 'Автофинал по дедлайну'],
          ['revealSolutionAfterFinish', 'Раскрывать решение после финала'],
        ].map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(investigation[field])} onChange={(event) => setInvestigationField(field, event.target.checked)} />{label}
          </label>
        ))}
      </div>
      <details className="mt-4 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
          Расширенный режим: редактирование JSON
        </summary>
        <div className="mt-3 space-y-3">
          {[
            ['Персонажи', 'storyCharacters'],
            ['Темы', 'storyTopics'],
            ['Взаимодействия', 'storyInteractions'],
            ['Доказательства', 'storyEvidence'],
          ].map(([label, field]) => (
            <JsonScenarioField key={field} label={label} value={normalizeArray(game?.[field])} expectedType="array" onChange={(value) => updateGame((previous) => ({ ...previous, [field]: value }))} />
          ))}
          <JsonScenarioField label="Финальное обвинение и варианты исхода" value={game?.storyAccusation && typeof game.storyAccusation === 'object' ? game.storyAccusation : {}} expectedType="object" onChange={(value) => updateGame((previous) => ({ ...previous, storyAccusation: value }))} />
        </div>
      </details>
    </section>
  )
}

InvestigationEditorSection.propTypes = {
  game: PropTypes.object.isRequired,
  updateGame: PropTypes.func.isRequired,
}

const StoryEditorPageClient = ({ session: _session }) => {
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId') || ''
  const canvasRef = useRef(null)
  const suppressNextNodeClickRef = useRef(false)
  const suppressNextItemClickRef = useRef(false)
  const suppressNextEndingClickRef = useRef(false)
  const [game, setGame] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedEndingId, setSelectedEndingId] = useState('')
  const [isEndingsEditorOpen, setIsEndingsEditorOpen] = useState(false)
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
  const editingItem = items.find((item) => item.id === editingItemId) || null

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
          investigation: {
            ...emptyGame.storyConfig.investigation,
            ...(json.data?.game?.storyConfig?.investigation || {}),
          },
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
        const storyNodes = normalizeArray(prev.storyNodes)
          .filter((node) => node.id !== nodeId)
          .map((node) => ({
            ...node,
            codes: normalizeArray(node.codes).map((code) => ({
              ...code,
              unlocksNodeIds: normalizeArray(code.unlocksNodeIds).filter(
                (id) => id !== nodeId,
              ),
            })),
            actions: normalizeArray(node.actions).map((action) => ({
              ...action,
              unlocksNodeIds: normalizeArray(action.unlocksNodeIds).filter(
                (id) => id !== nodeId,
              ),
            })),
          }))
        const storyEdges = normalizeArray(prev.storyEdges).filter(
          (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
        )
        const syncedNodes = syncNodesFromEdges(storyNodes, storyEdges)
        setSelectedNodeId(syncedNodes[0]?.id || '')
        setEditingNodeId('')
        return {
          ...prev,
          storyNodes: syncedNodes,
          storyEdges,
          storyEndings: normalizeArray(prev.storyEndings).map((ending) => ({
            ...ending,
            conditions: {
              ...ending.conditions,
              requiredCompletedNodeIds: normalizeArray(
                ending?.conditions?.requiredCompletedNodeIds,
              ).filter((id) => id !== nodeId),
            },
          })),
        }
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
        const storyNodes = syncNodesFromEdges(prev.storyNodes, storyEdges).map(
          (node) => ({
            ...node,
            codes: normalizeArray(node.codes).map((code) => ({
              ...code,
              requiredItemIds: normalizeArray(code.requiredItemIds).filter(
                (id) => id !== itemId,
              ),
              grantsItemIds: normalizeArray(code.grantsItemIds).filter(
                (id) => id !== itemId,
              ),
              consumesItemIds: normalizeArray(code.consumesItemIds).filter(
                (id) => id !== itemId,
              ),
            })),
            actions: normalizeArray(node.actions).map((action) => ({
              ...action,
              requiredItemIds: normalizeArray(action.requiredItemIds).filter(
                (id) => id !== itemId,
              ),
              grantsItemIds: normalizeArray(action.grantsItemIds).filter(
                (id) => id !== itemId,
              ),
              consumesItemIds: normalizeArray(action.consumesItemIds).filter(
                (id) => id !== itemId,
              ),
            })),
          }),
        )
        setSelectedItemId(storyItems[0]?.id || '')
        setEditingItemId('')
        return {
          ...prev,
          storyItems,
          storyNodes,
          storyEdges,
          storyEndings: normalizeArray(prev.storyEndings).map((ending) => ({
            ...ending,
            conditions: {
              ...ending.conditions,
              requiredItemIds: normalizeArray(
                ending?.conditions?.requiredItemIds,
              ).filter((id) => id !== itemId),
            },
          })),
        }
      })
    },
    [updateGame],
  )

  const removeEnding = useCallback(
    (endingId) => {
      if (!endingId) return
      if (!window.confirm('Удалить концовку и переходы к ней?')) return
      updateGame((prev) => {
        const storyEndings = normalizeArray(prev.storyEndings).filter(
          (ending) => ending.id !== endingId,
        )
        const storyNodes = normalizeArray(prev.storyNodes).map((node) => ({
          ...node,
          codes: normalizeArray(node.codes).map((code) => ({
            ...code,
            endingId: code.endingId === endingId ? null : code.endingId,
          })),
          actions: normalizeArray(node.actions).map((action) => ({
            ...action,
            endingId: action.endingId === endingId ? null : action.endingId,
          })),
        }))
        setSelectedEndingId(storyEndings[0]?.id || '')
        return { ...prev, storyEndings, storyNodes }
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
    if (dragState?.type === 'ending' && dragState?.hasDragged) {
      suppressNextEndingClickRef.current = true
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
          storyCharacters: game.storyCharacters,
          storyTopics: game.storyTopics,
          storyInteractions: game.storyInteractions,
          storyEvidence: game.storyEvidence,
          storyAccusation: game.storyAccusation,
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
          investigation: {
            ...emptyGame.storyConfig.investigation,
            ...(json.data?.game?.storyConfig?.investigation || {}),
          },
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
  const isScenarioLocked = ['started', 'finished', 'closed'].includes(
    normalizeText(game?.status).toLowerCase(),
  )

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
        {isScenarioLocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            Эта версия сценария уже использовалась в игре и доступна только для
            просмотра. Для изменений создайте копию игры.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addNode}
              disabled={isScenarioLocked}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Добавить локацию
            </button>
            <button
              type="button"
              onClick={addItem}
              disabled={isScenarioLocked}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Добавить предмет
            </button>
            <button
              type="button"
              onClick={() => setIsEndingsEditorOpen(true)}
              className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-500/50 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-500/10"
            >
              Концовки · {endings.length}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void saveEditor()}
            disabled={saving || loading || isScenarioLocked}
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
        {normalizeArray(game?.validationErrors).length > 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="font-semibold">
              Сохранённый сценарий пока нельзя запускать:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {game.validationErrors.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {game?.storyConfig?.experienceMode === 'investigation' ? (
          <InvestigationFlowEditor
            game={game}
            gameId={gameId}
            updateGame={updateGame}
            disabled={isScenarioLocked}
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Граф сценария
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  {connectSource
                    ? 'Нажмите на левую точку локации, чтобы завершить связь'
                    : 'Правая точка — выход, левая точка локации — вход'}
                </span>
                {connectSource ? (
                  <button
                    type="button"
                    onClick={() => setConnectSource(null)}
                    className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                  >
                    Отменить связь
                  </button>
                ) : null}
              </div>
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
                        {node.title || 'Локация без названия'}
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
                        {item.title || 'Предмет без названия'}
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
                      onClick={(event) => {
                        if (suppressNextEndingClickRef.current) {
                          event.preventDefault()
                          suppressNextEndingClickRef.current = false
                          return
                        }
                        setSelectedEndingId(ending.id)
                        setIsEndingsEditorOpen(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedEndingId(ending.id)
                          setIsEndingsEditorOpen(true)
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
                        {ending.title || 'Концовка без названия'}
                      </span>
                      <span className="mt-1 block text-xs text-violet-700 dark:text-violet-200">
                        Концовка
                      </span>
                      <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                        {ENDING_TYPE_LABELS[ending.type] || 'Тип не указан'}
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
                  Формат story-игры
                  <select
                    value={game?.storyConfig?.experienceMode || 'quest'}
                    onChange={(event) =>
                      updateGame((prev) => ({
                        ...prev,
                        storyConfig: {
                          ...prev.storyConfig,
                          experienceMode: event.target.value,
                        },
                      }))
                    }
                    className={fieldClassName}
                  >
                    <option value="quest">Сюжетный квест</option>
                    <option value="investigation">Цифровое расследование</option>
                  </select>
                </label>
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
                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  Режим старта
                  <select
                    value={game?.storyConfig?.startMode || 'common'}
                    onChange={(event) =>
                      updateGame((prev) => ({
                        ...prev,
                        storyConfig: {
                          ...prev.storyConfig,
                          startMode: event.target.value,
                        },
                      }))
                    }
                    className={fieldClassName}
                  >
                    <option value="common">Общий старт</option>
                    <option value="individual">Индивидуальный старт</option>
                  </select>
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
                {[
                  ['showInventory', 'Показывать инвентарь'],
                  ['showFinalHistoryToTeam', 'Показывать историю после финала'],
                  ['hideTotalNodes', 'Скрывать общее число локаций'],
                  ['hideTotalItems', 'Скрывать общее число предметов'],
                ].map(([field, label]) => (
                  <label
                    key={field}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(game?.storyConfig?.[field])}
                      onChange={(event) =>
                        updateGame((prev) => ({
                          ...prev,
                          storyConfig: {
                            ...prev.storyConfig,
                            [field]: event.target.checked,
                          },
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            {game?.storyConfig?.experienceMode === 'investigation' ? (
              <InvestigationEditorSection game={game} updateGame={updateGame} />
            ) : null}

          </aside>
        </div>
      </div>

      {game ? (
        <StoryEndingsEditor
          isOpen={isEndingsEditorOpen}
          onClose={() => setIsEndingsEditorOpen(false)}
          game={game}
          gameId={gameId}
          selectedEndingId={selectedEndingId}
          onSelectEnding={setSelectedEndingId}
          onAddEnding={addEnding}
          onRemoveEnding={removeEnding}
          onUpdateEnding={updateEnding}
          updateGame={updateGame}
          disabled={isScenarioLocked}
        />
      ) : null}

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
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingNode.visibility?.hiddenUntilUnlocked !== false}
                      onChange={(event) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          visibility: {
                            ...node.visibility,
                            hiddenUntilUnlocked: event.target.checked,
                          },
                        }))
                      }
                    />
                    Скрыта до открытия
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
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['latitude', 'Широта'],
                    ['longitude', 'Долгота'],
                    ['radius', 'Радиус, м'],
                  ].map(([field, label]) => (
                    <label
                      key={field}
                      className="grid gap-1 text-sm text-slate-600 dark:text-slate-300"
                    >
                      {label}
                      <input
                        type="number"
                        step={field === 'radius' ? '1' : 'any'}
                        min={field === 'radius' ? '0' : undefined}
                        value={editingNode.coordinates?.[field] ?? ''}
                        onChange={(event) =>
                          updateNode(editingNode.id, (node) => ({
                            ...node,
                            coordinates: {
                              ...node.coordinates,
                              [field]:
                                event.target.value === ''
                                  ? null
                                  : Number(event.target.value),
                            },
                          }))
                        }
                        placeholder="Не задано"
                        className={fieldClassName}
                      />
                    </label>
                  ))}
                </div>
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
                    <div className="flex gap-2">
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
                        className={`min-w-0 flex-1 ${fieldClassName}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateNode(editingNode.id, (node) => ({
                            ...node,
                            codes: normalizeArray(node.codes).filter(
                              (item) => item.id !== code.id,
                            ),
                          }))
                        }
                        className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:text-rose-200"
                      >
                        Удалить
                      </button>
                    </div>
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
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(code.repeatable)}
                          onChange={(event) =>
                            updateNode(editingNode.id, (node) => ({
                              ...node,
                              codes: normalizeArray(node.codes).map((item) =>
                                item.id === code.id
                                  ? { ...item, repeatable: event.target.checked }
                                  : item,
                              ),
                            }))
                          }
                        />
                        Можно использовать повторно
                      </label>
                    </div>
                    <StoryEffectFields
                      effect={code}
                      kind="code"
                      items={items}
                      nodes={nodes.filter((node) => node.id !== editingNode.id)}
                      endings={endings.filter((ending) => !ending.manualOnly)}
                      onChange={(nextCode) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          codes: normalizeArray(node.codes).map((item) =>
                            item.id === code.id ? nextCode : item,
                          ),
                        }))
                      }
                    />
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
                    <div className="flex gap-2">
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
                        className={`min-w-0 flex-1 ${fieldClassName}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateNode(editingNode.id, (node) => ({
                            ...node,
                            actions: normalizeArray(node.actions).filter(
                              (item) => item.id !== action.id,
                            ),
                          }))
                        }
                        className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:text-rose-200"
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-4">
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
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(action.repeatable)}
                          onChange={(event) =>
                            updateNode(editingNode.id, (node) => ({
                              ...node,
                              actions: normalizeArray(node.actions).map((item) =>
                                item.id === action.id
                                  ? { ...item, repeatable: event.target.checked }
                                  : item,
                              ),
                            }))
                          }
                        />
                        Можно выполнять повторно
                      </label>
                    </div>
                    <StoryEffectFields
                      effect={action}
                      kind="action"
                      items={items}
                      nodes={nodes.filter((node) => node.id !== editingNode.id)}
                      endings={endings.filter((ending) => !ending.manualOnly)}
                      onChange={(nextAction) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          actions: normalizeArray(node.actions).map((item) =>
                            item.id === action.id ? nextAction : item,
                          ),
                        }))
                      }
                    />
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
                    <div className="flex gap-2">
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
                        className={`min-w-0 flex-1 ${fieldClassName}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateNode(editingNode.id, (node) => ({
                            ...node,
                            clues: normalizeArray(node.clues).filter(
                              (item) => item.id !== clue.id,
                            ),
                          }))
                        }
                        className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:text-rose-200"
                      >
                        Удалить
                      </button>
                    </div>
                    <TaskRichEditor
                      value={clue.contentRich || ''}
                      directory={`games/${gameId || 'draft'}/story/nodes/${editingNode.id}/clues/${clue.id}/editor`}
                      contentMaxHeight="280px"
                      placeholder="Текст и медиа подсказки"
                      onChange={({ html, media }) =>
                        updateNode(editingNode.id, (node) => ({
                          ...node,
                          clues: normalizeArray(node.clues).map((item) =>
                            item.id === clue.id
                              ? {
                                  ...item,
                                  contentRich:
                                    typeof html === 'string' ? html : '',
                                  media: Array.isArray(media) ? media : [],
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                    <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300 sm:max-w-xs">
                      Штраф за подсказку
                      <input
                        type="number"
                        min="0"
                        value={clue.scorePenalty || 0}
                        onChange={(event) =>
                          updateNode(editingNode.id, (node) => ({
                            ...node,
                            clues: normalizeArray(node.clues).map((item) =>
                              item.id === clue.id
                                ? {
                                    ...item,
                                    scorePenalty: Math.max(
                                      0,
                                      Number(event.target.value) || 0,
                                    ),
                                  }
                                : item,
                            ),
                          }))
                        }
                        className={fieldClassName}
                      />
                    </label>
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
