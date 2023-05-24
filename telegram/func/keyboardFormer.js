import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = (commands, buttons) => {
  if (buttons && typeof buttons === 'object') {
    const resultKeyboard = inlineKeyboard(
      // await Promise.all(
      buttons
        .filter((button) => !button.hide)
        .map((button) => {
          // if (typeof button === 'object')
          const { text, cmd } = button
          if (typeof cmd === 'string')
            return [
              {
                text,
                callback_data: JSON.stringify({ cmd }),
              },
            ]
          // Значит команда в JSON формате
          return [
            {
              text,
              callback_data: JSON.stringify(cmd),
            },
          ]
        })
    )
    return resultKeyboard
    // )
  }
  return
}

export default keyboardFormer
