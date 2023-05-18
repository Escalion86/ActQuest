import LastCommands from '@models/LastCommands'
import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import sendMessage from './sendMessage'

const updateCommand = async (userTelegramId, command) => {
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
}

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

const getTeam = async (id) => {
  await dbConnect()
  const team = await Teams.findById(id)
  console.log('team :>> ', team)
  return team
}

const menus = async (userId, props) => {
  await dbConnect()
  const teamsOfUser = await Teams.find({ capitanId: userId })

  return {
    start: {
      text: 'Главное меню',
      buttons: ['menu_teams', 'menu_user'],
      upper_command: 'main_menu',
    },
    main_menu: {
      text: 'Главное меню',
      buttons: ['menu_teams', 'menu_user'],
      upper_command: 'main_menu',
    },
    menu_teams: {
      text: 'Меню работы с командами',
      buttonText: 'Команды',
      upper_command: 'main_menu',
      buttons: [
        'create_team',
        'edit_team',
        'join_team',
        { command: 'main_menu', text: '\u{2B05} Главное меню' },
      ],
    },
    menu_user: {
      text: 'Моя анкета',
      upper_command: 'main_menu',
      buttons: [{ command: 'main_menu', text: '\u{2B05} Главное меню' }],
    },
    create_team: !props?.teamName
      ? {
          text: 'Введите название команды',
          buttonText: '\u{2795} Создание команды',
          upper_command: 'menu_teams',
          buttons: [
            {
              command: 'menu_teams',
              text: '\u{1F6AB} Отмена создания команды',
            },
          ],
          // answerScript: (answer) => `create_team/teamName=${answer}`,
        }
      : {
          text: 'Введите описание команды (не обязательно)',
          upper_command: 'menu_teams',
          buttons: [
            {
              // command: `create_team/teamName=${props?.teamName}/teamDescription=`,
              command: '',
              text: 'Без описания',
            },
            { command: 'edit_team', text: '\u{1F6AB} Отмена создания команды' },
          ],
          // answerScript: (answer) =>
          //   `edit_team/teamName=${props?.teamName}/teamDescription=${answer}`,
        },
    edit_team: props?.teamId
      ? {
          text: `Редактирование команды"${
            (await getTeam(props.teamId))?.name
          }"`,
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
      : {
          text: 'Выберите команду для редактирования',
          buttonText: '\u{270F}  Редактирование команд',
          upper_command: 'menu_teams',
          buttons: [
            ...teamsOfUser.map((team) => ({
              text: `"${team.name}"`,
              command: `edit_team/teamId=${team._id}`,
            })),
            { command: 'menu_teams', text: '\u{2B05} Назад' },
          ],
        },
    set_team_name: {
      text: `Введите новое название команды`,
      buttons: [{ command: 'edit_team', text: '\u{1F6AB} Отмена' }],
      upper_command: 'menu_teams',
      // answerScript: (answer) =>
      //   `set_team_name/teamId=${props?.teamId}/teamName=${answer}`,
    },
    set_team_description: {
      text: `Введите новое описание команды`,
      buttons: [{ command: 'edit_team', text: '\u{1F6AB} Отмена' }],
      upper_command: 'menu_teams',
      // answerScript: (answer) =>
      //   `set_team_description/teamId=${props?.teamId}/teamDescription=${answer}`,
    },
    join_team: {
      text: 'Присоединиться к команде',
      textButton: `\u{1F517} Присоединиться к команде`,
      buttons: [{ command: 'main_menu', text: '\u{2B05} Главное меню' }],
      upper_command: 'main_menu',
      // answerScript: (answer) => console.log('answer :>> ', answer),
    },
  }
}
const messageToCommandAndProps = (message) => {
  const commands = message.split('/')
  commands.shift()

  const command = commands[0]
  commands.shift()

  var props = {}
  commands.forEach((prop) => {
    const [key, value] = prop.split('=')
    props[key] = value
  })

  return { command, props }
}

const lastCommandHandler = async (userTelegramId, command, props, message) => {
  await dbConnect()
  if (command === 'set_team_name') {
    if (!props.teamId)
      return {
        success: false,
        message:
          'Не удалось изменить название команды, так как команда не найдена',
      }
    const team = await Teams.findByIdAndUpdate(props.teamId, {
      name: message,
      name_lowered: message.toLowerCase(),
    })
    return { success: true, message: 'Название команды обновлено' }
  }
  if (command === 'set_team_description') {
    if (!props.teamId)
      return {
        success: false,
        message:
          'Не удалось изменить описание команды, так как команда не найдена',
      }
    const team = await Teams.findByIdAndUpdate(props.teamId, {
      description: message,
    })
    return { success: true, message: 'Описание команды обновлено' }
  }
  if (command === 'create_team') {
    if (!props.teamName) {
      return {
        success: true,
        message: `Задано название команды "${message}"`,
        nextCommand: `'/create_team/teamName=${message}`,
      }
    }
    const team = await Teams.create({
      capitanId: userTelegramId,
      name: props?.teamName,
      name_lowered: props?.teamName.toLowerCase(),
      description: message,
    })

    return { success: true, message: `Команда создана` }
    // return {
    //   success: false,
    //   message:
    //     'Не удалось изменить описание команды, так как команда не найдена',
    // }
    // const team = await Teams.findByIdAndUpdate(props.teamId, {
    //   description: message,
    // })
  }
  return { success: false, message: 'Неизвестная команда' }
}

const keyboardFormer = (menu, buttons) => {
  var keyboard
  // if (!buttons) keyboard === undefined
  // if (typeof buttons === 'function') {
  //   keyboard = inlineKeyboard(await buttons(userTelegramId, props))
  // }
  if (typeof buttons === 'object') {
    keyboard = inlineKeyboard(
      buttons.map((button) => {
        if (typeof button === 'object')
          return [
            {
              text: button.text,
              callback_data: `/${button.command}`,
            },
          ]
        return [
          {
            text: menu[button].buttonText ?? menu[button].text,
            callback_data: `/${button}`,
          },
        ]
      })
    )
  }
  return keyboard
}

const commandHandler = async (userTelegramId, message, res) => {
  try {
    await dbConnect()

    const isItCommand = message[0] === '/'
    // Если была отправлена команда, то ищем ее или возвращаем ошибку
    if (isItCommand) {
      const last = await LastCommands.findOneAndUpdate(
        {
          userTelegramId,
        },
        {
          command: {
            command: message,
            // props: { teamName: message },
          },
        },
        { upsert: true }
      )
      const { command, props } = messageToCommandAndProps(message)

      const menu = await menus(userTelegramId, props)

      if (!menu[command]) {
        const lastCommand = last ? last.command.get('command') : undefined
        return await script({
          userTelegramId,
          command: lastCommand,
          text: 'Неизвестная команда',
        })
      }

      const { text, buttons } = menu[command]

      const keyboard = keyboardFormer(menu, buttons)

      return await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text,
        keyboard,
      })
      // return await script({
      //   userTelegramId,
      //   text,
      //   keyboard,
      // })
    } else {
      const last = await LastCommands.findOne({
        userTelegramId,
      })
      console.log('last :>> ', last)
      if (!last) {
        return await sendMessage({
          chat_id: userTelegramId,
          // text: JSON.stringify({ body, headers: req.headers.origin }),
          text: 'Ответ получен, но команда на которую дан ответ не найден',
        })
      }
      const lastCommand = last.command.get('command')
      const { command, props } = messageToCommandAndProps(lastCommand)
      const result = await lastCommandHandler(
        userTelegramId,
        command,
        props,
        message
      )
      await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text: result.message,
        // keyboard,
      })
      if (result.nextCommand) {
        const { command, props } = messageToCommandAndProps(result.nextCommand)
        const menu = await menus(userTelegramId, props)
        const { text, buttons } = menu[command]

        await LastCommands.findOneAndUpdate(
          {
            userTelegramId,
          },
          {
            command: {
              command: '/' + result.nextCommand,
              // props: { teamName: message },
            },
          },
          { upsert: true }
        )

        const keyboard = keyboardFormer(menu, buttons)

        return await sendMessage({
          chat_id: userTelegramId,
          // text: JSON.stringify({ body, headers: req.headers.origin }),
          text,
          keyboard,
        })
      }

      const menu = await menus(userTelegramId, {})
      const { upper_command } = menu[command]
      const { text, buttons } = menu[upper_command]

      await LastCommands.findOneAndUpdate(
        {
          userTelegramId,
        },
        {
          command: {
            command: '/' + upper_command,
            // props: { teamName: message },
          },
        },
        { upsert: true }
      )

      const keyboard = keyboardFormer(menu, buttons)

      return await sendMessage({
        chat_id: userTelegramId,
        // text: JSON.stringify({ body, headers: req.headers.origin }),
        text,
        keyboard,
      })

      // return await sendMessage({
      //   chat_id: userTelegramId,
      //   // text: JSON.stringify({ body, headers: req.headers.origin }),
      //   text: `Принят ответ на команду:\n${lastCommand}`,
      //   // keyboard,
      // })
    }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

