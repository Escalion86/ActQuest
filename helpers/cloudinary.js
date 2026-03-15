import isObject from './isObject'

export const deleteImage = async (publicId, resource_type = 'image') => {
  try {
    const res = await fetch('/api/cloudimages', {
      method: 'DELETE',
      // headers: {
      //   Accept: contentType,
      //   'Content-Type': contentType,
      // },
      body: JSON.stringify({ publicId, resource_type }),
    })

    // Throw error with status code in case Fetch API req failed
    if (!res.ok) {
      throw new Error(res.status)
    }
  } catch (error) {
    // setMessage('Failed to update on ' + url)
  }
}

// TODO Adding delete not used images
export const deleteImages = async (arrayOfImagesUrls, callback = null) => {
  if (callback) callback()
}

export const sendImage = async (
  image,
  callback,
  folder = null,
  imageName = null,
  project = 'actquest',
  onError = null
) => {
  if (isObject(image)) {
    const formData = new FormData()
    const normalizedProject =
      typeof project === 'string' ? project.trim() : String(project || '').trim()
    const normalizedFolder =
      typeof folder === 'string' ? folder.trim() : String(folder || '').trim()
    const directoryPath = `${normalizedProject || 'actquest'}/${normalizedFolder || 'temp'}`

    formData.append('directory', directoryPath)
    formData.append('files', image)
    if (imageName) formData.append('fileName', imageName)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000)

      const response = await fetch('/api/escalioncloud', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      })
      clearTimeout(timeoutId)

      const rawResponse = await response.text()
      let responseJson = null
      try {
        responseJson = rawResponse ? JSON.parse(rawResponse) : null
      } catch {
        responseJson = null
      }

      if (!responseJson) {
        const contentType = response.headers.get('content-type') || ''
        const trimmedResponse = rawResponse?.trim?.() || ''
        console.error('Upload returned non-JSON response', {
          status: response.status,
          ok: response.ok,
          contentType,
          preview: trimmedResponse.slice(0, 200),
        })
        const isHtmlResponse =
          contentType.includes('text/html') ||
          trimmedResponse.startsWith('<!doctype') ||
          trimmedResponse.startsWith('<html') ||
          trimmedResponse.startsWith('<')

        if (isHtmlResponse) {
          if (response.status === 413) {
            if (onError) {
              onError(
                'Файл слишком большой для загрузки. Попробуйте фото меньшего размера.'
              )
            }
            return null
          }
          if (onError) {
            onError(`Сервер вернул HTML вместо JSON (status ${response.status}).`)
          }
          return null
        }

        if (onError) onError('Сервер вернул некорректный ответ при загрузке файла.')
        return null
      }

      if (!response.ok || !responseJson?.success) {
        const error =
          responseJson?.data?.error?.message || `Upload failed: ${response.status}`
        if (onError) onError(error)
        return null
      }

      const data = responseJson.data
      if (callback) callback(data)
      return data
    } catch (err) {
      const message =
        err?.name === 'AbortError' ? 'Upload timeout' : err?.message || 'Upload failed'
      console.error('ERROR', err)
      if (onError) onError(message)
      return null
    }
  }

  if (onError) onError('Image is invalid')
  return null
}
