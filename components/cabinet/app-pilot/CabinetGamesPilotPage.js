import Link from 'next/link'
import getGameStatusLabel from '@helpers/getGameStatusLabel'

const formatDateTime = (value) => {
  if (!value) {
    return 'Дата не задана'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Дата не задана'
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getGameCardTone = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'active') return 'border-cyan-500/40'
  if (normalized === 'started') return 'border-emerald-500/40'
  if (normalized === 'finished') return 'border-violet-500/40'
  if (normalized === 'closed') return 'border-indigo-500/40'
  if (normalized === 'canceled') return 'border-rose-500/40'
  return 'border-slate-500/30'
}

const CabinetGamesPilotPage = ({
  title,
  games,
  pagesPath,
  pagesLinkLabel,
  emptyLabel,
}) => {
  return (
    <main className="min-h-screen bg-[#0B001A] p-6 text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-2xl border border-[#00D1FF]/25 bg-[#090018]/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#00D1FF]">
            App Router Pilot
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-slate-300">
            Пилотный маршрут app router. Основной интерфейс остается в
            `pages`.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={pagesPath}
              className="rounded-xl border border-[#00D1FF]/35 bg-[#00D1FF]/10 px-4 py-2 text-sm font-semibold text-[#bdf4ff]"
            >
              {pagesLinkLabel}
            </Link>
            <Link
              href="/migration-check"
              className="rounded-xl border border-[#7A00FF]/35 bg-[#7A00FF]/10 px-4 py-2 text-sm font-semibold text-[#e3d7ff]"
            >
              Migration Check
            </Link>
          </div>
        </header>

        <section className="space-y-3">
          {games.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-[#0a1632]/80 p-5 text-sm text-slate-300">
              {emptyLabel}
            </div>
          ) : (
            games.map((game) => (
              <article
                key={game.id}
                className={`rounded-2xl border bg-[#0a1632]/80 p-5 ${getGameCardTone(
                  game.status,
                )}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    {game.name || 'Без названия'}
                  </h2>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200">
                    {getGameStatusLabel(game.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Дата старта: {formatDateTime(game.dateStart)}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Команд: {Number(game.teamsCount) || 0}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

export default CabinetGamesPilotPage