// const commandHandler2 = async (userTelegramId, message, res) => {
//   await dbConnect()

//   const isItCommand = message[0] === '/'

//   // Если была отправлена команда, то ищем ее или возвращаем ошибку
//   if (isItCommand) {
//     // const cmd = typeof message === 'object' ? message.command : message
//     // const cmdProps = typeof message === 'object' ? message.props : {}
//     const commandsArray = message.split('/')
//     commandsArray.shift()
//     const mainCommand = commandsArray[0]
//     const secondaryCommand = commandsArray[1]
//     const propsCommand = commandsArray[2]
//     console.log('mainCommand :>> ', mainCommand)
//     console.log('secondaryCommand :>> ', secondaryCommand)

//     // Если такой команды не зарегистрировано, то возвращаем ошибку
//     // if (!allCommands.includes(mainCommand))
//     //   return await sendError(userTelegramId)

//     // Если команда существует, то обрабатываем
//     if (mainCommand === 'start' || mainCommand === 'main_menu')
//       return await mainMenuScript(userTelegramId)
//     if (mainCommand === 'menu_teams')
//       return await teamsMenuScript(userTelegramId)
//     if (mainCommand === 'menu_user') return await userMenuScript(userTelegramId)
//     if (mainCommand === 'create_team' && !secondaryCommand)
//       return await script({
//         userTelegramId,
//         command: { command: '/create_team/set_name' },
//         text: 'Введите название команды',
//         keyboard: keyboardCreateTeamSetName,
//       })
//     if (mainCommand === 'create_team' && secondaryCommand === 'exit') {
//       await script({
//         userTelegramId,
//         text: `Создание команды отменено`,
//       })
//       return await mainMenuScript(userTelegramId)
//     }
//     if (
//       mainCommand === 'create_team' &&
//       secondaryCommand === 'no_description'
//     ) {
//       console.log('!')
//       const lastCommand = await getLastCommand(userTelegramId)
//       if (!lastCommand) {
//         await script({
//           userTelegramId,
//           text: 'Ошибка создания команды.',
//         })
//         return await teamsMenuScript(userTelegramId)
//       }
//       const { props } = lastCommand

