import { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { classicEditorContent, copyClassicContent, updateClassicEditorContent, changeClassicEditorCode } from '@helpers/classicVariantEditor'
import { normalizeClassicCode } from '@helpers/classicGameRules'
import { hasClassicVariants } from '@helpers/classicVariants'
import TaskItem from './sections/TaskItem'
import ClassicVariantsEditor from './ClassicVariantsEditor'
import Quantities, { ClassicOutcomeRewards, classicButtonClass, classicInputClass } from './ClassicItemQuantities'

export default function ClassicStageTaskItem({ updateSelectedGame, canManageClassic, ...props }) {
  const [selection, setSelection] = useState('default')
  const [draggedClue, setDraggedClue] = useState(null)
  const [overClue, setOverClue] = useState(null)
  const pointerClue = useRef(null)
  const { task, selectedGame: game, index } = props
  const disabled = !props.canEditSelectedGame || props.isSaving || ['started', 'finished', 'closed'].includes(game.status)
  const variant = task.variantConfig?.enabled ? task.variants?.find((entry) => entry.id === selection) : null
  const variantId = variant?.id || 'default'
  const content = variant ? classicEditorContent(variant.content || {}, variant.id) : task
  const items = game.classicItems || []
  const updateContent = (update, item) => {
    if (disabled) return
    updateSelectedGame((previous) => updateClassicEditorContent(item ? { ...previous, classicItems: [...(previous.classicItems || []), item] } : previous, task.id, variantId, update))
  }
  const field = (_id, name, value) => updateContent(() => ({ [name]: value }))
  const nullable = (value) => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value)
  const listChange = (name, id, key, value) => updateContent((current) => ({ [name]: (current[name] || []).map((entry) => entry.id === id ? { ...entry, [key]: value } : entry) }))
  const codeChange = (category, key, value, remove = false) => {
    if (disabled) return
    updateSelectedGame((previous) => changeClassicEditorCode(previous, task.id, variantId, category, key, value, remove))
  }
  const reorderClue = (_id, from, to) => updateContent((current) => {
    const clues = [...(current.clues || [])]
    if (from < 0 || to < 0 || from >= clues.length || to >= clues.length) return {}
    clues.splice(to, 0, ...clues.splice(from, 1)); return { clues }
  })
  const handlers = {
    handleTaskFieldChange: field,
    handleTaskNumberChange: (_id, name, value) => field(_id, name, Number(value) || 0),
    handleTaskOptionalNumberChange: (_id, name, value) => field(_id, name, nullable(value)),
    handleTaskCheckboxChange: (_id, name, value) => field(_id, name, Boolean(value)),
    handleTaskCoordinateChange: (_id, name, value) => updateContent((current) => ({ coordinates: { ...current.coordinates, [name]: nullable(value) } })),
    handleAddTaskCode: () => updateContent((current) => ({ codes: [...(current.codes || []), ''], codePhotos: [...(current.codePhotos || []), ''] })),
    handleTaskCodeChange: (_id, i, value) => codeChange('main', i, value),
    handleTaskCodePhotoChange: (_id, i, value) => updateContent((current) => { const photos = [...(current.codePhotos || [])]; photos[i] = value; return { codePhotos: photos } }),
    handleRemoveTaskCode: (_id, i) => codeChange('main', i, '', true),
    handleAddClue: (_id, preferredId) => { const id = preferredId || crypto.randomUUID(); updateContent((current) => ({ clues: [...(current.clues || []), { id, clue: '', clueRich: '', clueMedia: [] }] })) },
    handleTaskClueChange: (_id, id, key, value) => listChange('clues', id, key, value),
    handleRemoveClue: (_id, id) => updateContent((current) => ({ clues: (current.clues || []).filter((entry) => entry.id !== id) })),
    handleReorderClue: reorderClue,
    ...Object.fromEntries(['bonus', 'penalty'].flatMap((category) => {
      const title = category === 'bonus' ? 'Bonus' : 'Penalty'
      const name = `${category}Codes`
      return [
        [`handleAdd${title}Code`, () => { const id = crypto.randomUUID(); updateContent((current) => ({ [name]: [...(current[name] || []), { id, code: '', description: '', image: '', [category]: 0 }] })) }],
        [`handle${title}CodeChange`, (_id, id, key, value) => key === 'code' ? codeChange(category, id, value) : listChange(name, id, key, value)],
        [`handleRemove${title}Code`, (_id, id) => codeChange(category, id, '', true)],
      ]
    })),
  }
  const resetDrag = () => { pointerClue.current = null; setDraggedClue(null); setOverClue(null) }
  const dragHandlers = variant ? {
    draggedClueMeta: draggedClue, dragOverClueMeta: overClue,
    setDraggedClueMeta: setDraggedClue, setDragOverClueMeta: setOverClue,
    resetTouchClueDragState: resetDrag,
    handleClueHandlePointerDown: (taskId, clueId, allowed, event) => {
      if (!allowed || disabled) return
      event.preventDefault()
      pointerClue.current = { taskId, clueId, overId: null }
      setDraggedClue({ taskId, clueId })
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    handleClueHandlePointerMove: (event) => {
      if (!pointerClue.current) return
      const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-clue-dnd-id]')
      const overId = element?.getAttribute('data-clue-dnd-task-id') === content.id ? element.getAttribute('data-clue-dnd-id') : null
      pointerClue.current.overId = overId
      setOverClue(overId ? { taskId: content.id, clueId: overId } : null)
    },
    handleClueHandlePointerUp: () => {
      const drag = pointerClue.current
      if (drag?.overId) reorderClue(content.id, content.clues.findIndex((entry) => entry.id === drag.clueId), content.clues.findIndex((entry) => entry.id === drag.overId))
      resetDrag()
    },
  } : {}
  const changeRewards = (category, code, quantities, item) => updateContent((current) => ({ itemRewards: { ...current.itemRewards, codes: [
    ...(current.itemRewards?.codes || []).filter((reward) => !(reward.category === category && normalizeClassicCode(reward.code) === normalizeClassicCode(code))),
    ...(quantities.length ? [{ category, code, items: quantities }] : []),
  ] } }), item)
  const renderCodeReward = (category, code) => {
    if (!code?.trim()) return <p className="mt-2 text-xs text-slate-500">Введите код, чтобы настроить выдачу предметов.</p>
    const reward = content.itemRewards?.codes?.find((entry) => entry.category === category && normalizeClassicCode(entry.code) === normalizeClassicCode(code))
    return <details className="mt-3 rounded-xl border border-cyan-200 p-3 dark:border-cyan-800"><summary className="cursor-pointer text-sm font-medium">Выдать предмет за этот код{reward?.items?.length ? ` · ${reward.items.map((entry) => `${items.find((item) => item.id === entry.itemId)?.title || 'Удалённый предмет'} ×${entry.quantity}`).join(', ')}` : ''}</summary>
      <div className="mt-2"><Quantities items={items} value={reward?.items} disabled={disabled} onChange={(value) => changeRewards(category, code, value)} onCreateItem={(item, value) => changeRewards(category, code, value, item)} /></div>
    </details>
  }
  if (!canManageClassic || game.type !== 'classic' || (['started', 'finished', 'closed'].includes(game.status) && !hasClassicVariants(game))) return <TaskItem {...props} />
  return <TaskItem {...props} expandedContent={props.isExpanded ? <div className="space-y-5 p-3 sm:p-4">
    {task.variantConfig?.enabled && (
      <ClassicVariantsEditor game={game} stageIndex={index} variantId={variantId} onSelectVariant={(id) => { setSelection(id); resetDrag() }} onChange={updateSelectedGame} disabled={disabled} />
    )}
    <h3 className="font-semibold">{variant ? `Задание варианта «${variant.title}»` : 'Основное задание'}</h3>
    <TaskItem {...props} {...handlers} {...dragHandlers} key={variantId} task={content} contentOnly hideDeleteAction isAlternative={Boolean(variant)} isExpanded canEditSelectedGame={!disabled} renderCodeReward={renderCodeReward} />
    <section className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h4 className="font-semibold">Какие предметы получит команда?</h4>
      <p className="text-sm text-slate-500">Награды за результат именно этого варианта. Выдача за отдельный код настраивается рядом с кодом.</p>
      <ClassicOutcomeRewards value={content.itemRewards} items={items} disabled={disabled} onChange={(itemRewards) => updateContent(() => ({ itemRewards }))} onCreateItem={(item, itemRewards) => updateContent(() => ({ itemRewards }), item)} />
    </section>
    <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-sm font-medium">Общие награды этапа и дополнительные настройки</summary><div className="mt-3 space-y-3">
      <p className="text-sm text-slate-500">Эти награды складываются с наградами выбранного варианта. Выдаются также, если время истекло или капитан слил этап до выбора.</p>
      <ClassicOutcomeRewards value={task.outcomeRewards} items={items} disabled={disabled} onChange={(outcomeRewards) => { if (!disabled) updateSelectedGame((previous) => ({ ...previous, tasks: previous.tasks.map((entry) => entry.id === task.id ? { ...entry, outcomeRewards } : entry) })) }} onCreateItem={(item, outcomeRewards) => { if (!disabled) updateSelectedGame((previous) => ({ ...previous, classicItems: [...(previous.classicItems || []), item], tasks: previous.tasks.map((entry) => entry.id === task.id ? { ...entry, outcomeRewards } : entry) })) }} />
      {variant && <label className="block text-sm">Бонус за выполнение варианта, секунд<input type="number" min="0" disabled={disabled} className={classicInputClass} value={content.taskBonusForComplite || 0} onChange={(event) => field(content.id, 'taskBonusForComplite', Number(event.target.value))} /></label>}
      {variant && <label className="block text-sm">Заменить содержимое копией другого задания<select className={classicInputClass} disabled={disabled} value="" onChange={(event) => {
        const source = game.tasks.find((entry) => entry.id === event.target.value)
        if (!source || disabled || !window.confirm('Заменить содержимое варианта? Его условия и расход сохранятся.')) return
        updateSelectedGame((previous) => ({ ...previous, tasks: previous.tasks.map((entry) => entry.id === task.id ? { ...entry, variants: entry.variants.map((current) => current.id === variantId ? { ...current, content: copyClassicContent(source) } : current) } : entry) }))
      }}><option value="">Выберите задание</option>{game.tasks.map((entry, i) => <option key={entry.id} value={entry.id}>{i + 1}. {entry.title}</option>)}</select></label>}
      <button type="button" className={`${classicButtonClass} text-red-600`} disabled={disabled} onClick={() => {
        if (window.confirm(`Удалить этап «${task.title}» со всеми вариантами?`)) props.handleRemoveTask(task.id)
      }}>Удалить весь этап</button>
    </div></details>
  </div> : undefined} />
}
ClassicStageTaskItem.propTypes = { ...TaskItem.type.propTypes, updateSelectedGame: PropTypes.func.isRequired, canManageClassic: PropTypes.bool.isRequired }
