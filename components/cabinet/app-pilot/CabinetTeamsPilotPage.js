import PropTypes from 'prop-types'
import Link from 'next/link'

const getTeamVisibilityLabel = (isOpen) => (isOpen ? 'Открыта' : 'Закрыта')

const CabinetTeamsPilotPage = ({ teams }) => {
  return (
    <main className="min-h-screen bg-[#0B001A] p-6 text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-2xl border border-[#00D1FF]/25 bg-[#090018]/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#00D1FF]">
            App Router Pilot
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Мои команды</h1>
          <p className="mt-2 text-sm text-slate-300">
            Пилотный read-only маршрут команд в app router.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/cabinet/teams"
              className="rounded-xl border border-[#00D1FF]/35 bg-[#00D1FF]/10 px-4 py-2 text-sm font-semibold text-[#bdf4ff]"
            >
              Открыть текущую pages-версию
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
          {teams.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-[#0a1632]/80 p-5 text-sm text-slate-300">
              Вы пока не состоите ни в одной команде.
            </div>
          ) : (
            teams.map((team) => (
              <article
                key={team.id}
                className="rounded-2xl border border-slate-700 bg-[#0a1632]/80 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">
                      {team.name || 'Без названия'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {getTeamVisibilityLabel(Boolean(team.open))}
                    </p>
                  </div>
                  {team?.captain?.name ? (
                    <span className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                      Капитан: {team.captain.name}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Участников: {Number(team.membersCount) || 0}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Сыграно игр: {Number(team.gamesCount) || 0}
                </p>
                {team?.description ? (
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-slate-300">
                    {team.description}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

CabinetTeamsPilotPage.propTypes = {
  teams: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      open: PropTypes.bool,
      membersCount: PropTypes.number,
      gamesCount: PropTypes.number,
      description: PropTypes.string,
      captain: PropTypes.shape({
        name: PropTypes.string,
      }),
    }),
  ),
}

CabinetTeamsPilotPage.defaultProps = {
  teams: [],
}

export default CabinetTeamsPilotPage

