import Link from 'next/link'

import GameReviewCard from '@components/location-game/GameReviewCard'

export const metadata = {
  title: 'ActQuest — оценка игры',
}

export default async function GameReviewPage({ params }) {
  const { id, location } = await params
  const gameId = String(id || '')
  const gameLocation = String(location || '')
  const encodedGameId = encodeURIComponent(gameId)
  const encodedLocation = encodeURIComponent(gameLocation)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <Link
          href="/cabinet/games-past"
          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-200"
        >
          ← К сыгранным играм
        </Link>
        <Link
          href={`/${encodedLocation}/game/result/${encodedGameId}`}
          className="inline-flex items-center rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
        >
          Посмотреть результаты
        </Link>
      </div>

      <GameReviewCard gameId={gameId} location={gameLocation} />
    </main>
  )
}
