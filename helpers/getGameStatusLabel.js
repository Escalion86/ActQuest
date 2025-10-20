const STATUS_LABELS = {
  active: 'Активна',
  started: 'Запущена',
  finished: 'Завершена',
  canceled: 'Отменена',
}

const getGameStatusLabel = (status) => {
  if (!status) {
    return 'Без статуса'
  }

  const normalized = typeof status === 'string' ? status.toLowerCase() : String(status)

  return STATUS_LABELS[normalized] ?? 'Неизвестный статус'
}

export default getGameStatusLabel
