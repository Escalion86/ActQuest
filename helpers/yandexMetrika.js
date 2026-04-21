'use client'

const getMetrikaCounterId = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.__AQ_YM_ID
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const getGaMeasurementId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return typeof window.__AQ_GA_ID === 'string' ? window.__AQ_GA_ID : ''
}

export const reachYandexGoal = (goalName, params = {}) => {
  if (typeof window === 'undefined') {
    return false
  }

  if (typeof goalName !== 'string' || !goalName.trim()) {
    return false
  }

  const counterId = getMetrikaCounterId()
  if (!counterId || typeof window.ym !== 'function') {
    return false
  }

  try {
    window.ym(counterId, 'reachGoal', goalName.trim(), params)
    return true
  } catch {
    return false
  }
}

export const reachGoogleEvent = (eventName, params = {}) => {
  if (typeof window === 'undefined') {
    return false
  }

  if (typeof eventName !== 'string' || !eventName.trim()) {
    return false
  }

  const measurementId = getGaMeasurementId()
  if (!measurementId || typeof window.gtag !== 'function') {
    return false
  }

  try {
    window.gtag('event', eventName.trim(), params)
    return true
  } catch {
    return false
  }
}

export const reachAnalyticsGoal = (goalName, params = {}) => {
  const yandexSent = reachYandexGoal(goalName, params)
  const googleSent = reachGoogleEvent(goalName, params)
  return yandexSent || googleSent
}
