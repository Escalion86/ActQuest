const botNames = {
  dev: process.env.NEXT_PUBLIC_TELEGRAM_DEV_BOT_NAME || 'ActQuest_dev_bot',
  krsk: process.env.NEXT_PUBLIC_TELEGRAM_KRSK_BOT_NAME,
  nrsk: process.env.NEXT_PUBLIC_TELEGRAM_NRSK_BOT_NAME,
  ekb: process.env.NEXT_PUBLIC_TELEGRAM_EKB_BOT_NAME,
}

const getTelegramBotNameByLocation = (location) => {
  if (!location) return null
  return botNames[location] || process.env.NEXT_PUBLIC_TELEGRAM_DEFAULT_BOT_NAME || null
}

export default getTelegramBotNameByLocation
