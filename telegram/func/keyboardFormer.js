import { commandToNum } from 'telegram/commands/commandsArray'
import inlineKeyboard from './inlineKeyboard'

const keyboardFormer = (buttons) => {
  if (buttons && typeof buttons === 'object') {
    const resultKeyboard = inlineKeyboard(
      // await Promise.all(
      buttons
        .filter((button) => !button.hide)
        .map((button) => {
          // if (typeof button === 'object')
          if (Array.isArray(button)) {
            const buttonsArray = button.filter((button) => !button.hide)
            return buttonsArray.map(({ text, c, url }) => {
              if (typeof c === 'string')
                return {
                  text,
                  callback_data: c
                    ? JSON.stringify({ c: commandToNum[c] })
                    : undefined,
                  url,
                }
              else {
                const convertedCommand = { ...c, c: commandToNum[c] }
                return {
                  text,
                  callback_data: c
                    ? JSON.stringify(convertedCommand)
                    : undefined,
                  url,
                }
              }
            })
          }
          const { text, c, url } = button
          if (typeof c === 'string')
            return [
              {
                text,
                callback_data: c
                  ? JSON.stringify({ c: commandToNum[c] })
                  : undefined,
                url,
              },
            ]

          // Значит команда в JSON формате
          if (c) {
            const convertedCommand = { ...c, c: commandToNum[c.c] }
            return [
              {
                text,
                callback_data: JSON.stringify(convertedCommand),
                url,
              },
            ]
          }
          return [
            {
              text,
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
