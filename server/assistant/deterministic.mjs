import { FAQ_SOURCES } from './knowledge.mjs'

export function deterministicIntent(question) {
  if (/подробнее|подробности|описание игры/iu.test(question)) return 'details'
  if (/запис|регистр|хочу участвовать/iu.test(question)) return 'register'
  if (/ближайш|расписан/iu.test(question)) return 'schedule'
  return ({ 'Что такое автоквест?': 'about', 'Можно участвовать без команды?': 'no-team', 'Как подготовиться?': 'prepare', 'Как связаться с организатором?': 'organizer', 'Какие правила?': 'prepare', 'Что взять с собой?': 'prepare', 'Можно с ребёнком?': 'prepare', 'Что делать новичку?': 'prepare' })[question] || null
}
export function faqResponse(intent, publicData, selectedGameId) {
  const scheduling = ['schedule', 'register', 'details'].includes(intent)
  const safeSources = scheduling && publicData?.available ? (publicData.games || []).filter(s => /^\/game\/[a-f\d]{24}$/i.test(s.href)) : []
  const games = safeSources.map(s => ({ gameId: s.href.slice('/game/'.length), title: s.title, href: s.href }))
  const notice = scheduling && !publicData?.available ? 'Не удалось загрузить игры. Попробуйте позже или откройте ближайшие игры в кабинете.' : scheduling && !games.length ? 'Ближайших игр пока нет. Уточните расписание у организатора.' : null
  if (intent === 'details' && selectedGameId) {
    // Только точная игра из безопасных публичных источников выбранного города.
    const source = safeSources.find(s => s.href === `/game/${selectedGameId}`)
    return { success: true, mode: source ? 'faq' : 'no-data', answer: source ? source.text : publicData?.available ? 'Не удалось найти эту игру. Выберите другую из ближайших.' : 'Не удалось загрузить описание игры. Попробуйте позже.', links: source ? [{ title: 'Открыть игру', href: source.href }] : [{ title: 'Ближайшие игры', href: '/cabinet/games-upcoming' }], games: [] }
  }
  const source = FAQ_SOURCES.find(s => s.id === (intent === 'details' ? 'schedule' : intent))
  const answer = intent === 'details' ? 'Выберите игру, чтобы узнать подробности.' : source.text
  return { success: true, mode: scheduling && !publicData?.available ? 'no-data' : 'faq', answer, links: [{ title: source.title, href: source.href }], games, notice }
}
