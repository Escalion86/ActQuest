import { useMemo, useState } from 'react'
import Head from 'next/head'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import getSessionSafe from '@helpers/getSessionSafe'

const initialTeams = [
  {
    id: 'team-1',
    name: 'Северный свет',
    captain: 'Анна Петрова',
    participants: 6,
    game: 'Ночная прогулка',
    notes: 'Готовы стартовать в любое время после 20:00.',
  },
  {
    id: 'team-2',
    name: 'Городские исследователи',
    captain: 'Максим Фёдоров',
    participants: 5,
    game: 'Весенний забег',
    notes: 'Нужна дополнительная карта для новичков.',
  },
  {
    id: 'team-3',
    name: 'Точка сборки',
    captain: 'Елена Лебедева',
    participants: 7,
    game: 'Квест для новичков',
    notes: 'Участники просят добавить фотоинструкции.',
  },
]

const TeamsPage = () => {
  const [teams, setTeams] = useState(initialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeams[0].id)

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId),
    [teams, selectedTeamId]
  )

  const updateSelectedTeam = (field, value) => {
    setTeams((prevTeams) =>
      prevTeams.map((team) =>
        team.id === selectedTeamId
          ? {
              ...team,
              [field]: value,
            }
          : team
      )
    )
  }

  const removeSelectedTeam = () => {
    setTeams((prevTeams) => prevTeams.filter((team) => team.id !== selectedTeamId))
    setSelectedTeamId((prevId) => {
      if (prevId === selectedTeamId) {
        return teams.find((team) => team.id !== selectedTeamId)?.id ?? null
      }

      return prevId
    })
  }

  return (
    <>
      <Head>
        <title>ActQuest — Мои команды</title>
      </Head>
      <CabinetLayout
        title="Мои команды"
        description="Управляйте составом, отправляйте приглашения и отслеживайте прогресс участников."
        activePage="teams"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2">
            <ul className="space-y-3">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`w-full text-left p-4 border rounded-2xl transition hover:border-primary hover:bg-blue-50 ${
                      selectedTeamId === team.id
                        ? 'border-primary bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-sm font-semibold text-primary">{team.name}</p>
                    <p className="mt-1 text-xs text-slate-500">Капитан: {team.captain}</p>
                    <p className="mt-1 text-xs text-slate-400">Игра: {team.game}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            {selectedTeam ? (
              <div className="p-6 space-y-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div>
                  <label htmlFor="team-name" className="text-sm font-semibold text-primary">
                    Название команды
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={selectedTeam.name}
                    onChange={(event) => updateSelectedTeam('name', event.target.value)}
                    className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="team-captain" className="text-sm font-semibold text-primary">
                      Капитан
                    </label>
                    <input
                      id="team-captain"
                      type="text"
                      value={selectedTeam.captain}
                      onChange={(event) => updateSelectedTeam('captain', event.target.value)}
                      className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="team-members" className="text-sm font-semibold text-primary">
                      Участников
                    </label>
                    <input
                      id="team-members"
                      type="number"
                      min="1"
                      value={selectedTeam.participants}
                      onChange={(event) => updateSelectedTeam('participants', Number(event.target.value))}
                      className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="team-game" className="text-sm font-semibold text-primary">
                    Игра
                  </label>
                  <input
                    id="team-game"
                    type="text"
                    value={selectedTeam.game}
                    onChange={(event) => updateSelectedTeam('game', event.target.value)}
                    className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="team-notes" className="text-sm font-semibold text-primary">
                    Заметки
                  </label>
                  <textarea
                    id="team-notes"
                    value={selectedTeam.notes}
                    onChange={(event) => updateSelectedTeam('notes', event.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    type="button"
                    className="inline-flex justify-center px-5 py-3 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
                  >
                    Сохранить изменения
                  </button>
                  <button
                    type="button"
                    onClick={removeSelectedTeam}
                    className="inline-flex justify-center px-5 py-3 text-sm font-semibold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50"
                  >
                    Удалить команду
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-white border border-dashed rounded-2xl border-slate-200">
                <p className="text-sm text-slate-500">Выберите команду, чтобы просмотреть состав и контактные данные.</p>
              </div>
            )}
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/teams'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  return {
    props: {
      session,
    },
  }
}

export default TeamsPage
