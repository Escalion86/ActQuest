'use client'

import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import { getStoryCoverImage } from '@helpers/storyCoverMedia'

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const toneClasses = {
  location: {
    button:
      'bg-cyan-600 hover:bg-cyan-500 focus-visible:outline-cyan-500',
    selected:
      'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-200 dark:bg-cyan-500/10 dark:ring-cyan-500/20',
    fallback:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200',
  },
  item: {
    button:
      'bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-500',
    selected:
      'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/20',
    fallback:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
}

const StoryEntityCatalogModal = ({
  isOpen,
  onClose,
  title,
  addLabel,
  emptyLabel,
  entities,
  selectedId,
  onAdd,
  onOpenEntity,
  disabled,
  tone,
}) => {
  const normalizedEntities = normalizeArray(entities)
  const classes = toneClasses[tone] || toneClasses.location

  return (
    <Modal
      isOpen={isOpen}
      title={`${title} · ${normalizedEntities.length}`}
      onClose={onClose}
      dialogClassName="md:max-w-3xl"
      bodyClassName="bg-slate-50/80 dark:bg-slate-950/40"
      footer={(
        <button
          type="button"
          onClick={onClose}
          className="aq-modal-btn aq-modal-btn-primary"
        >
          Готово
        </button>
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${classes.button}`}
      >
        {addLabel}
      </button>

      <div className="mt-4 grid max-h-[62vh] gap-3 overflow-y-auto sm:grid-cols-2">
        {normalizedEntities.map((entity) => {
          const image = entity.image || getStoryCoverImage(entity.media)
          const isSelected = entity.id === selectedId
          return (
            <button
              key={entity.id}
              type="button"
              onClick={() => onOpenEntity(entity.id)}
              className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${
                isSelected
                  ? classes.selected
                  : 'border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${classes.fallback}`}
                >
                  {(entity.title || '?').trim().slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {entity.title || 'Без названия'}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Открыть редактор
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {normalizedEntities.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          {emptyLabel}
        </p>
      ) : null}
    </Modal>
  )
}

StoryEntityCatalogModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  addLabel: PropTypes.string.isRequired,
  emptyLabel: PropTypes.string.isRequired,
  entities: PropTypes.arrayOf(PropTypes.object),
  selectedId: PropTypes.string,
  onAdd: PropTypes.func.isRequired,
  onOpenEntity: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  tone: PropTypes.oneOf(['location', 'item']),
}

StoryEntityCatalogModal.defaultProps = {
  entities: [],
  selectedId: '',
  disabled: false,
  tone: 'location',
}

export default StoryEntityCatalogModal
