const ESCALIONCLOUD_API_URL = 'https://api.escalioncloud.ru/api'

const buildError = (type, message) => ({
  success: false,
  data: {
    error: {
      type,
      message,
    },
  },
})

const parseUpstreamResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

const normalizePathSegment = (value) =>
  typeof value === 'string' ? value.trim().replace(/^\/+|\/+$/g, '') : ''
const isDevEnv = process.env.NODE_ENV !== 'production'
const IOS_USER_AGENT_RE = /\b(iPhone|iPad|iPod)\b/i
const HEIC_HEIF_NAME_RE = /\.(heic|heif)$/i

const getRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const getFileMeta = (file) => {
  const name = typeof file?.name === 'string' ? file.name : ''
  const type = typeof file?.type === 'string' ? file.type : ''
  const size = Number.isFinite(file?.size) ? Number(file.size) : null
  const isHeic =
    /image\/hei(c|f)/i.test(type) || HEIC_HEIF_NAME_RE.test(String(name))

  return {
    name,
    type,
    size,
    isHeic,
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  const requestId = getRequestId()
  const userAgent = String(req.headers['user-agent'] || '')
  const contentLength = String(req.headers['content-length'] || '')
  const isIosClient = IOS_USER_AGENT_RE.test(userAgent)

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json(buildError('METHOD_NOT_ALLOWED', 'Method not allowed'))
  }

  const password = process.env.ESCALIONCLOUD_PASSWORD
  if (!password) {
    return res.status(500).json(
      buildError('CONFIG_ERROR', 'ESCALIONCLOUD_PASSWORD is not configured on the server'),
    )
  }

  try {
    const webRequest = new Request('http://localhost/api/escalioncloud', {
      method: 'POST',
      headers: req.headers,
      body: req,
      duplex: 'half',
    })
    const incomingFormData = await webRequest.formData()
    const files = incomingFormData.getAll('files')
    const filesMeta = files.map((file) => getFileMeta(file))
    const hasHeicFiles = filesMeta.some((file) => file.isHeic)
    const directoryRaw = incomingFormData.get('directory')
    const fileNameRaw = incomingFormData.get('fileName')
    const extensionRaw = incomingFormData.get('extension')
    const generateNameRaw = incomingFormData.get('generateName')
    const legacyProjectRaw = incomingFormData.get('project')
    const legacyFolderRaw = incomingFormData.get('folder')
    const directoryFromNewContract = normalizePathSegment(directoryRaw)
    const fileName =
      typeof fileNameRaw === 'string' && fileNameRaw.trim().length > 0
        ? fileNameRaw.trim()
        : null
    const extension =
      typeof extensionRaw === 'string' && extensionRaw.trim().length > 0
        ? extensionRaw.trim()
        : null
    const generateName =
      typeof generateNameRaw === 'string' && generateNameRaw.trim().length > 0
        ? generateNameRaw.trim()
        : null
    const legacyProject = normalizePathSegment(legacyProjectRaw)
    const legacyFolder = normalizePathSegment(legacyFolderRaw)
    const directory =
      directoryFromNewContract ||
      [legacyProject, legacyFolder].filter(Boolean).join('/')

    if (!files.length) {
      console.error('[EscalionCloud][upload][validation-error]', {
        requestId,
        reason: 'NO_FILES',
        isIosClient,
        userAgent,
        contentLength,
      })
      return res.status(400).json(
        buildError('VALIDATION_ERROR', 'No files provided for upload'),
      )
    }

    if (!directory) {
      console.error('[EscalionCloud][upload][validation-error]', {
        requestId,
        reason: 'EMPTY_DIRECTORY',
        isIosClient,
        userAgent,
        contentLength,
        filesMeta,
      })
      return res.status(400).json(
        buildError(
          'VALIDATION_ERROR',
          'Directory is required. Expected "<project>/<folder>"',
        ),
      )
    }

    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    formData.append('directory', directory)
    if (fileName) {
      formData.append('fileName', fileName)
    }
    if (extension) {
      formData.append('extension', extension)
    }
    if (generateName) {
      formData.append('generateName', generateName)
    }

    const upstreamResponse = await fetch(ESCALIONCLOUD_API_URL, {
      method: 'POST',
      headers: {
        'x-api-password': password,
      },
      body: formData,
    })

    const upstreamBody = await parseUpstreamResponse(upstreamResponse)

    if (isDevEnv) {
      console.log('[EscalionCloud][upload][upstream-response]', {
        requestId,
        status: upstreamResponse.status,
        ok: upstreamResponse.ok,
        directory,
        filesCount: files.length,
        filesMeta,
        body: upstreamBody,
      })
    }

    if (!upstreamResponse.ok) {
      const upstreamMessage =
        upstreamBody?.reason || upstreamBody?.message || upstreamBody
      const errorMessage =
        typeof upstreamMessage === 'string'
          ? upstreamMessage
          : JSON.stringify(upstreamMessage) ||
            `EscalionCloud upload failed with status ${upstreamResponse.status}`
      const isHeicLikelyRejected =
        hasHeicFiles &&
        /hei(c|f)|unsupported|format|mime|type|extension/i.test(
          String(errorMessage),
        )

      console.error('[EscalionCloud][upload][upstream-error]', {
        requestId,
        status: upstreamResponse.status,
        directory,
        isIosClient,
        contentLength,
        filesMeta,
        upstreamBody,
      })

      return res
        .status(upstreamResponse.status)
        .json(
          buildError(
            'ESCALIONCLOUD_REQUEST_FAILED',
            isHeicLikelyRejected
              ? 'Формат HEIC/HEIF сейчас не поддерживается загрузчиком. На iPhone выберите фото в JPEG (Настройки -> Камера -> Форматы -> Наиболее совместимые) или пересохраните изображение.'
              : errorMessage,
          ),
        )
    }

    return res.status(200).json({
      success: true,
      data: Array.isArray(upstreamBody)
        ? upstreamBody
        : upstreamBody?.data ?? upstreamBody,
    })
  } catch (error) {
    console.error('[EscalionCloud][upload][internal-error]', {
      requestId,
      isIosClient,
      contentLength,
      message: error?.message,
      stack: error?.stack,
    })
    return res.status(500).json(
      buildError(
        'INTERNAL_ERROR',
        'Unexpected error while uploading to EscalionCloud',
      ),
    )
  }
}
