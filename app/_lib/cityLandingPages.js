import Link from 'next/link'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'
import { seoArticles } from '@app/_lib/seoArticles'
import SeoActionLink from '@components/public/seo/SeoActionLink'
import SeoContactsInfo from '@components/public/seo/SeoContactsInfo'
import SeoFaqItems from '@components/public/seo/SeoFaqItems'
import SeoLinksList from '@components/public/seo/SeoLinksList'
import SeoSectionCard from '@components/public/seo/SeoSectionCard'
import SeoTextSection from '@components/public/seo/SeoTextSection'
import { buildProjectBotCityStartLink } from '@helpers/telegramProjectChatConfig'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

const cityPages = {
  krasnoyarsk: {
    slug: 'krasnoyarsk',
    locationKey: 'krsk',
    businessName: 'ActQuest Красноярск',
    cityName: 'Красноярск',
    cityPrep: 'Красноярске',
    cityAccusative: 'Красноярск',
    phone: '+79138370020',
    latitude: 56.0153,
    longitude: 92.8932,
    title: 'Автоквесты в Красноярске',
    shortOffer:
      'Ночные и дневные автоквесты для компаний, друзей и корпоративных команд в Красноярске.',
    faq: [
      {
        question: 'Сколько длится автоквест в Красноярске?',
        answer:
          'Обычно игра длится 2-4 часа в зависимости от формата и количества заданий.',
      },
      {
        question: 'Нужна ли специальная подготовка?',
        answer:
          'Нет, достаточно команды, автомобиля и желания соревноваться. Все правила выдаются перед стартом.',
      },
      {
        question: 'Можно ли заказать формат для корпоратива?',
        answer:
          'Да, доступны командные корпоративные сценарии с адаптацией под число участников и цели события.',
      },
    ],
  },
  norilsk: {
    slug: 'norilsk',
    locationKey: 'nrsk',
    businessName: 'ActQuest Норильск',
    cityName: 'Норильск',
    cityPrep: 'Норильске',
    cityAccusative: 'Норильск',
    phone: '+79134957500',
    latitude: 69.3558,
    longitude: 88.1893,
    title: 'Автоквесты в Норильске',
    shortOffer:
      'Городские автоквесты в Норильске: коды, задачи, маршруты и соревновательный формат для команд.',
    faq: [
      {
        question: 'Подходит ли автоквест для компании друзей?',
        answer:
          'Да, формат рассчитан на команды друзей, семейные компании и мини-турниры между несколькими экипажами.',
      },
      {
        question: 'Как формируется рейтинг команд?',
        answer:
          'Места определяются по правилам сценария: по времени прохождения или по сумме баллов в фото-формате.',
      },
      {
        question: 'Есть ли игры для новичков?',
        answer:
          'Да, в расписании есть сценарии с разной сложностью, включая комфортный вход для новых команд.',
      },
    ],
  },
  ekaterinburg: {
    slug: 'ekaterinburg',
    locationKey: 'ekb',
    businessName: 'ActQuest Екатеринбург',
    cityName: 'Екатеринбург',
    cityPrep: 'Екатеринбурге',
    cityAccusative: 'Екатеринбург',
    phone: '+79134957500',
    latitude: 56.8389,
    longitude: 60.6057,
    title: 'Автоквесты в Екатеринбурге',
    shortOffer:
      'Автоквесты в Екатеринбурге для тимбилдинга, свиданий и командных игр с рейтингом и результатами.',
    faq: [
      {
        question: 'Какой формат автоквеста выбрать в Екатеринбурге?',
        answer:
          'Для компаний чаще выбирают классический формат на время, для креативных команд и контент-игр подходит photo-формат.',
      },
      {
        question: 'Сколько человек в команде оптимально?',
        answer:
          'Оптимально 3-5 человек в экипаже, чтобы распределять роли: навигация, поиск кодов и проверка задач.',
      },
      {
        question: 'Можно ли участвовать без опыта?',
        answer:
          'Да, опыт не обязателен. Перед стартом команда получает вводные и понимает правила игры.',
      },
    ],
  },
}

export const cityPagesList = Object.values(cityPages)

export function getCityPageConfig(slug) {
  if (typeof slug !== 'string') return null
  return cityPages[slug] || null
}

export function getCityPageByLocationKey(locationKey) {
  if (typeof locationKey !== 'string') return null
  return cityPagesList.find((city) => city.locationKey === locationKey) || null
}

