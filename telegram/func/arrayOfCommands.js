const arrayOfCommands = async ({ array, jsonCommand, onFinish }) => {
  if (!jsonCommand.message) {
    for (let i = 0; i < array.length; i++) {
      const data = array[i]
      if (jsonCommand[data.prop] === undefined) {
        return {
          success: true,
          message: data.message,
          buttons: data.buttons(jsonCommand),
          // nextCommand: `/menuTeams`,
        }
      }
    }
  }

  for (let i = 0; i < array.length; i++) {
    const data = array[i]
    if (jsonCommand[data.prop] === undefined) {
      if (
        array[i].checkAnswer !== undefined &&
        !array[i].checkAnswer(jsonCommand.message, jsonCommand.isPhoto)
      ) {
        return {
          success: false,
          message: array[i].errorMessage(
            jsonCommand.message,
            jsonCommand.isPhoto
          ),
          // buttons: data.buttons(props),
          nextCommand: jsonCommand,
          // `/createGame` + propsToStr(props),
        }
      }

      const value =
        typeof array[i].answerConverter === 'function'
          ? array[i].answerConverter(jsonCommand.message, jsonCommand.isPhoto)
          : jsonCommand.message

      if (i < array.length - 1) {
        return {
          success: true,
          message: array[i].answerMessage(
            jsonCommand.message,
            jsonCommand.isPhoto
          ),
          // buttons: data.buttons(props),
          nextCommand: { [data.prop]: value },
          // `/createGame` + propsToStr(props),
        }
      } else {
        // jsonCommand[data.prop] = value
        return await onFinish({ ...jsonCommand, [data.prop]: value })
      }
    }
  }
}

export default arrayOfCommands
