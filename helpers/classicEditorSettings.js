import { hasClassicVariants } from './classicVariants.js'

export const canManageClassicEditor = (role) => ['admin', 'dev'].includes(role)

// Это настройка видимости редактора; сохранённые игровые правила не отключаются.
export const showClassicItemsAndVariants = (game) => {
  if (game?.type !== 'classic') return false
  if (typeof game.classicItemsAndVariantsEnabled === 'boolean') {
    return game.classicItemsAndVariantsEnabled
  }
  return hasClassicVariants(game) || (game.tasks || []).some((task) => task.variants?.length > 0)
}
