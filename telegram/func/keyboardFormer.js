import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = async (commands, buttons) => {
  // if (!buttons) keyboard === undefined
  // if (typeof buttons === 'function') {
  //   keyboard = inlineKeyboard(await buttons(userTelegramId, props))
  // }
  if (buttons && typeof buttons === 'object') {
    return inlineKeyboard(
      await Promise.all(
        buttons.map(async (button) => {
          if (typeof button === 'object')
            return [
              {
                text: button.text,
                callback_data: `/${button.command}`,
              },
            ]
          console.log('button :>> ', button)
          console.log('commands[button] :>> ', commands[button])
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
  return
}

export default keyboardFormer
