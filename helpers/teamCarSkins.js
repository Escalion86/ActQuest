export const TEAM_CAR_SKIN_VALUES = ['classic', 'sport', 'suv', 'van']

export const TEAM_CAR_SKIN_OPTIONS = [
  { value: 'classic', label: 'Классика' },
  { value: 'sport', label: 'Спорт' },
  { value: 'suv', label: 'Внедорожник' },
  { value: 'van', label: 'Фургон' },
]

export const normalizeTeamCarSkin = (value) => {
  if (typeof value !== 'string') {
    return 'classic'
  }

  const normalized = value.trim().toLowerCase()
  return TEAM_CAR_SKIN_VALUES.includes(normalized) ? normalized : 'classic'
}