export function getCityPageMetadata(slug) {
  const city = getCityPageConfig(slug)
  if (!city) return {}

  const canonicalPath = `/${city.slug}`
  const title = city.title
  const description = `${city.shortOffer} Запишитесь на ближайшую игру в ${city.cityPrep}.`

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
      type: 'website',
      locale: 'ru_RU',
      siteName: 'ActQuest',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

async function getUpcomingGamesByLocation(locationKey) {
  if (typeof locationKey !== 'string' || !locationKey) return []

  try {
    const db = await dbConnectGlobal()
    if (!db) return []

    const now = new Date()
    const games = await db
      .model('Games')
      .find(
        {
          hidden: { $ne: true },
          status: { $in: ['active', 'started'] },
          dateStart: { $gte: now },
          location: locationKey,
        },
        {
          _id: 1,
          name: 1,
          dateStart: 1,
        },
      )
      .sort({ dateStart: 1 })
      .limit(6)
      .lean()

    return Array.isArray(games) ? games : []
  } catch {
    return []
  }
}

function buildCityJsonLd(city, upcomingGames) {
  const locationInfo = LOCATIONS[city.locationKey]
  const email = 'support@actquest.ru'
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: city.businessName || `ActQuest ${city.cityName}`,
    url: `${siteUrl}/${city.slug}`,
    logo: `${siteUrl}/logo_title.png`,
    areaServed: city.cityName,
    description: city.shortOffer,
    email,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: city.phone,
        contactType: 'customer support',
        areaServed: city.cityName,
        availableLanguage: ['ru'],
      },
    ],
  }

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: city.businessName || `ActQuest ${city.cityName}`,
    url: `${siteUrl}/${city.slug}`,
    telephone: city.phone,
    email,
    openingHours: 'Mo-Su 10:00-22:00',
    priceRange: 'RUB 500-2000',
    hasMap: `https://yandex.ru/maps/?pt=${city.longitude},${city.latitude}&z=11`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: city.latitude,
      longitude: city.longitude,
    },
    areaServed: {
      '@type': 'City',
      name: city.cityName,
    },
    serviceType: 'Автоквесты и городские командные игры',
    description: city.shortOffer,
  }

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: city.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  const events = upcomingGames
    .filter((game) => game?._id && game?.name && game?.dateStart)
    .map((game) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: game.name,
      startDate: new Date(game.dateStart).toISOString(),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      url: `${siteUrl}/game/${game._id}`,
      location: {
        '@type': 'Place',
        name: locationInfo?.towns?.[0] || city.cityName,
      },
      organizer: {
        '@type': 'Organization',
        name: 'ActQuest',
        url: siteUrl,
      },
    }))

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: `${siteUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: city.cityName,
        item: `${siteUrl}/${city.slug}`,
      },
    ],
  }

  return [organization, localBusiness, faq, breadcrumbs, ...events]
}

export async function CityLandingPage({ slug }) {
  const city = getCityPageConfig(slug)
  if (!city) return null

  const upcomingGames = await getUpcomingGamesByLocation(city.locationKey)
  const cityArticles = seoArticles
    .filter((article) => article.citySlug === city.slug)
    .slice(0, 3)
  const projectBotCityUrl = buildProjectBotCityStartLink(city.locationKey)
  const cityArticleLinks = cityArticles.map((article) => ({
    href: `/articles/${article.slug}`,
    label: article.title,
  }))
  const jsonLdItems = buildCityJsonLd(city, upcomingGames)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {jsonLdItems.map((item, index) => (
        <script
          key={`${city.slug}-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <SeoSectionCard
        title={city.title}
        description={city.shortOffer}
        titleClassName="text-xl sm:text-3xl"
      >
        <p className="text-[#b9d9ef]">
          ActQuest проводит автоквесты в {city.cityPrep}: команды решают
          городские задачи, ищут коды, соревнуются в таблице результатов и
          получают рейтинг по итогам игр.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <SeoActionLink href="/cabinet/login?mode=register" variant="primary">
            Записаться на игру
          </SeoActionLink>
          {projectBotCityUrl ? (
            <SeoActionLink href={projectBotCityUrl} variant="secondary">
              Чат проекта
            </SeoActionLink>
          ) : null}
          <SeoActionLink href="/" variant="ghost">
            На главную
          </SeoActionLink>
        </div>
      </SeoSectionCard>

      <SeoSectionCard title={`Как проходит автоквест в ${city.cityPrep}`}>
        <SeoTextSection
          ordered
          listItems={[
            'Соберите экипаж и зарегистрируйтесь на ближайшую игру.',
            'Получайте задания, находите точки и коды на маршруте.',
            'Выполняйте задачи быстрее и точнее других команд, чтобы занять место выше в таблице.',
          ]}
        />
      </SeoSectionCard>

      <SeoSectionCard title={`Ближайшие игры в ${city.cityAccusative}`}>
        {upcomingGames.length > 0 ? (
          <ul className="space-y-2 text-[#cbe8ff]">
            {upcomingGames.map((game) => (
              <li key={String(game._id)}>
                <Link
                  href={`/game/${game._id}`}
                  className="font-medium text-[#eaf7ff] underline decoration-[#00D1FF]/60 underline-offset-2 hover:text-white"
                >
                  {game.name}
                </Link>
                {game.dateStart ? (
                  <span className="ml-2 text-[#9cc7e5]">
                    {new Date(game.dateStart).toLocaleDateString('ru-RU')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#b9d9ef]">
            Сейчас нет опубликованных стартов. Оставьте заявку, и мы сообщим о
            ближайшей игре.
          </p>
        )}
      </SeoSectionCard>

      <SeoSectionCard title="FAQ">
        <SeoFaqItems items={city.faq} />
      </SeoSectionCard>

      <SeoSectionCard title="Контакты и условия">
        <SeoContactsInfo phone={city.phone} />
      </SeoSectionCard>

      <SeoSectionCard title="Полезные материалы по автоквестам">
        {cityArticles.length > 0 ? (
          <SeoLinksList items={cityArticleLinks} />
        ) : (
          <p className="text-[#b9d9ef]">
            Скоро здесь появятся разборы и гайды по играм в {city.cityPrep}.
          </p>
        )}
        <div className="mt-4">
          <SeoActionLink href="/articles" variant="secondary">
            Смотреть все статьи
          </SeoActionLink>
        </div>
      </SeoSectionCard>
    </main>
  )
}
