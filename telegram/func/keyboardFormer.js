import { commandToNum } from 'telegram/commands/commandsArray'
import inlineKeyboard from './inlineKeyboard'

const buttonConstructor = ({ text, c, url }) => {
  if (typeof c === 'string')
    return {
      text,
      callback_data: c ? JSON.stringify({ c: commandToNum[c] }) : undefined,
      url,
    }

  // Значит команда в JSON формате
  if (c) {
    const convertedCommand = { ...c, c: commandToNum[c.c] }
    return {
      text,
      callback_data: JSON.stringify(convertedCommand),
      url,
    }
  }
  return {
    text,
    url,
  }
}

const keyboardFormer = (buttons) => {
  if (buttons && typeof buttons === 'object') {
    return inlineKeyboard(
      buttons
        .filter(
          (button) => !button.hide && (button.text || Array.isArray(button))
        )
        .map((button) => {
          if (Array.isArray(button)) {
            const buttonsArray = button.filter(
              (button) => !button.hide && button.text
            )
            return buttonsArray.map(buttonConstructor)
          }
          return [buttonConstructor(button)]
        })
    )
  }
  return
}

export default keyboardFormer
