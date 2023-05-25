import GamesTeams from '@models/GamesTeams'
import check from 'telegram/func/check'
import getGameTeam from 'telegram/func/getGameTeam'

const detach_game_team = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите отмену регистрации команды из игры',
      buttons: [
        {
          text: '\u{1F4A3} Отменить регистрацию команды из игры',
          cmd: { confirm: true },
        },
        { text: '\u{1F6AB} Я передумал', cmd: 'menu_games_edit' },
      ],
    }
  }

  await GamesTeams.findByIdAndDelete(jsonCommand.gameTeamId)
  return {
    success: true,
    message: 'Команда удалена из игры',
    nextCommand: `menu_games_edit`,
  }
}

export default detach_game_team
