'use client'

import PropTypes from 'prop-types'

const StoryInvestigationClock = ({ clock }) => (
  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-500/30 dark:bg-cyan-500/10">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Игровое время</p>
      <p className="mt-1 text-2xl font-bold">{clock?.formattedCurrentTime || '—'}</p>
    </div>
    <div className="text-right">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Осталось</p>
      <p className="mt-1 text-2xl font-bold">{clock?.remainingMinutes ?? '—'} мин.</p>
    </div>
  </div>
)

StoryInvestigationClock.propTypes = {
  clock: PropTypes.shape({
    formattedCurrentTime: PropTypes.string,
    remainingMinutes: PropTypes.number,
  }),
}

StoryInvestigationClock.defaultProps = { clock: null }

export default StoryInvestigationClock
