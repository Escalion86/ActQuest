import LastCommands from '@models/LastCommands'
import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import sendMessage from './sendMessage'

const script = async ({ userTelegramId, command, text, keyboard }) => {
  if (command)
    await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      { command },
      { upsert: true }
    )
  else
    await LastCommands.findOneAndDelete({
      userTelegramId,
    })
  return await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text,
    keyboard,
  })
}

const sendError = async (userTelegramId) =>
  await sendMessage({
    chat_id: userTelegramId,
    text: 'Ошибка команды',
  })

const inlineKeyboard = (inline_keyboard) => ({
  inline_keyboard,
})

var keyboardCreateTeamSetName = inlineKeyboard([
  [
    {
      text: 'Отмена создания команды',
      callback_data: '/create_team/exit',
    },
  ],
])

var keyboardCreateTeamSetDescription = inlineKeyboard([
  [
    {
      text: 'Без описания',
      callback_data: '/create_team/no_description',
    },
  ],
  [
    {
      text: 'Отмена создания команды',
      callback_data: '/create_team/exit',
    },
  ],
])

var keyboardMainMenu = inlineKeyboard([
  [
    {
      text: 'Команды',
      callback_data: '/menu_teams',
    },
  ],
  [
    {
      text: 'Моя анкета',
      callback_data: '/menu_user',
    },
  ],
])

var keyboardTeamsMenu = inlineKeyboard([
  [
    {
      text: 'Создать новую команду',
      callback_data: '/create_team',
    },
  ],
  [
    {
      text: 'Редактировать команду',
      callback_data: '/edit_team',
    },
  ],
  [
    {
      text: 'Присоединиться к команде',
      callback_data: '/join_team',
    },
  ],
  [
    {
      text: '<= Вернуться в Главное меню',
      callback_data: '/main_menu',
    },
  ],
])

var keyboardUserMenu = inlineKeyboard([
  [
    {
      text: '<= Вернуться в Главное меню',
      callback_data: '/main_menu',
    },
  ],
])

const mainMenuScript = async (userTelegramId) =>
  await script({
    userTelegramId,
    text: `Главное меню`,
    keyboard: keyboardMainMenu,
  })

const teamsMenuScript = async (userTelegramId) =>
  await script({
    userTelegramId,
    text: `Меню работы с командами`,
    keyboard: keyboardTeamsMenu,
  })

const userMenuScript = async (userTelegramId) =>
  await script({
    userTelegramId,
    text: `Моя анкета`,
    keyboard: keyboardUserMenu,
  })

const getLastCommand = async (userTelegramId) => {
  await dbConnect()
  const lastCommand = await LastCommands.find({ userTelegramId })
  const isLastCommandExists = lastCommand && lastCommand.length !== 0
  if (!isLastCommandExists) return

  const lastCommandsArray = lastCommand[0].command.get('command').split('/')
  lastCommandsArray.shift()
  const mainCommand = lastCommandsArray[0]
  const secondaryCommand = lastCommandsArray[1]
  const props = lastCommand[0].command.get('props')
  return { mainCommand, secondaryCommand, props }
}

const allCommands = [
  'start', // +
  'menu_teams',
  'menu_user',
  'create_team',
  'edit_team',
  'join_team',
  'main_menu', // +
]

