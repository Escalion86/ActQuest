import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = (commands, buttons) => {
  if (buttons && typeof buttons === 'object') {
    const resultKeyboard = inlineKeyboard(
      // await Promise.all(
      buttons
        .filter((button) => !button.hide)
        .map((button) => {
          // if (typeof button === 'object')
          const { text, c, url } = button
          if (typeof c === 'string')
            return [
              {
                text,
                callback_data: c ? JSON.stringify({ c }) : undefined,
                url,
              },
            ]
          // Значит команда в JSON формате
          return [
            {
              text,
              callback_data: c ? JSON.stringify(c) : undefined,
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
