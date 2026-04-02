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

const AUTH_REQUIRED_PATTERNS = [
  'требуется авториза',
  'необходима авториза',
  'необходимо войти',
  'unauthor',
  'forbidden',
]

const isAuthFailureResponse = (response, jsonPayload) => {
  if (!response) {
    return false
  }

  if (response.status === 401) {
    return true
  }

  if (response.status !== 403) {
    return false
  }

  const rawError = extractErrorMessage(jsonPayload?.error ?? jsonPayload, '') ?? ''
  const normalizedError = String(rawError).trim().toLowerCase()

  if (!normalizedError) {
    return false
  }

  return AUTH_REQUIRED_PATTERNS.some((pattern) =>
    normalizedError.includes(pattern)
  )
}

const emitAuthRequiredEvent = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent('aq:auth-required'))
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
  if (hasError && isAuthFailureResponse(response, json)) {
    emitAuthRequiredEvent()
  }

  if (hasError && throwOnHttpError) {
    const message =
      extractErrorMessage(json?.error ?? json, fallbackMessage) ?? fallbackMessage
    throw createRequestError(message, response, json)
  }

  return { response, json }
}

export default requestApiJson
