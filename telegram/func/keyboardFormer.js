import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = (commands, buttons) => {
  // if (!buttons) keyboard === undefined
  // if (typeof buttons === 'function') {
  //   keyboard = inlineKeyboard(await buttons(userTelegramId, props))
  // }
  if (buttons && typeof buttons === 'object') {
    const resultKeyboard = inlineKeyboard(
      // await Promise.all(
      buttons.map((button) => {
        // if (typeof button === 'object')
        const { text, command } = button
        if (typeof command === 'string')
          return [
            {
              text,
              callback_data: JSON.stringify({ command }),
            },
          ]
        // Значит команда в JSON формате
        return [
          {
            text,
            callback_data: JSON.stringify(command),
          },
        ]

        // console.log('button :>> ', button)
        // console.log('commands[button] :>> ', commands[button])
        // const command = await commands[button]()
        // console.log('command :>> ', command)
        // return [
        //   {
        //     text: command.buttonText ?? command.message,
        //     callback_data: `/${button}`,
        //   },
        // ]
      })
    )
    console.log('resultKeyboard :>> ', resultKeyboard.inline_keyboard)
    return resultKeyboard
    // )
  }
  return
}

export default keyboardFormer
