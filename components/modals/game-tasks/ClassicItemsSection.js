import PropTypes from 'prop-types'
import { validateClassicVariants } from '@helpers/classicVariants'
import { normalizeClassicItemQuantities } from '@helpers/classicVariantEditor'
import ClassicItemsEditor from './ClassicItemsEditor'

export default function ClassicItemsSection({ game, onChange, disabled }) {
  if (game.type !== 'classic') return null
  const errors = validateClassicVariants(game)
  const updateItems = (items) => {
    if (disabled) return
    onChange((previous) => ({ ...previous, classicItems: items, tasks: normalizeClassicItemQuantities(previous.tasks, items) }))
  }
  return <div className="mb-4 space-y-3">
    <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><summary className="cursor-pointer font-semibold">Предметы игры · {game.classicItems?.length || 0}</summary>
      <p className="my-3 text-sm text-slate-500">Общий каталог. Предмет можно создать прямо в награде за код или в условии варианта.</p>
      <ClassicItemsEditor items={game.classicItems || []} onChange={updateItems} disabled={disabled} tasks={game.tasks || []} />
    </details>
    {errors.length > 0 && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"><p className="font-semibold">Проверьте настройки вариантов и предметов</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
  </div>
}
ClassicItemsSection.propTypes = { game: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool }
