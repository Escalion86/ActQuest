import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = async (commands, buttons) => {
  var keyboard
  // if (!buttons) keyboard === undefined
  // if (typeof buttons === 'function') {
  //   keyboard = inlineKeyboard(await buttons(userTelegramId, props))
  // }
  if (typeof buttons === 'object') {
    keyboard = inlineKeyboard(
      buttons.map(async (button) => {
        if (typeof button === 'object')
          return [
            {
              text: button.text,
              callback_data: `/${button.command}`,
            },
          ]
        return [
          {
            text:
              (await commands[button]()).buttonText ??
              commands[button]().message,
            callback_data: `/${button}`,
          },
        ]
      })
    )
  }
  return keyboard
}

export default keyboardFormer
