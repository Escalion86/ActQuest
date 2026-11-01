import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import {
  getGamePrequels,
  isPrequelOpenForDate,
} from '@helpers/normalizePrequel'

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(1, Math.ceil(milliseconds / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [
    days > 0 ? `${days} д` : '',
    days > 0 || hours > 0 ? `${hours} ч` : '',
    days > 0 || hours > 0 || minutes > 0 ? `${minutes} мин` : '',
    `${seconds} с`,
  ].filter(Boolean).join(' ')
}

const GamePrequelCardAction = ({ game, onOpen }) => {
  const prequels = useMemo(
    () => getGamePrequels(game, { includeCodes: false }).filter((item) => item.enabled),
    [game],
  )
  const [nowTs, setNowTs] = useState(() => Date.now())
  const nextOpenAt = Math.min(...prequels
    .map((item) => new Date(item.openAt).getTime())
    .filter((value) => Number.isFinite(value) && value > nowTs))
  const hasOpenPrequel = prequels.some((item) => isPrequelOpenForDate(item, new Date(nowTs)))

  useEffect(() => {
    if (hasOpenPrequel || !Number.isFinite(nextOpenAt)) return undefined
    const intervalId = window.setInterval(() => setNowTs(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [hasOpenPrequel, nextOpenAt])

  if (prequels.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpen(game)
        }}
        className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-violet-300/70 bg-violet-50/80 px-4 py-1.5 text-sm font-semibold text-violet-700 transition hover:border-violet-500 hover:bg-violet-100 dark:border-violet-500/45 dark:bg-violet-500/12 dark:text-violet-200 dark:hover:bg-violet-500/20"
      >
        Приквел
      </button>
      {!hasOpenPrequel && Number.isFinite(nextOpenAt) ? (
        <span className="text-xs text-slate-500 dark:text-slate-300">
          Приквел откроется через {formatCountdown(nextOpenAt - nowTs)}
        </span>
      ) : null}
    </div>
  )
}

GamePrequelCardAction.propTypes = {
  game: PropTypes.shape({
    prequel: PropTypes.object,
    prequels: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
}

export default GamePrequelCardAction
