'use client'

import PropTypes from 'prop-types'

import RichTaskContentView from '@components/game/RichTaskContentView'

const normalizeClues = (value) =>
  (Array.isArray(value) ? value : [])
    .map((clue, index) => ({
      index: Number.isFinite(Number(clue?.index)) ? Number(clue.index) : index,
      label: String(clue?.label || '').trim() || `Подсказка ${index + 1}`,
      html: String(clue?.html || ''),
      text: String(clue?.text || ''),
    }))
    .filter((clue) => Boolean(clue.html || clue.text))

const TaskDisplayWithClues = ({
  taskHtml,
  taskText,
  clues,
  directoryBase,
  taskClassName,
  taskTextClassName,
  cluesWrapperClassName,
  clueCardClassName,
  clueTitleClassName,
  clueContentClassName,
  clueContentTextClassName,
}) => {
  const normalizedClues = normalizeClues(clues)

  return (
    <>
      <RichTaskContentView
        html={String(taskHtml || '')}
        text={String(taskText || '')}
        className={taskClassName}
        textClassName={taskTextClassName}
        directory={`${directoryBase}/task`}
      />

      {normalizedClues.length > 0 ? (
        <div className={cluesWrapperClassName}>
          {normalizedClues.map((clue, clueIndex) => (
            <div
              key={`task-clue-${clue.index}-${clueIndex}`}
              className={clueCardClassName}
            >
              <h3 className={clueTitleClassName}>{clue.label}:</h3>
              <RichTaskContentView
                html={clue.html}
                text={clue.text}
                className={clueContentClassName}
                textClassName={clueContentTextClassName}
                directory={`${directoryBase}/clues/${String(clue.index)}`}
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

TaskDisplayWithClues.propTypes = {
  taskHtml: PropTypes.string,
  taskText: PropTypes.string,
  clues: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      label: PropTypes.string,
      html: PropTypes.string,
      text: PropTypes.string,
    }),
  ),
  directoryBase: PropTypes.string,
  taskClassName: PropTypes.string,
  taskTextClassName: PropTypes.string,
  cluesWrapperClassName: PropTypes.string,
  clueCardClassName: PropTypes.string,
  clueTitleClassName: PropTypes.string,
  clueContentClassName: PropTypes.string,
  clueContentTextClassName: PropTypes.string,
}

TaskDisplayWithClues.defaultProps = {
  taskHtml: '',
  taskText: '',
  clues: [],
  directoryBase: 'games/shared',
  taskClassName: 'text-base leading-relaxed text-gray-700 dark:text-slate-200',
  taskTextClassName:
    'text-base leading-relaxed text-gray-700 dark:text-slate-200',
  cluesWrapperClassName: 'mt-4 space-y-4',
  clueCardClassName:
    'rounded-2xl border border-cyan-300/70 bg-cyan-50/80 p-4 dark:border-cyan-500/40 dark:bg-cyan-500/10',
  clueTitleClassName:
    'text-sm font-semibold text-cyan-900 dark:text-cyan-100',
  clueContentClassName:
    'mt-2 text-base leading-relaxed text-gray-700 dark:text-slate-200',
  clueContentTextClassName:
    'mt-2 text-base leading-relaxed text-gray-700 dark:text-slate-200',
}

export default TaskDisplayWithClues

