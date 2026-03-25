import extractErrorMessage from '@helpers/extractErrorMessage'

const parseJsonSafely = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const createRequestError = (message, response, payload) => {
  const error = new Error(message)
  error.status = response?.status ?? null
  error.response = response ?? null
  error.payload = payload ?? null
  return error
}

const requestApiJson = async (url, options = {}) => {
  const {
    fallbackMessage = 'Не удалось выполнить запрос',
    throwOnHttpError = true,
    ...fetchOptions
  } = options

  const response = await fetch(url, fetchOptions)
  const json = await parseJsonSafely(response)

  const hasError = !response.ok || json?.success === false
  if (hasError && throwOnHttpError) {
    const message =
      extractErrorMessage(json?.error ?? json, fallbackMessage) ?? fallbackMessage
    throw createRequestError(message, response, json)
  }

  return { response, json }
}

export default requestApiJson
