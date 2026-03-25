const resolveSessionUserFilter = (sessionUser) => {
  const globalUserId = sessionUser?.globalUserId || sessionUser?._id || null
  if (globalUserId) return { _id: globalUserId }

  if (sessionUser?.phone) return { phone: Number(sessionUser.phone) }
  if (sessionUser?.telegramId) return { telegramId: Number(sessionUser.telegramId) }
  if (sessionUser?.vkId) return { vkId: Number(sessionUser.vkId) }

  return null
}

export default resolveSessionUserFilter
