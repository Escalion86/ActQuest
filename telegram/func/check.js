const check = (jsonCommand, keys) => {
  if (typeof jsonCommand !== 'object' || jsonCommand === null) {
    return {
      success: false,
      message: 'Ошибка. Проверки данных',
      nextCommand: `main_menu`,
    }
  }
  keys.forEach((key) => {
    if (jsonCommand[key] === undefined) {
      return {
        success: false,
        message: `Ошибка. Не задан ${key}`,
        nextCommand: `menu_games`,
      }
    }
  })

  return
}

export default check
