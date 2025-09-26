import executeCommand from '@server/executeCommand'
// import fetchGame from '@server/fetchGame'
// import fetchGameTeamByGameIdAndTeamId from '@server/fetchGameTeamByGameIdAndTeamId'
// import fetchTeam from '@server/fetchTeam'
// import gameProcess from '@server/gameProcess'
// import gameStart from '@server/gameStart'
import dbConnect from '@utils/dbConnect'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'

const commands = [
  'setUserName',
  'setTeamName',
  'setTeamDesc',
  'createTeam',
  'menuTeams',
  'mainMenu',
  'editTeam',
  'menuUser',
  'delTeam',
  'joinTeam',
  'joinedTeams',
  'teamUsers',
  'linkToJoinTeam',
  'teamUser',
  'delTeamUser',
  'menuGames',
  'createGame',
  'menuGamesEdit',
  'editGame',
  'delGame',
  'setGameDesc',
  'setGameName',
  'gameTeams',
  'gameTeam',
  'delGameTeam',
  'game',
  'joinGame',
  'gameTasksEdit',
  'hideGame',
  'unhideGame',
  'unjoinTeam',
  'setGameDate',
  'createTask',
  'editTask',
  'setGameImage',
  'setTaskT',
  'setTaskN',
  'delTask',
  'delTaskClue',
  'editTaskClue',
  'setCodes',
  'setTaskI',
  'teams',
  'teamUsersAdmin',
  'teamUserAdmin',
  'delTeamUserAdmin',
  'delTeamAdmin',
  'editTeamAdmin',
  'joinGameAdmin',
  'teamGamesAdmin',
  'userAdmin',
  'users',
  'userJoinToTeam',
  'gameStart',
  'gameStop',
  'gameProcess',
  'gameActive',
  'setCNum',
  'gameResult',
  'gameStatus',
  'gameMsg',
  'setTaskDuration',
  'setBreakDuration',
  'setCluesDuration',
  'setTaskPenalty',
  'transferCaptainRights',
  'archiveGames',
  'gameAnonsMsg',
  'gameResultForm',
  'setGameIndividualStart',
  'editPenaltyCodes',
  'editPenaltyCode',
  'setPenaltyCodeCode',
  'setPenaltyCodePenalty',
  'setPenaltyCodeDescription',
  'addPenaltyCode',
  'editBonusCodes',
  'editBonusCode',
  'setBonusCodeCode',
  'setBonusCodeBonus',
  'setBonusCodeDescription',
  'addBonusCode',
  'setTaskPostMessage',
  'setGameFinishingPlace',
  'setGameStartingPlace',
  'allUsers',
  'adminMenu',
  'delTeamUserAdmin2',
  'gameResultShow',
  'gameResultHide',
  'checkGameTeamsDoubles',
  'sendMessageToAll',
  'gameAddings',
  'gameTeamAddings',
  'delGameTeamAddingBonus',
  'addGameTeamAddingBonus',
  'joinToGameWithCode',
  'setManyCodesPenalty',
  'gameResultAdminBack',
  'gameTeamAdmin',
  'gameTeamsAdmin',
  'addGameTeamAddingPenalty',
  'delGameTeamAddingPenalty',
  'editGameGeneral',
  'selectTeamToJoinGameAdmin',
  'delGameTeamAdmin',
  'setGameType',
  'editTaskClues',
  'addTaskClue',
  'editTaskCoordinates',
  'setTaskCoordinateLatitude',
  'setTaskCoordinateLongitude',
  'setTaskCoordinateRadius',
  'archiveGamesEdit',
  'editGamePrices',
  'editGameFinances',
  'editGamePrice',
  'addGamePrice',
  'addGameFinance',
  'setGamePriceName',
  'setGamePricePrice',
  'setBonusForTaskComplite',
  'addSubTask',
  'editSubTasks',
  'editSubTask',
  'setSubTaskName',
  'setSubTaskTask',
  'setSubTaskBonus',
  'gameTeamsCheckPhotos',
  'gameTeamCheckPhotos',
  'gameTeamCheckPhotosInTask',
  'gamePhotos',
  'gameTeamPhotos',
  'gameTeamPayments',
  'usersStatistics',
  'gameResultFormTeamsPlaces',
  'cancelTask',
  'uncancelTask',
  'gameTeamResult',
  'gameTeamsResult',
  'gameTasksView',
  'gameTaskView',
  'gameTasksHide',
  'gameTasksShow',
  'cancelGame',
  'settings',
  'settingsSetChatUrl',
]

