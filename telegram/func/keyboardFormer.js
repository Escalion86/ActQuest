import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = (commands, buttons) => {
  if (buttons && typeof buttons === 'object') {
    const resultKeyboard = inlineKeyboard(
      // await Promise.all(
      buttons
        .filter((button) => !button.hide)
        .map((button) => {
          // if (typeof button === 'object')
          if (Array.isArray(button)) {
            const buttonsArray = [...button]
            return buttonsArray.map(({ text, c, url }) => {
              if (typeof c === 'string')
                return {
                  text,
                  callback_data: c ? JSON.stringify({ c }) : undefined,
                  url,
                }
              else
                return {
                  text,
                  callback_data: c ? JSON.stringify(c) : undefined,
                  url,
                }
            })
          }
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
          // console.log('JSON.stringify(c) :>> ', JSON.stringify(c))
          console.log('keyboard json length :>> ', JSON.stringify(c).length)
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
