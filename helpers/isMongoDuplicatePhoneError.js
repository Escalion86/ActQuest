const isMongoDuplicatePhoneError = (error) => {
  if (!error || error.code !== 11000) return false

  const keyPatternPhone = Boolean(error?.keyPattern?.phone)
  const keyValuePhone =
    typeof error?.keyValue === 'object' && error?.keyValue !== null
      ? Object.prototype.hasOwnProperty.call(error.keyValue, 'phone')
      : false
  const messagePhone =
    typeof error?.message === 'string' && error.message.includes('phone')

  return keyPatternPhone || keyValuePhone || messagePhone
}

export default isMongoDuplicatePhoneError
