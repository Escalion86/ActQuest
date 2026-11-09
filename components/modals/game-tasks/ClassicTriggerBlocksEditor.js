import { useState } from 'react'
import dynamic from 'next/dynamic'
import PropTypes from 'prop-types'
import { classicButtonClass, classicInputClass } from './ClassicItemQuantities'

const TaskRichEditor = dynamic(() => import('@components/cabinet/TaskRichEditor'), { ssr: false })

export default function ClassicTriggerBlocksEditor({ blocks = [], triggers, directory, taskTheme, disabled, onChange }) {
  const [openId, setOpenId] = useState(null)
  const updateBlock = (id, patch) => onChange((current) =>
    current.map((block) => block.id === id ? { ...block, ...patch } : block))

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h4 className="text-sm font-semibold">Скрытые блоки описания</h4>
      <p className="text-sm text-slate-500">
        Блок появится под основным описанием после активации выбранного триггера.
      </p>
      {blocks.map((block, index) => (
        <div key={block.id} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="block text-sm">Триггер блока {index + 1}
            <select className={classicInputClass} disabled={disabled} value={block.triggerId} onChange={(event) => updateBlock(block.id, { triggerId: event.target.value })}>
              <option value="">Выберите триггер</option>
              {triggers.map(({ id, title }) => <option key={id} value={id}>{title.trim() || 'Без названия'}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={classicButtonClass} aria-expanded={openId === block.id} onClick={() => setOpenId((current) => current === block.id ? null : block.id)}>
              {openId === block.id ? 'Свернуть содержимое' : 'Показать содержимое'}
            </button>
            <button type="button" className={`${classicButtonClass} text-red-600`} disabled={disabled} onClick={() => onChange((current) => current.filter(({ id }) => id !== block.id))}>
              Удалить блок
            </button>
          </div>
          {openId === block.id && (
            <TaskRichEditor
              value={block.contentRich}
              directory={`${directory}/${block.id}`}
              taskTheme={taskTheme}
              disabled={disabled}
              placeholder="Добавьте текст или изображение для команды."
              onChange={({ html }) => {
                if (html !== block.contentRich) updateBlock(block.id, { contentRich: html })
              }}
            />
          )}
        </div>
      ))}
      <button type="button" className={classicButtonClass} disabled={disabled || !triggers.length} onClick={() => {
        const id = crypto.randomUUID()
        onChange((current) => [...current, { id, triggerId: triggers.length === 1 ? triggers[0].id : '', contentRich: '' }])
        setOpenId(id)
      }}>
        Добавить скрытый блок
      </button>
      {!triggers.length && <p className="text-xs text-slate-500">Сначала создайте триггер в разделе «Триггеры игры».</p>}
    </section>
  )
}

ClassicTriggerBlocksEditor.propTypes = {
  blocks: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    triggerId: PropTypes.string.isRequired,
    contentRich: PropTypes.string.isRequired,
  })),
  triggers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  })).isRequired,
  directory: PropTypes.string.isRequired,
  taskTheme: PropTypes.string,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
}
