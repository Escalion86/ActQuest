import fetchGame from '@server/fetchGame'
import fetchGameTeamByGameIdAndTeamId from '@server/fetchGameTeamByGameIdAndTeamId'
import fetchTeam from '@server/fetchTeam'
import gameProcess from '@server/gameProcess'
import dbConnect from '@utils/dbConnect'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'

function GameProcessPage(props) {
  // const gameId = props.id
  // const teamId = props.teamId
  // const location = props.location
  const error = props.error
  const { location, team, game, gameTeam, result } = props
  const [input, setInput] = useState('')

  const router = useRouter()
  return (
    <>
      <Head>
        <title>{`ActQuest - Игра`}</title>
      </Head>
      <div className="flex justify-center w-full">Игра: {game.name}</div>
      <div className="flex justify-center w-full">Команда: {team.name}</div>
      <div
        className="w-full"
        dangerouslySetInnerHTML={{
          __html: result?.message.replaceAll('\n', '<br />'),
        }}
      />
      <a
        className="flex-1 px-2 py-1 text-sm text-center duration-300 border border-gray-600 rounded cursor-pointer hover:bg-blue-200"
        href={`/${location}/game/${game._id}/${team._id}`}
      >
        Обновить
      </a>
      {/* <div className="flex justify-center w-full">{result?.message}</div> */}
      <div className="flex justify-center w-full pb-5 mt-1 gap-x-1">
        Сообщение:
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={() => {
            router.push(
              `/${location}/game/${game._id}/${team._id}?message=${input}`
            )
          }}
        >
          Отправить
        </button>
      </div>
    </>
  )
}

export default GameProcessPage

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params, query } = context
  const { id, location, teamId } = params
  const { message } = query

  const game = await fetchGame(location, id)
  const team = await fetchTeam(location, teamId)

  const db = await dbConnect(location)
  if (!db) return {}

  const gameTeam = await db
    .model('GamesTeams')
    .findOne({ gameId: id, teamId })
    .lean()

  const teamUserCapitan = await db
    .model('TeamsUsers')
    .findOne({ teamId, role: 'capitan' })
    .lean()

  const capitanTelegramId = teamUserCapitan.userTelegramId

  let cmd = {
    gameTeamId: String(gameTeam._id),
    message: message === 'undefined' ? undefined : message,
  }
  console.log('cmd :>> ', cmd)

  const result = await gameProcess({
    telegramId: capitanTelegramId,
    jsonCommand: cmd,
    location,
    db,
  })
  // const result = await fetch(
  //   `http://localhost:3000/api/${location}/gamesteams/process/${gameTeam._id}`
  // )

  // console.log('result :>> ', result)
  // const fetchedProps = await fetchProps(session?.user)
  // const json = await result.json()

  return {
    props: {
      // ...fetchedProps,
      // id,
      location,
      team: JSON.parse(JSON.stringify(team)),
      game: JSON.parse(JSON.stringify(game)),
      gameTeam: JSON.parse(JSON.stringify(gameTeam)),
      result: JSON.parse(JSON.stringify(result)),
      // loggedUser: session?.user ?? null,
    },
  }
}
