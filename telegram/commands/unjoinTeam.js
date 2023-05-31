import TeamsUsers from '@models/TeamsUsers'
import check from 'telegram/func/check'

const unjoinTeam = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const teamUser = await TeamsUsers.findOne({
    userTelegramId: telegramId,
    teamId: jsonCommand.teamId,
  })
  if (teamUser.success === false) return teamUser

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите что вы действительно хотите покинуть команду',
      buttons: [
        {
          text: '\u{1F4A3} Выйти из команды',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'editTeam', teamId: jsonCommand.teamId },
        },
      ],
    }
  }

  await TeamsUsers.findOneAndDelete({
    userTelegramId: telegramId,
    teamId: jsonCommand.teamId,
  })
  return {
    success: true,
    message: 'Вы покинули команду',
    nextCommand: { c: 'joinedTeams' },
  }
}

export default unjoinTeam