const commandHandler = async (userTelegramId, message, res) => {
  await dbConnect()

  const isItCommand = message[0] === '/'

  // Если была отправлена команда, то ищем ее или возвращаем ошибку
  if (isItCommand) {
    // const commandsArray = message.split('/')
    // commandsArray.shift()
    // const mainCommand = commandsArray[0]

    // Если такой команды не зарегистрировано, то возвращаем ошибку
    // if (!allCommands.includes(mainCommand))
    //   return await sendError(userTelegramId)

    // Если команда существует, то обрабатываем
    if (message === '/start' || message === '/main_menu')
      return await mainMenuScript(userTelegramId)
    if (message === '/menu_teams') return await teamsMenuScript(userTelegramId)
    if (message === '/menu_user') return await userMenuScript(userTelegramId)
    if (message === '/create_team')
      return await script({
        userTelegramId,
        command: { command: '/create_team/set_name', newTeam: true },
        text: 'Введите название команды',
        keyboard: keyboardCreateTeamSetName,
      })
    if (message === '/create_team/exit') {
      await script({
        userTelegramId,
        text: `Создание команды отменено`,
      })
      return await mainMenuScript(userTelegramId)
    }
    if (message === '/create_team/no_description') {
      const lastCommand = await getLastCommand(userTelegramId)
      if (!lastCommand) {
        await script({
          userTelegramId,
          text: 'Ошибка создания/редактирования команды.',
        })
        return await teamsMenuScript(userTelegramId)
      }
      const { mainCommand, secondaryCommand, props } = lastCommand
      const newTeam = !!props?.newTeam
      const team = await Teams.create({ name: props?.teamName })
      await script({
        userTelegramId,
        text: `${newTeam ? 'Создание' : 'Редактирование'} команды ${
          props?.teamName
        } завершено`,
      })
      return await teamsMenuScript(userTelegramId)
    }

    // Если команда без обработчика, то пишем ошибку
    return await script({
      userTelegramId,
      text: 'Неизвестная команда',
    })
    // }
  } else {
    // Если отправлен текст, то смотрим к какой команде он применяется
    // Ищем была ли до этого сделана команда
    const lastCommand = await getLastCommand(userTelegramId)

    // Если до этого небыло никакой команды, то пишем что ждем команду
    if (!lastCommand)
      return await script({
        userTelegramId,
        text: 'Пожалуйста введите команду',
      })

    const { mainCommand, secondaryCommand, props } = lastCommand

    if (mainCommand === 'create_team') {
      const newTeam = !!props?.newTeam
      if (secondaryCommand === 'set_name') {
        return await script({
          userTelegramId,
          command: {
            command: '/create_team/set_description',
            props: { teamName: message, newTeam },
          },
          text: `Задано название команды: ${message}.\nВведите описание команды (не обязательно)`,
          keyboard: keyboardCreateTeamSetDescription,
        })
      }
      if (secondaryCommand === 'set_description') {
        if (!props?.teamName) {
          await script({
            userTelegramId,
            text: `Ошибка ${
              newTeam ? 'создания' : 'редактирования'
            } команды. Не задано название команды`,
          })
          return await teamsMenuScript(userTelegramId)
        }
        const team = await Teams.create({
          name: props?.teamName,
          description: message,
        })
        await script({
          userTelegramId,
          text: `Задано описание команды: ${message}. ${
            newTeam ? 'Создание' : 'Редактирование'
          } команды ${props?.teamName} завершено`,
        })
        return await teamsMenuScript(userTelegramId)
      }
    }
    // Если возникла ошибка
    return await script({
      userTelegramId,
      text: 'ОШИБКА',
    })
  }

  // const lastCommand = await LastCommands.find({ userTelegramId })

  // if (lastCommand.length === 0) {
  //   return await script({
  //     userTelegramId,
  //     command: '/create_team/set_name',
  //     text: 'Введите название команды',
  //     keyboard: keyboardCreateTeam,
  //   })
  //   // console.log('==> /create_team/set_name')
  //   // await LastCommands.create({
  //   //   userTelegramId,
  //   //   command: '/create_team/set_name',
  //   // })
  //   // return await sendMessage({
  //   //   chat_id: userTelegramId,
  //   //   // text: JSON.stringify({ body, headers: req.headers.origin }),
  //   //   text: 'Введите название команды',
  //   //   keyboard,
  //   // })
  //   // return res?.status(200).json({ success: true, data })
  // } else {
  //   // Если небыло никаких команд с пользователем
  //   const commandsArray = String(lastCommand[0].command).split('/')
  //   commandsArray.shift()
  //   if (commandsArray[0] !== 'create_team') {
  //     console.log('create_team')
  //     return await sendMessage({
  //       chat_id: userTelegramId,
  //       // text: JSON.stringify({ body, headers: req.headers.origin }),
  //       text: 'Ошибка команды',
  //     })
  //   }

  //   if (commandsArray[1] === 'set_name')
  //     return await script({
  //       userTelegramId,
  //       command: '/create_team/set_description',
  //       text: `Задано название команды: ${command}.\nВведите описание команды (не обязательно)`,
  //       keyboard: keyboardCreateTeam,
  //     })
  //   if (commandsArray[1] === 'set_description')
  //     return await script({
  //       userTelegramId,
  //       text: `Задано описание команды: ${command}. Создание команды завершено`,
  //     })

  //   // return res?.status(200).json({ success: true, data: command })
  // }
}

export default commandHandler
