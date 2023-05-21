import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const edit_team = async ({ telegramId, message, props }) => {
  if (!message) {
    await dbConnect()
    const teamsOfUser = await Teams.find({ capitanId: userId })
    return {
      message: 'Выберите команду для редактирования',
      buttonText: '\u{270F}  Редактирование команд',
      upper_command: 'menu_teams',
      buttons: [
        ...teamsOfUser.map((team) => ({
          text: `"${team.name}"`,
          command: `edit_team/teamId=${team._id}`,
        })),
        { command: 'menu_teams', text: '\u{2B05} Назад' },
      ],
    }
  }

  if (props?.teamId)
    return {
      message: `Редактирование команды"${(await getTeam(props.teamId))?.name}"`,
      upper_command: 'menu_teams',
      buttons: [
        {
          command: `set_team_name/teamId=${props.teamId}`,
          text: '\u{270F} Изменить название',
        },
        {
          command: `set_team_description/teamId=${props.teamId}`,
          text: '\u{270F} Изменить описание',
        },
        {
          command: `delete_team/teamId=${props.teamId}`,
          text: '\u{1F4A3} Удалить команду',
        },
        { command: 'edit_team', text: '\u{2B05} Назад' },
      ],
    }

  return {
    success: true,
    message: 'Меню работы с командами',
    buttonText: 'Команды',
    upper_command: 'main_menu',
    buttons: [
      'create_team',
      'edit_team',
      'join_team',
      { command: 'main_menu', text: '\u{2B05} Главное меню' },
    ],
  }
}

export default edit_team
