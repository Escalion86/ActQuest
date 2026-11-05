export const MAX_TASK_TABS = 8
export const MAX_TASK_TAB_TITLE_LENGTH = 40

export const normalizeTaskTabTitle = (value, fallback = 'Вкладка') => {
  const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return Array.from(title || fallback).slice(0, MAX_TASK_TAB_TITLE_LENGTH).join('')
}

export const createTaskTabsContent = () => ({
  type: 'taskTabs',
  content: [1, 2].map((number) => ({
    type: 'taskTab',
    attrs: { title: `Вкладка ${number}` },
    content: [{ type: 'paragraph' }],
  })),
})
