import { notFound } from 'next/navigation'

import LegacyGameResultPage from '@app/[location]/game/result/[id]/page'
import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'
import { getCityPageByLocationKey } from '@app/_lib/cityLandingPages'
import { seoArticles } from '@app/_lib/seoArticles'
import SeoActionLink from '@components/public/seo/SeoActionLink'
import SeoSectionCard from '@components/public/seo/SeoSectionCard'
import fetchGame from '@server/fetchGame'

export const dynamic = 'force-dynamic'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id
  if (typeof gameId !== 'string') return {}

  try {
    const { location } = await resolveGameLocationById(gameId)
    if (!location) return {}

    const game = await fetchGame(location, gameId)
    if (!game?.name) return {}

    const title = `Результаты: ${game.name}`
    const description = `Результаты автоквеста «${game.name}» — места команд, время прохождения, статистика.`
    const canonicalPath = `/game/${gameId}/result`
    const images = game.image ? [{ url: game.image, alt: game.name }] : []

    return {
      title,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title,
        description,
        url: `${siteUrl}${canonicalPath}`,
        type: 'article',
        locale: 'ru_RU',
        siteName: 'ActQuest',
        ...(images.length > 0 ? { images } : {}),
      },
      twitter: {
        title,
        description,
        card: 'summary_large_image',
        ...(images.length > 0 ? { images: [game.image] } : {}),
      },
    }
  } catch {
    return {}
  }
}

export default async function GameResultPage({ params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.id

  if (typeof gameId !== 'string') {
    notFound()
  }

  const { location } = await resolveGameLocationById(gameId)
  if (!location) {
    notFound()
  }

  const game = await fetchGame(location, gameId)
  if (!game?.name) {
    notFound()
  }

  const cityPage = getCityPageByLocationKey(location)
  const cityArticles = cityPage
    ? seoArticles
        .filter((article) => article.citySlug === cityPage.slug)
        .slice(0, 3)
    : []

  const resultJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: game.name,
    eventStatus: 'https://schema.org/EventCompleted',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: `${siteUrl}/game/${gameId}/result`,
    organizer: {
      '@type': 'Organization',
      name: 'ActQuest',
      url: siteUrl,
    },
    location: cityPage
      ? {
          '@type': 'Place',
          name: cityPage.cityName,
        }
      : undefined,
    description: `Результаты автоквеста «${game.name}» на платформе ActQuest.`,
  }

  const resultBreadcrumbsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: `${siteUrl}/`,
      },
      ...(cityPage
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: cityPage.cityName,
              item: `${siteUrl}/${cityPage.slug}`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: `Результаты: ${game.name}`,
              item: `${siteUrl}/game/${gameId}/result`,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 2,
              name: `Результаты: ${game.name}`,
              item: `${siteUrl}/game/${gameId}/result`,
            },
          ]),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resultJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(resultBreadcrumbsJsonLd),
        }}
      />
      <div className="sr-only" aria-hidden="false">
        <h1>Результаты автоквеста: {game.name}</h1>
        <p>
          Страница с итогами игры: места команд, статистика прохождения и
          результаты участников.
        </p>
        {cityPage ? (
          <p>
            Игра относится к городу{' '}
            <a href={`/${cityPage.slug}`}>{cityPage.cityName}</a>.
          </p>
        ) : null}
        <a href="/articles">Полезные статьи по автоквестам</a>
        {cityArticles.map((article) => (
          <a key={article.slug} href={`/articles/${article.slug}`}>
            {article.title}
          </a>
        ))}
      </div>
      <LegacyGameResultPage params={{ id: gameId, location }} />
      {cityPage || cityArticles.length > 0 ? (
        <section className="mx-auto mt-6 w-full max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
          <SeoSectionCard title="Полезные ссылки по игре" titleClassName="text-sm sm:text-base">
            <div className="mt-2 flex flex-wrap gap-2">
              {cityPage ? (
                <SeoActionLink href={`/${cityPage.slug}`} variant="ghost" className="text-xs">
                  Автоквесты в {cityPage.cityName}
                </SeoActionLink>
              ) : null}
              <SeoActionLink href="/articles" variant="secondary" className="text-xs">
                Гайды и статьи
              </SeoActionLink>
              {cityArticles.map((article) => (
                <SeoActionLink
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  variant="ghost"
                  className="text-xs"
                >
                  {article.title}
                </SeoActionLink>
              ))}
            </div>
          </SeoSectionCard>
        </section>
      ) : null}
    </>
  )
}