//       const team = await Teams.create({
//         capitanId: userTelegramId,
//         name: props?.teamName,
//         name_lowered: props?.teamName.toLowerCase(),
//       })

//       await script({
//         userTelegramId,
//         text: `'Создание команды ${props?.teamName} завершено`,
//       })
//       return await teamsMenuScript(userTelegramId)
//     }
//     if (mainCommand === 'edit_team') {
//       if (!secondaryCommand) {
//         // Если команда не выбрана
//         const teamsOfUser = await Teams.find({ capitanId: userTelegramId })
//         if (!teamsOfUser || teamsOfUser.length === 0) {
//           return await script({
//             userTelegramId,
//             text: 'У вас нет команд, которые вы можете администрировать',
//             keyboard: inlineKeyboard([
//               [
//                 {
//                   text: '<= Вернуться в Меню команд',
//                   callback_data: '/menu_teams',
//                 },
//               ],
//             ]),
//           })
//         }

//         return await script({
//           userTelegramId,
//           text: 'Выберите команду которую хотите изменить',
//           keyboard: inlineKeyboard(
//             teamsOfUser.map((team) => [
//               {
//                 text: `"${team.name}"`,
//                 callback_data: `/edit_team/${team._id}`,
//               },
//             ])
//           ),
//         })
//       } else {
//         if (secondaryCommand === 'set_name') {
//           return await script({
//             userTelegramId,
//             text: `Введите новое название команды`,
//             command: {
//               command: '/edit_team/set_name',
//               props: { teamId: propsCommand },
//             },
//             keyboard: inlineKeyboard([
//               [
//                 {
//                   text: `Отменить`,
//                   callback_data: `/edit_team/${secondaryCommand}`,
//                 },
//               ],
//             ]),
//           })
//         }
//         if (secondaryCommand === 'set_description') {
//           return await script({
//             userTelegramId,
//             text: `Введите новое описание команды`,
//             command: {
//               command: '/edit_team/set_description',
//               props: { teamId: propsCommand },
//             },
//             keyboard: inlineKeyboard([
//               [
//                 {
//                   text: `Отменить`,
//                   callback_data: `/edit_team/${secondaryCommand}`,
//                 },
//               ],
//             ]),
//           })
//         }
//         // Если команда выбрана
//         const team = await getTeam(secondaryCommand)
//         if (team)
//           return await script({
//             userTelegramId,
//             text: `Редактирование команды "${team.name}"`,
//             command: {
//               command: '/edit_team',
//               props: { teamId: secondaryCommand },
//             },
//             keyboard: inlineKeyboard([
//               [
//                 {
//                   text: `Изменить имя`,
//                   callback_data: `/edit_team/set_name/${secondaryCommand}`,
//                 },
//               ],
//               [
//                 {
//                   text: `Изменить описание`,
//                   callback_data: `/edit_team/set_description/${secondaryCommand}`,
//                 },
//               ],
//               [
//                 {
//                   text: `<= Назад`,
//                   callback_data: `/edit_team`,
//                 },
//               ],
//             ]),
//           })
//         else return
//         // }
//       }
//     }
//     if (mainCommand === 'edit_team' && secondaryCommand === 'no_description') {
//       const lastCommand = await getLastCommand(userTelegramId)
//       if (!lastCommand) {
//         await script({
//           userTelegramId,
//           text: 'Ошибка редактирования команды.',
//         })
//         return await teamsMenuScript(userTelegramId)
//       }
//       const { mainCommand, secondaryCommand, props } = lastCommand
//       const team = await Teams.create({
//         capitanId: userTelegramId,
//         name: props?.teamName,
//         name_lowered: props?.teamName.toLowerCase(),
//       })
//       await script({
//         userTelegramId,
//         text: `'Редактирование команды ${props?.teamName} завершено`,
//       })
//       return await teamsMenuScript(userTelegramId)
//     }

