'use client'

import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { resolveGameScheduleCountdown, formatScheduleCountdown } from '@helpers/gameScheduleCountdown'

export default function GameScheduleCountdown({ game }) {
  const valueRef = useRef(null)
  const serverNow = Date.parse(game?.serverTime)
  const countdown = resolveGameScheduleCountdown(game, Number.isFinite(serverNow) ? serverNow : 0)

  useEffect(() => {
    if (!countdown || !valueRef.current) return
    const localStartedAt = Date.now()
    const serverStartedAt = Date.parse(game?.serverTime)
    const baseTime = Number.isFinite(serverStartedAt) ? serverStartedAt : localStartedAt
    const update = () => {
      const now = baseTime + (Date.now() - localStartedAt)
      const remaining = Math.max(Math.ceil((countdown.target - now) / 1000), 0)
      if (valueRef.current) valueRef.current.textContent = formatScheduleCountdown(remaining)
    }
    update()
    const intervalId = window.setInterval(update, 1000)
    return () => window.clearInterval(intervalId)
  }, [countdown?.target, game?.serverTime])

  if (!countdown) return null
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-cyan-200 bg-cyan-50 p-6 text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100" aria-label={countdown.label}>
      <span className="text-base font-semibold">{countdown.label}</span>
      <span ref={valueRef} className="font-mono text-2xl font-bold tabular-nums tracking-wide" role="timer" aria-label={countdown.label}>
        {Number.isFinite(serverNow) ? formatScheduleCountdown(countdown.seconds) : '00:00:00'}
      </span>
    </section>
  )
}

GameScheduleCountdown.propTypes = {
  game: PropTypes.shape({
    status: PropTypes.string,
    dateStart: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    dateEnd: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    serverTime: PropTypes.string,
  }),
}
