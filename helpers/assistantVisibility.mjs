export const ASSISTANT_CITIES = Object.freeze({ krsk: 'Красноярск', nrsk: 'Норильск', ekb: 'Екатеринбург' })

// Никаких игровых экранов, даже с testai.
export function isAssistantCabinet(pathname) {
  return /^\/cabinet(?:\/|$)/.test(pathname || '') &&
    !/(?:^|\/)(?:game-control|game-map|photo-review|task-preview|process|test)(?:\/|$)/.test(pathname)
}
// Вне кабинета выбор всегда явный; URL и город по умолчанию не используются.
export function resolveInitialAssistantCity(pathname, sessionCity) {
  return isAssistantCabinet(pathname) && Object.hasOwn(ASSISTANT_CITIES, sessionCity) ? sessionCity : null
}
export function isAssistantVisible(pathname) {
  const path = pathname?.replace(/\/$/, '') || '/'
  return path === '/' || Object.hasOwn(ASSISTANT_CITIES, path.slice(1)) || isAssistantCabinet(path)
}
