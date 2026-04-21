const tokenByLocation = {
  dev: process.env.TELEGRAM_DEV_TOKEN,
  krsk: process.env.TELEGRAM_KRSK_TOKEN,
  nrsk: process.env.TELEGRAM_NRSK_TOKEN,
  ekb: process.env.TELEGRAM_EKB_TOKEN,
  project: process.env.TELEGRAM_PROJECT_TOKEN,
}

const getTelegramTokenByLocation = (location) => {
  if (!location) return null
  return tokenByLocation[location] || null
}

export default getTelegramTokenByLocation
