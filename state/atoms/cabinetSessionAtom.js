import { atom } from 'jotai'

/**
 * Атом реальной роли сессии (true если role === 'dev').
 * Синхронизируется из CabinetLayout — не нужно передавать пропом.
 */
const isDeveloperAtom = atom(false)

export { isDeveloperAtom }
