import dbConnectGlobal from '@utils/dbConnectGlobal'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export default async function sitemap() {
  const staticPages = [
    {
      url: siteUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  let gamePages = []

  try {
    const db = await dbConnectGlobal()
    if (db) {
      const gamesModel = db.model('Games')
      const games = await gamesModel
        .find(
          {
            hidden: { $ne: true },
            status: { $in: ['active', 'started', 'finished', 'closed'] },
          },
          { _id: 1, updatedAt: 1 },
        )
        .sort({ dateStart: -1 })
        .limit(500)
        .lean()

      gamePages = games.map((game) => ({
        url: `${siteUrl}/game/${game._id}`,
        lastModified: game.updatedAt || undefined,
        changeFrequency: 'weekly',
        priority: 0.7,
      }))
    }
  } catch (error) {
    console.error('Sitemap generation error:', error)
  }

  return [...staticPages, ...gamePages]
}
