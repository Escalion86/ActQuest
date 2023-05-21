import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = (commands, buttons) => {
  // if (!buttons) keyboard === undefined
  // if (typeof buttons === 'function') {
  //   keyboard = inlineKeyboard(await buttons(userTelegramId, props))
  // }
  if (buttons && typeof buttons === 'object') {
    return inlineKeyboard(
      // await Promise.all(
      buttons.map((button) => {
        // if (typeof button === 'object')
        const { text, command } = button
        return [
          {
            text,
            callback_data: `/${command}`,
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
    // )
  }
  return
}

export default keyboardFormer
