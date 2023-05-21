const inlineKeyboard = (inline_keyboard) => {
  if (!inline_keyboard || inline_keyboard.length === 0) return
  return {
    inline_keyboard,
  }
}

export default inlineKeyboard
