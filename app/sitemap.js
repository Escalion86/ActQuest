import dbConnectGlobal from '@utils/dbConnectGlobal'
import { cityPagesList } from '@app/_lib/cityLandingPages'
import { seoArticles } from '@app/_lib/seoArticles'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export default async function sitemap() {
  const now = new Date()
  const staticPages = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...cityPagesList.map((cityPage) => ({
      url: `${siteUrl}/${cityPage.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    })),
    {
      url: `${siteUrl}/articles`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...seoArticles.map((article) => ({
      url: `${siteUrl}/articles/${article.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    })),
  ]

  let resultPages = []

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
          { _id: 1, updatedAt: 1, status: 1 },
        )
        .sort({ dateStart: -1 })
        .limit(500)
        .lean()

      resultPages = games
        .filter((game) => game?.status === 'finished' || game?.status === 'closed')
        .map((game) => ({
          url: `${siteUrl}/game/${game._id}/result`,
          lastModified: game.updatedAt || undefined,
          changeFrequency: 'weekly',
          priority: 0.6,
        }))
    }
  } catch (error) {
    console.error('Sitemap generation error:', error)
  }

  return [...staticPages, ...resultPages]
}
