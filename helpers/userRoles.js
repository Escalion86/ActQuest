export const USER_ROLE_VALUES = ['client', 'agent', 'moder', 'admin', 'dev', 'ban']

export const USER_ROLE_NAMES = {
  client: 'Пользователь',
  agent: 'Агент',
  moder: 'Модератор',
  admin: 'Администратор',
  dev: 'Разработчик',
  ban: 'Бан',
}

export const USER_ROLE_OPTIONS = [
  { value: 'client', name: USER_ROLE_NAMES.client, color: 'blue-400' },
  { value: 'agent', name: USER_ROLE_NAMES.agent, color: 'cyan-400' },
  { value: 'moder', name: USER_ROLE_NAMES.moder, color: 'green-400' },
  { value: 'admin', name: USER_ROLE_NAMES.admin, color: 'orange-400' },
  { value: 'dev', name: USER_ROLE_NAMES.dev, color: 'danger' },
]