function GameProcessPage(props) {
  // const gameId = props.id
  // const teamId = props.teamId
  // const location = props.location
  const error = props.error
  const { location, result, user } = props
  const [input, setInput] = useState('')

  const buttons = result?.keyboard?.inline_keyboard
    ? result?.keyboard?.inline_keyboard
    : undefined

  const router = useRouter()

  console.log('buttons :>> ', buttons)

  return (
    <>
      <Head>
        <title>{`ActQuest - Игра`}</title>
      </Head>
      {/* <div className="flex justify-center w-full">Игра: {game.name}</div> */}
      {/* <div className="flex justify-center w-full">Команда: {team.name}</div> */}
      <div
        className="w-full"
        dangerouslySetInnerHTML={{
          __html: result?.text.replaceAll('\n', '<br />'),
        }}
      />
      <div className="flex justify-center">
        <div className="flex flex-col items-center gap-1 phoneV:w-full px-1 phoneH:w-[400px] tablet:w-[500px]">
          {buttons?.map((array, index) => {
            return (
              <div className="flex w-full gap-1" key={index}>
                {array.map(({ text, callback_data, url }, index) => {
                  // const callback_data_prepared =
                  //   commands[
                  //     typeof JSON.parse(callback_data)?.c === 'number'
                  //       ? JSON.parse(callback_data).c
                  //       : 5
                  //   ]

                  return (
                    <a
                      className="flex-1 px-2 py-1 text-sm text-center duration-300 border border-gray-600 rounded cursor-pointer hover:bg-blue-200"
                      href={url || `/${location}/control/${callback_data}`}
                      key={callback_data}
                    >
                      {text}
                    </a>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex justify-center w-full pb-5 mt-1 gap-x-1">
        Сообщение:
        <input
          className="border border-gray-600 rounded"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={() => {
            router.push(
              `/${location}/control/${JSON.stringify({
                message: input,
              })}`
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

  const { params } = context
  const { id, location, jsonCommand } = params

  // const game = await fetchGame(location, id)

  const db = await dbConnect(location)
  if (!db) return {}

  // const result = await gameStart({ jsonCommand, location, db })
  const user = await db.model('Users').findOne({ telegramId: 261102161 }).lean()

  let cmd
  try {
    cmd = JSON.parse(jsonCommand)
  } catch (error) {
    cmd = { c: jsonCommand }
  }

  const lastCmd = await db
    .model('LastCommands')
    .findOne({
      userTelegramId: 261102161,
    })
    .lean()

  if (lastCmd) cmd = { ...lastCmd.command, ...cmd }
  console.log('cmd :>> ', cmd)
  // console.log('jsonCommand :>> ', jsonCommand)
  const result = await executeCommand({
    userTelegramId: user.telegramId,
    jsonCommand: cmd,
    // messageId,
    // callback_query,
    location,
    user,
    db,
    lastCommand: last,
  })
  // const result = await fetch(
  //   `http://localhost:3000/api/${location}/gamesteams/process/${gameTeam._id}`
  // )
  // console.log('!!!result :>> ', result)
  // console.log('result :>> ', result)
  // const fetchedProps = await fetchProps(session?.user)
  // const json = await result.json()

  return {
    props: {
      // ...fetchedProps,
      // id,
      location,
      // team: JSON.parse(JSON.stringify(team)),
      // game: JSON.parse(JSON.stringify(game)),
      // gameTeam: JSON.parse(JSON.stringify(gameTeam)),
      result: JSON.parse(JSON.stringify(result)),
      // loggedUser: session?.user ?? null,
      user: JSON.parse(JSON.stringify(user)),
    },
  }
}
