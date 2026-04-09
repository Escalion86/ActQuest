const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/cabinet/', '/legacy/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
