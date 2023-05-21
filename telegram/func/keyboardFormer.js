import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = async (commands, buttons) => {
  var keyboard
  // if (!buttons) keyboard === undefined
  // if (typeof buttons === 'function') {
  //   keyboard = inlineKeyboard(await buttons(userTelegramId, props))
  // }
  if (typeof buttons === 'object') {
    keyboard = inlineKeyboard(
      await Promise.all(
        buttons.map(async (button) => {
          if (typeof button === 'object')
            return [
              {
                text: button.text,
                callback_data: `/${button.command}`,
              },
            ]
          const command = await commands[button]()
          console.log('command :>> ', command)
          return [
            {
              text: command.buttonText ?? command.message,
              callback_data: `/${button}`,
            },
          ]
        })
      )
    )
  }
  return keyboard
}

export default keyboardFormer
