import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import { MAX_TEAMS } from 'telegram/constants'

const teams = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const teams = await Teams.find({})

  return {
    message: '<b>Обзор всех команд</b>',
    buttons: [
      ...teams.map((team) => {
        return {
          text: `"${team.name}"`,
          cmd: { cmd: 'teamUsers', teamId: team._id, backСmd: 'teams' },
        }
      }),
      {
        cmd: 'mainMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default teams
