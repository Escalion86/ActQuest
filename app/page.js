import Index2PageClient from '@components/public/Index2PageClient'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export const metadata = {
  title: 'ActQuest — городские автоквесты',
}

async function getUpcomingGames() {
  try {
    const db = await dbConnectGlobal()
    if (!db) return []
    const gamesModel = db.model('Games')
    const now = new Date()
    const games = await gamesModel
      .find(
        {
          hidden: { $ne: true },
          status: { $in: ['active', 'started'] },
          dateStart: { $gte: now },
        },
        { name: 1, dateStart: 1, location: 1, image: 1 },
      )
      .sort({ dateStart: 1 })
      .limit(10)
      .lean()
    return games
  } catch {
    return []
  }
}

function buildJsonLd(upcomingGames) {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ActQuest',
    url: siteUrl,
    logo: `${siteUrl}/logo_title.png`,
    description:
      'Командные автоквесты по городу: разгадывайте загадки, ищите коды, соревнуйтесь с друзьями.',
  }

  const webSite = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ActQuest',
    url: siteUrl,
  }

  const events = upcomingGames
    .filter((g) => g.name && g.dateStart)
    .map((game) => {
      const loc = LOCATIONS[game.location]
      return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: game.name,
        startDate: new Date(game.dateStart).toISOString(),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        url: `${siteUrl}/game/${game._id}`,
        organizer: { '@type': 'Organization', name: 'ActQuest', url: siteUrl },
        ...(game.image && { image: game.image }),
        ...(loc && {
          location: {
            '@type': 'Place',
            name:
              loc.towns?.[0] ||
              (loc.townRu
                ? loc.townRu.charAt(0).toUpperCase() + loc.townRu.slice(1)
                : undefined),
          },
        }),
      }
    })

  return [organization, webSite, ...events]
}

export default async function HomePage() {
  const upcomingGames = await getUpcomingGames()
  const jsonLdItems = buildJsonLd(upcomingGames)
  const locationNames = Object.values(LOCATIONS)
    .filter((loc) => !loc.hidden)
    .map((loc) => loc.towns?.[0])
    .filter(Boolean)

  return (
    <>
      {jsonLdItems.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <div className="sr-only" aria-hidden="false">
        <h1>ActQuest — городские автоквесты</h1>
        <p>
          Командные автоквесты по городу: разгадывайте загадки, ищите коды,
          соревнуйтесь с друзьями. {locationNames.join(', ')}.
        </p>
        <h2>Как это работает</h2>
        <ol>
          <li>Собери команду и зарегистрируйся на игру</li>
          <li>Разгадывай загадки и ищи коды в городе</li>
          <li>Соревнуйся с другими командами</li>
          <li>Узнай город с новой стороны</li>
        </ol>
        {upcomingGames.length > 0 && (
          <>
            <h2>Ближайшие игры</h2>
            <ul>
              {upcomingGames.map((game) => (
                <li key={String(game._id)}>
                  <a href={`/game/${game._id}`}>{game.name}</a>
                  {game.dateStart && (
                    <>
                      {' '}
                      — {new Date(game.dateStart).toLocaleDateString('ru-RU')}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <a href="/cabinet/login?mode=register">Начать игру</a>
      </div>
      <Index2PageClient />
    </>
  )
}
