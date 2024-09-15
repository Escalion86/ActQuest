import check from 'telegram/func/check'
import Games from '@models/Games'
import arrayOfCommands from 'telegram/func/arrayOfCommands'
import { v4 as uuidv4 } from 'uuid'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editGamePrices', gameId: jsonCommand.gameId, i: jsonCommand.i },
  text: '\u{1F6AB} Отмена создания варианта участия',
})

const array = [
  {
    prop: 'name',
    message: 'Введите название варианта участия',
    answerMessage: (answer) => `Вариант участия "${answer}"`,
    answerConverter: (answer) => answer.trim().toLowerCase(),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'price',
    message: 'Введите стоимость участия в рублях (укажите 0, если бесплатно)',
    checkAnswer: (answer) => answer == Number(answer),
    errorMessage: (answer) => `Вариант участия должен быть числом!`,
    answerMessage: (answer) => `Задана стоимость участия: ${answer} руб.`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addGamePrice = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const newPrice = {
        id: uuidv4(),
        name: result.name,
        price: result.price,
      }

      // Если все переменные на месте, то создаем команду
      const game = await Games.findById(jsonCommand.gameId)
      game.prices.push(newPrice)

      await Games.findByIdAndUpdate(jsonCommand.gameId, {
        prices: game.prices,
      })

      return {
        success: true,
        message: `Вариант участия "${result.name}" стоимостью ${result.price} руб. создан`,
        nextCommand: {
          c: 'editGamePrices',
          gameId: jsonCommand.gameId,
        },
      }
    },
  })
}

export default addGamePrice
