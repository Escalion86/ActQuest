import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = (commands, buttons) => {
  if (buttons && typeof buttons === 'object') {
    const resultKeyboard = inlineKeyboard(
      // await Promise.all(
      buttons
        .filter((button) => !button.hide)
        .map((button) => {
          // if (typeof button === 'object')
          const { text, cmd, url } = button
          if (typeof cmd === 'string')
            return [
              {
                text,
                callback_data: cmd ? JSON.stringify({ cmd }) : undefined,
                url,
              },
            ]
          // Значит команда в JSON формате
          return [
            {
              text,
              callback_data: cmd ? JSON.stringify(cmd) : undefined,
              url,
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
