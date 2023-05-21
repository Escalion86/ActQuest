import LastCommands from '@models/LastCommands'
import Teams from '@models/Teams'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import commandsArray from './commands/commandsArray'
import getTeam from './func/getTeam'
import inlineKeyboard from './func/inlineKeyboard'
import keyboardFormer from './func/keyboardFormer'
import sendMessage from './sendMessage'

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
      buttons: [
        { text: 'Изменить имя', command: `set_user_name` },
        { command: 'main_menu', text: '\u{2B05} Главное меню' },
      ],
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
              command: ``,
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
    set_user_name: {
      text: `Введите имя`,
      buttons: [{ command: 'menu_user', text: '\u{1F6AB} Отмена' }],
      upper_command: 'menu_user',
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

const lastCommandHandler = async (telegramId, command, props, message) => {
  if (commandsArray[command])
    return await commandsArray[command]({ telegramId, props, message })
  return { success: false, message: 'Неизвестная команда' }
}

// const keyboardFormer = (menu, buttons) => {
//   var keyboard
//   // if (!buttons) keyboard === undefined
//   // if (typeof buttons === 'function') {
//   //   keyboard = inlineKeyboard(await buttons(userTelegramId, props))
//   // }
//   if (typeof buttons === 'object') {
//     keyboard = inlineKeyboard(
//       buttons.map((button) => {
//         if (typeof button === 'object')
//           return [
//             {
//               text: button.text,
//               callback_data: `/${button.command}`,
//             },
//           ]
//         return [
//           {
//             text: menu[button].buttonText ?? menu[button].text,
//             callback_data: `/${button}`,
//           },
//         ]
//       })
//     )
//   }
//   return keyboard
// }

const executeCommand = async (userTelegramId, message) => {
  await dbConnect()
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

  const result = await lastCommandHandler(userTelegramId, command, props)
  const keyboard = keyboardFormer(commandsArray, result.buttons)

  return await sendMessage({
    chat_id: userTelegramId,
    // text: JSON.stringify({ body, headers: req.headers.origin }),
    text: result.message,
    keyboard,
  })
}

const commandHandler = async (userTelegramId, message, res) => {
  try {
    // if (message === '/start') {
    //   return await sendMessage({
    //     chat_id: userTelegramId,
    //     // text: JSON.stringify({ body, headers: req.headers.origin }),
    //     text: 'Дайте доступ к номеру телефона',
    //     // props: { request_contact: true },
    //     keyboard: {
    //       keyboard: [
    //         [{ text: 'Отправить номер телефона', request_contact: true }],
    //       ],
    //       resize_keyboard: true,
    //       one_time_keyboard: true,
    //     },
    //   })
    // }

    await dbConnect()
    if (message === '/') message = ''

    const isItCommand = message[0] === '/'
    // Если была отправлена команда, то ищем ее или возвращаем ошибку
    if (isItCommand) {
      return executeCommand(userTelegramId, message)
    } else {
      // Если было отправлено сообщение, то смотрим какая до этого была команда (на что ответ)
      const last = await LastCommands.findOne({
        userTelegramId,
      })

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
        return await executeCommand(userTelegramId, result.nextCommand)
        // const { command, props } = messageToCommandAndProps(result.nextCommand)
        // const menu = await menus(userTelegramId, props)
        // const { text, buttons } = menu[command]

        // await LastCommands.findOneAndUpdate(
        //   {
        //     userTelegramId,
        //   },
        //   {
        //     command: {
        //       command: result.nextCommand,
        //       // props: { teamName: message },
        //     },
        //   },
        //   { upsert: true }
        // )

        // const keyboard = keyboardFormer(menu, buttons)

        // return await sendMessage({
        //   chat_id: userTelegramId,
        //   // text: JSON.stringify({ body, headers: req.headers.origin }),
        //   text,
        //   keyboard,
        // })
      }
      return await executeCommand(userTelegramId, '/' + result.upper_command)

      // const menu = await menus(userTelegramId, {})
      // const { upper_command } = menu[command]
      // const { text, buttons } = menu[upper_command]

      // await LastCommands.findOneAndUpdate(
      //   {
      //     userTelegramId,
      //   },
      //   {
      //     command: {
      //       command: '/' + upper_command,
      //       // props: { teamName: message },
      //     },
      //   },
      //   { upsert: true }
      // )

      // const keyboard = keyboardFormer(menu, buttons)

      // return await sendMessage({
      //   chat_id: userTelegramId,
      //   // text: JSON.stringify({ body, headers: req.headers.origin }),
      //   text,
      //   keyboard,
      // })
    }
  } catch (e) {
    console.log('e :>> ', e)
  }
}

export default commandHandler
