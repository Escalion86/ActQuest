import Games from '@models/Games'

const createGameFunc = async (userTelegramId, props) => {
  console.log('createGameFunc props :>> ', props)
  const game = await Games.create({
    ...props,
    creatorTelegramId: userTelegramId,
  })
  return game
}

export default createGameFunc
