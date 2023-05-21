import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const joined_teams = async ({ telegramId, message, props }) => {
  if (!props?.teamId) {
    await dbConnect()
    const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })
    if (!teamsUser || teamsUser.length === 0) {
      return {
        message: 'Вы не состоите ни в какой команде',
        nextCommand: `/menu_teams`,
      }
    }
    console.log('teamsUser :>> ', teamsUser)
    // const teams =
    return {
      message: 'Тест',
      // buttonText: '\u{270F}  Редактирование команд',
      // upper_command: 'menu_teams',
      // buttons: [
      //   ...teamsOfUser.map((team) => ({
      //     text: `"${team.name}"`,
      //     command: `joined_teams/teamId=${team._id}`,
      //   })),
      //   { command: 'joined_teams', text: '\u{2B05} Назад' },
      // ],
    }
  }

  // const team = await getTeam(props.teamId)
  // return {
  //   message: `Редактирование команды "${team?.name}".${
  //     team?.description ? ` Описание: "${team?.description}"` : ''
  //   }`,
  //   upper_command: 'menu_teams',
  //   buttons: [
  //     {
  //       command: `set_team_name/teamId=${props.teamId}`,
  //       text: '\u{270F} Изменить название',
  //     },
  //     {
  //       command: `set_team_description/teamId=${props.teamId}`,
  //       text: '\u{270F} Изменить описание',
  //     },
  //     {
  //       command: `delete_team/teamId=${props.teamId}`,
  //       text: '\u{1F4A3} Удалить команду',
  //     },
  //     { command: 'edit_team', text: '\u{2B05} Назад' },
  //   ],
  // }
}

export default joined_teams
