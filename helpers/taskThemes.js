// Каталог оформления контента не зависит от темы интерфейса пользователя.
export const DEFAULT_TASK_THEME = 'cyberpunk-dark'

export const TASK_THEMES = [
  {
    id: 'cyberpunk-light',
    label: 'Киберпанк Светлая',
    colorScheme: 'light',
    background: '#f0f9ff',
    text: '#172554',
    accent: '#0e7490',
    surface: '#e0f2fe',
    border: '#0891b2',
  },
  {
    id: 'cyberpunk-dark',
    label: 'Киберпанк Тёмная',
    colorScheme: 'dark',
    background: '#0f172a',
    text: '#f1f5f9',
    accent: '#67e8f9',
    surface: '#1e293b',
    border: '#22d3ee',
  },
]

export const normalizeTaskTheme = (value) =>
  TASK_THEMES.some((theme) => theme.id === value) ? value : DEFAULT_TASK_THEME

export const getTaskThemeStyle = (value) => {
  const theme = TASK_THEMES.find(({ id }) => id === normalizeTaskTheme(value))
  return {
    colorScheme: theme.colorScheme,
    '--aq-task-background': theme.background,
    '--aq-task-text': theme.text,
    '--aq-task-accent': theme.accent,
    '--aq-task-surface': theme.surface,
    '--aq-task-border': theme.border,
  }
}
