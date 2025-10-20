import { useMemo, useState } from 'react'
import Head from 'next/head'
import { getSession } from 'next-auth/react'
import CabinetLayout from '@components/cabinet/CabinetLayout'

const initialGames = [
  {
    id: 'game-1',
    title: 'Весенний забег',
    status: 'Черновик',
    startDate: '2024-04-18',
    teamsLimit: 12,
    isPublished: false,
    description:
      'Городская игра с заданиями в историческом центре. Включает 5 этапов и финальный пазл.',
  },
  {
    id: 'game-2',
    title: 'Ночная прогулка',
    status: 'Опубликована',
    startDate: '2024-05-04',
    teamsLimit: 8,
    isPublished: true,
    description:
      'Маршрут по неоновой части города. Задания построены на взаимодействии с подсветкой и витринами.',
  },
  {
    id: 'game-3',
    title: 'Квест для новичков',
    status: 'В подготовке',
    startDate: '2024-05-20',
    teamsLimit: 16,
    isPublished: false,
    description:
      'Серия из трёх ознакомительных сценариев. Отлично подходит для корпоративных команд.',
  },
]

const statusOptions = ['Черновик', 'В подготовке', 'Опубликована', 'Завершена']

const GamesPage = () => {
  const [games, setGames] = useState(initialGames)
  const [selectedGameId, setSelectedGameId] = useState(initialGames[0].id)

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId),
    [games, selectedGameId]
  )

  const updateSelectedGame = (field, value) => {
    setGames((prevGames) =>
      prevGames.map((game) =>
        game.id === selectedGameId
          ? {
              ...game,
              [field]: value,
            }
          : game
      )
    )
  }

  const addNewGame = () => {
    const newGame = {
      id: `game-${Date.now()}`,
      title: 'Новая игра',
      status: 'Черновик',
      startDate: new Date().toISOString().slice(0, 10),
      teamsLimit: 10,
      isPublished: false,
      description: 'Опишите детали сценария и этапы прохождения.',
    }

    setGames((prevGames) => [newGame, ...prevGames])
    setSelectedGameId(newGame.id)
  }

  return (
    <>
      <Head>
        <title>ActQuest — Игры</title>
      </Head>
      <CabinetLayout
        title="Игры"
        description="Редактируйте сценарии, управляйте статусами и готовьте квесты к запуску."
        activePage="games"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2 space-y-4">
            <button
              type="button"
              onClick={addNewGame}
              className="flex items-center justify-center w-full px-4 py-3 text-sm font-semibold text-white transition bg-primary rounded-2xl hover:bg-blue-700"
            >
              Добавить игру
            </button>

            <ul className="space-y-3">
              {games.map((game) => (
                <li key={game.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedGameId(game.id)}
                    className={`w-full text-left p-4 border rounded-2xl transition hover:border-primary hover:bg-blue-50 ${
                      selectedGameId === game.id
                        ? 'border-primary bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-sm font-semibold text-primary">{game.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{game.status}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Старт: {new Date(game.startDate).toLocaleDateString('ru-RU')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            {selectedGame ? (
              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
                <div>
                  <label htmlFor="game-title" className="text-sm font-semibold text-primary">
                    Название игры
                  </label>
                  <input
                    id="game-title"
                    type="text"
                    value={selectedGame.title}
                    onChange={(event) => updateSelectedGame('title', event.target.value)}
                    className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="game-status" className="text-sm font-semibold text-primary">
                      Статус
                    </label>
                    <select
                      id="game-status"
                      value={selectedGame.status}
                      onChange={(event) => updateSelectedGame('status', event.target.value)}
                      className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="game-date" className="text-sm font-semibold text-primary">
                      Дата старта
                    </label>
                    <input
                      id="game-date"
                      type="date"
                      value={selectedGame.startDate}
                      onChange={(event) => updateSelectedGame('startDate', event.target.value)}
                      className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="game-limit" className="text-sm font-semibold text-primary">
                      Лимит команд
                    </label>
                    <input
                      id="game-limit"
                      type="number"
                      min="1"
                      value={selectedGame.teamsLimit}
                      onChange={(event) => updateSelectedGame('teamsLimit', Number(event.target.value))}
                      className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 mt-6 md:mt-[34px]">
                    <input
                      id="game-published"
                      type="checkbox"
                      checked={selectedGame.isPublished}
                      onChange={(event) => updateSelectedGame('isPublished', event.target.checked)}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="game-published" className="text-sm text-slate-600">
                      Игра опубликована
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="game-description" className="text-sm font-semibold text-primary">
                    Описание сценария
                  </label>
                  <textarea
                    id="game-description"
                    value={selectedGame.description}
                    onChange={(event) => updateSelectedGame('description', event.target.value)}
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
                    className="inline-flex justify-center px-5 py-3 text-sm font-semibold text-primary border border-primary rounded-xl hover:bg-blue-50"
                  >
                    Просмотреть предварительно
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-white border border-dashed rounded-2xl border-slate-200">
                <p className="text-sm text-slate-500">Выберите игру из списка слева, чтобы начать редактирование.</p>
              </div>
            )}
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSession(context)

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  return {
    props: {},
  }
}

export default GamesPage
