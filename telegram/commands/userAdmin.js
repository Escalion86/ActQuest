import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const userAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['userTId'])
  if (checkData) return checkData

  await dbConnect()
  const user = await Users.find({ telegramId: jsonCommand.userTId })

  return {
    message: '<b>Обзор пользователей без команды</b>',
    buttons: [
      ...usersWithNoTeam.map((user) => {
        return {
          text: '\u{1F517} Записать в команду',
          c: {
            c: 'userJoinToTeam',
            userTId: jsonCommand.userTId,
          },
        }
      }),
      {
        c: 'users',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default userAdmin
