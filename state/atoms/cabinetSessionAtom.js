import { atom } from 'jotai'

/**
 * Атом текущей эффективной роли (с учётом превью).
 * Синхронизируется из CabinetLayout.
 */
const effectiveRoleAtom = atom('client')

/**
 * true если effectiveRole === 'dev'.
 */
const isDeveloperAtom = atom((get) => get(effectiveRoleAtom) === 'dev')

/**
 * true если effectiveRole === 'admin' или 'dev'.
 */
const isAdminAtom = atom((get) => {
  const role = get(effectiveRoleAtom)
  return role === 'admin' || role === 'dev'
})

export { effectiveRoleAtom, isDeveloperAtom, isAdminAtom }