//     // Если команда без обработчика, то пишем ошибку
//     return await script({
//       userTelegramId,
//       text: 'Неизвестная команда',
//     })
//     // }
//   } else {
//     // Если отправлен текст, то смотрим к какой команде он применяется
//     // Ищем была ли до этого сделана команда
//     const lastCommand = await getLastCommand(userTelegramId)

//     // Если до этого небыло никакой команды, то пишем что ждем команду
//     if (!lastCommand)
//       return await script({
//         userTelegramId,
//         text: 'Пожалуйста введите команду',
//       })

//     const { mainCommand, secondaryCommand, props } = lastCommand

//     if (mainCommand === 'create_team') {
//       if (secondaryCommand === 'set_name') {
//         return await script({
//           userTelegramId,
//           command: {
//             command: '/create_team/set_description',
//             props: { teamName: message },
//           },
//           text: `Задано название команды: "${message}".\n\nВведите описание команды (не обязательно)`,
//           keyboard: keyboardCreateTeamSetDescription,
//         })
//       }
//       if (secondaryCommand === 'set_description') {
//         if (!props?.teamName) {
//           await script({
//             userTelegramId,
//             text: `Ошибка создания команды. Не задано название команды`,
//           })
//           return await teamsMenuScript(userTelegramId)
//         }
//         const team = await Teams.create({
//           capitanId: userTelegramId,
//           name: props?.teamName,
//           name_lowered: props?.teamName.toLowerCase(),
//           description: message,
//         })
//         await script({
//           userTelegramId,
//           text: `Задано описание команды: "${message}".\n\nСоздание команды "${props?.teamName}" завершено`,
//         })
//         return await teamsMenuScript(userTelegramId)
//       }
//     }
//     if (mainCommand === 'edit_team') {
//       if (secondaryCommand === 'set_name') {
//         return await script({
//           userTelegramId,
//           command: {
//             command: `/edit_team/${props?.teamId}`,
//           },
//           text: `Задано новое название команды: "${message}"`,
//           keyboard: inlineKeyboard([
//             [
//               {
//                 text: `Изменить имя`,
//                 callback_data: `/edit_team/set_name/${secondaryCommand}`,
//               },
//             ],
//             [
//               {
//                 text: `Изменить описание`,
//                 callback_data: `/edit_team/set_description/${secondaryCommand}`,
//               },
//             ],
//             [
//               {
//                 text: `<= Назад`,
//                 callback_data: `/edit_team`,
//               },
//             ],
//           ]),
//         })
//       }
//       // if (secondaryCommand === 'set_description') {
//       //   if (!props?.teamName) {
//       //     await script({
//       //       userTelegramId,
//       //       text: `Ошибка создания команды. Не задано название команды`,
//       //     })
//       //     return await teamsMenuScript(userTelegramId)
//       //   }
//       //   const team = await Teams.create({
//       //     capitanId: userTelegramId,
//       //     name: props?.teamName,
//       //     name_lowered: props?.teamName.toLowerCase(),
//       //     description: message,
//       //   })
//       //   await script({
//       //     userTelegramId,
//       //     text: `Задано описание команды: "${message}".\n\nСоздание команды "${props?.teamName}" завершено`,
//       //   })
//       //   return await teamsMenuScript(userTelegramId)
//       // }
//     }
//     // Если возникла ошибка
//     return await script({
//       userTelegramId,
//       text: 'ОШИБКА',
//     })
//   }

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
// }

export default commandHandler
