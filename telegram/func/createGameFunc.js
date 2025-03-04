const createGameFunc = async (userTelegramId, props, db) => {
  const game = await db.model('Games').create({
    ...props,
    creatorTelegramId: userTelegramId,
  })
  return game
}

export default createGameFunc
