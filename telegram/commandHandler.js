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

const inlineKeyboard = (inline_keyboard) => {
  if (!inline_keyboard || inline_keyboard.length === 0) return
  return {
    inline_keyboard,
  }
}

var keyboardCreateTeamSetName = inlineKeyboard([
  [
    {
      text: 'Отмена создания/редактирования команды',
      callback_data: '/create_team/exit',
    },
  ],
])

var keyboardEditTeamSetName = inlineKeyboard([
  [
    {
      text: 'Отмена редактирования команды',
      callback_data: '/edit_team/exit',
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
      text: 'Отмена создания/редактирования команды',
      callback_data: '/create_team/exit',
    },
  ],
])

var keyboardEditTeamSetDescription = inlineKeyboard([
  [
    {
      text: 'Без описания',
      callback_data: '/edit_team/no_description',
    },
  ],
  [
    {
      text: 'Отмена редактирования команды',
      callback_data: '/edit_team/exit',
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

const menus = () => {
  return {
    start: {
      text: 'Главное меню',
      buttons: ['menu_teams', 'menu_user'],
    },
    main_menu: {
      text: 'Главное меню',
      buttons: ['menu_teams', 'menu_user'],
      // keyboard: keyboardMainMenu
    },
    menu_teams: {
      text: 'Меню работы с командами',
      buttons: ['create_team', 'edit_team', 'join_team'],
      // keyboard: keyboardMainMenu
    },
    menu_user: {
      text: 'Моя анкета',
    },
    create_team: {
      text: 'Создание команды',
      answerScript: (answer) => console.log('answer :>> ', answer),
    },
    edit_team: {
      text: 'Редактирование команды',
      // buttons: async (userId) => {
      //   await dbConnect()
      //   const teamsOfUser = await Teams.find({ capitanId: userId })
      //   teamsOfUser.map((team) => [
      //     {
      //       text: `"${team.name}"`,
      //       callback_data: `/edit_team/${team._id}`,
      //     },
      //   ])
      // }
    },
    join_team: {
      text: 'Создание команды',
      answerScript: (answer) => console.log('answer :>> ', answer),
    },
  }
}

const commandHandler = async (userTelegramId, message, res) => {
  await dbConnect()

  const isItCommand = message[0] === '/'

  // Если была отправлена команда, то ищем ее или возвращаем ошибку
  if (isItCommand) {
    const oldCommand = await LastCommands.findOneAndUpdate(
      {
        userTelegramId,
      },
      { command: message },
      { upsert: true }
    )
    console.log('oldCommand :>> ', oldCommand)
    const command = message.substr(1)
    const menu = menus[command]
    if (!menu) {
      return await script({
        userTelegramId,
        command: oldCommand.command.get('command'),
        text: 'Неизвестная команда',
      })
    }

    const { text, buttons } = menu

    return await script({
      userTelegramId,
      text,
      keyboard: inlineKeyboard(
        buttons.map((button) => [
          {
            text: menus[button].text,
            callback_data: `/${button}`,
          },
        ])
      ),
    })
  } else {
    await LastCommands.findOneAndDelete({
      userTelegramId,
    })
  }
}

const commandHandler2 = async (userTelegramId, message, res) => {
  await dbConnect()

  const isItCommand = message[0] === '/'

  // Если была отправлена команда, то ищем ее или возвращаем ошибку
  if (isItCommand) {
    // const cmd = typeof message === 'object' ? message.command : message
    // const cmdProps = typeof message === 'object' ? message.props : {}
    const commandsArray = message.split('/')
    commandsArray.shift()
    const mainCommand = commandsArray[0]
    const secondaryCommand = commandsArray[1]
    const propsCommand = commandsArray[2]
    console.log('mainCommand :>> ', mainCommand)
    console.log('secondaryCommand :>> ', secondaryCommand)

    // Если такой команды не зарегистрировано, то возвращаем ошибку
    // if (!allCommands.includes(mainCommand))
    //   return await sendError(userTelegramId)

    // Если команда существует, то обрабатываем
    if (mainCommand === 'start' || mainCommand === 'main_menu')
      return await mainMenuScript(userTelegramId)
    if (mainCommand === 'menu_teams')
      return await teamsMenuScript(userTelegramId)
    if (mainCommand === 'menu_user') return await userMenuScript(userTelegramId)
    if (mainCommand === 'create_team' && !secondaryCommand)
      return await script({
        userTelegramId,
        command: { command: '/create_team/set_name' },
        text: 'Введите название команды',
        keyboard: keyboardCreateTeamSetName,
      })
    if (mainCommand === 'create_team' && secondaryCommand === 'exit') {
      await script({
        userTelegramId,
        text: `Создание команды отменено`,
      })
      return await mainMenuScript(userTelegramId)
    }
    if (
      mainCommand === 'create_team' &&
      secondaryCommand === 'no_description'
    ) {
      console.log('!')
      const lastCommand = await getLastCommand(userTelegramId)
      if (!lastCommand) {
        await script({
          userTelegramId,
          text: 'Ошибка создания команды.',
        })
        return await teamsMenuScript(userTelegramId)
      }
      const { props } = lastCommand

      const team = await Teams.create({
        capitanId: userTelegramId,
        name: props?.teamName,
        name_lowered: props?.teamName.toLowerCase(),
      })

      await script({
        userTelegramId,
        text: `'Создание команды ${props?.teamName} завершено`,
      })
      return await teamsMenuScript(userTelegramId)
    }
    if (mainCommand === 'edit_team') {
      if (!secondaryCommand) {
        // Если команда не выбрана
        const teamsOfUser = await Teams.find({ capitanId: userTelegramId })
        if (!teamsOfUser || teamsOfUser.length === 0) {
          return await script({
            userTelegramId,
            text: 'У вас нет команд, которые вы можете администрировать',
            keyboard: inlineKeyboard([
              [
                {
                  text: '<= Вернуться в Меню команд',
                  callback_data: '/menu_teams',
                },
              ],
            ]),
          })
        }

        return await script({
          userTelegramId,
          text: 'Выберите команду которую хотите изменить',
          keyboard: inlineKeyboard(
            teamsOfUser.map((team) => [
              {
                text: `"${team.name}"`,
                callback_data: `/edit_team/${team._id}`,
              },
            ])
          ),
        })
      } else {
        if (secondaryCommand === 'set_name') {
          return await script({
            userTelegramId,
            text: `Введите новое название команды`,
            command: {
              command: '/edit_team/set_name',
              props: { teamId: propsCommand },
            },
            keyboard: inlineKeyboard([
              [
                {
                  text: `Отменить`,
                  callback_data: `/edit_team/${secondaryCommand}`,
                },
              ],
            ]),
          })
        }
        if (secondaryCommand === 'set_description') {
          return await script({
            userTelegramId,
            text: `Введите новое описание команды`,
            command: {
              command: '/edit_team/set_description',
              props: { teamId: propsCommand },
            },
            keyboard: inlineKeyboard([
              [
                {
                  text: `Отменить`,
                  callback_data: `/edit_team/${secondaryCommand}`,
                },
              ],
            ]),
          })
        }
        // Если команда выбрана
        const team = await Teams.findById(secondaryCommand)
        if (team)
          return await script({
            userTelegramId,
            text: `Редактирование команды "${team.name}"`,
            command: {
              command: '/edit_team',
              props: { teamId: secondaryCommand },
            },
            keyboard: inlineKeyboard([
              [
                {
                  text: `Изменить имя`,
                  callback_data: `/edit_team/set_name/${secondaryCommand}`,
                },
              ],
              [
                {
                  text: `Изменить описание`,
                  callback_data: `/edit_team/set_description/${secondaryCommand}`,
                },
              ],
              [
                {
                  text: `<= Назад`,
                  callback_data: `/edit_team`,
                },
              ],
            ]),
          })
        else return
        // }
      }
    }
    if (mainCommand === 'edit_team' && secondaryCommand === 'no_description') {
      const lastCommand = await getLastCommand(userTelegramId)
      if (!lastCommand) {
        await script({
          userTelegramId,
          text: 'Ошибка редактирования команды.',
        })
        return await teamsMenuScript(userTelegramId)
      }
      const { mainCommand, secondaryCommand, props } = lastCommand
      const team = await Teams.create({
        capitanId: userTelegramId,
        name: props?.teamName,
        name_lowered: props?.teamName.toLowerCase(),
      })
      await script({
        userTelegramId,
        text: `'Редактирование команды ${props?.teamName} завершено`,
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
      if (secondaryCommand === 'set_name') {
        return await script({
          userTelegramId,
          command: {
            command: '/create_team/set_description',
            props: { teamName: message },
          },
          text: `Задано название команды: "${message}".\n\nВведите описание команды (не обязательно)`,
          keyboard: keyboardCreateTeamSetDescription,
        })
      }
      if (secondaryCommand === 'set_description') {
        if (!props?.teamName) {
          await script({
            userTelegramId,
            text: `Ошибка создания команды. Не задано название команды`,
          })
          return await teamsMenuScript(userTelegramId)
        }
        const team = await Teams.create({
          capitanId: userTelegramId,
          name: props?.teamName,
          name_lowered: props?.teamName.toLowerCase(),
          description: message,
        })
        await script({
          userTelegramId,
          text: `Задано описание команды: "${message}".\n\nСоздание команды "${props?.teamName}" завершено`,
        })
        return await teamsMenuScript(userTelegramId)
      }
    }
    if (mainCommand === 'edit_team') {
      if (secondaryCommand === 'set_name') {
        return await script({
          userTelegramId,
          command: {
            command: `/edit_team/${props?.teamId}`,
          },
          text: `Задано новое название команды: "${message}"`,
          keyboard: inlineKeyboard([
            [
              {
                text: `Изменить имя`,
                callback_data: `/edit_team/set_name/${secondaryCommand}`,
              },
            ],
            [
              {
                text: `Изменить описание`,
                callback_data: `/edit_team/set_description/${secondaryCommand}`,
              },
            ],
            [
              {
                text: `<= Назад`,
                callback_data: `/edit_team`,
              },
            ],
          ]),
        })
      }
      // if (secondaryCommand === 'set_description') {
      //   if (!props?.teamName) {
      //     await script({
      //       userTelegramId,
      //       text: `Ошибка создания команды. Не задано название команды`,
      //     })
      //     return await teamsMenuScript(userTelegramId)
      //   }
      //   const team = await Teams.create({
      //     capitanId: userTelegramId,
      //     name: props?.teamName,
      //     name_lowered: props?.teamName.toLowerCase(),
      //     description: message,
      //   })
      //   await script({
      //     userTelegramId,
      //     text: `Задано описание команды: "${message}".\n\nСоздание команды "${props?.teamName}" завершено`,
      //   })
      //   return await teamsMenuScript(userTelegramId)
      // }
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
