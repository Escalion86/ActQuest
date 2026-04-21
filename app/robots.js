import getSiteUrl from '@helpers/getSiteUrl'

const siteUrl = getSiteUrl()

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/cabinet/', '/legacy/'],
      },
    ],
    host: siteUrl,
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
