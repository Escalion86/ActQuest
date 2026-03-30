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

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
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
      return res.status(400).json(
        buildError('VALIDATION_ERROR', 'No files provided for upload'),
      )
    }

    if (!directory) {
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
        status: upstreamResponse.status,
        ok: upstreamResponse.ok,
        directory,
        filesCount: files.length,
        fileNames: files
          .map((file) => (typeof file?.name === 'string' ? file.name : null))
          .filter(Boolean),
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

      return res
        .status(upstreamResponse.status)
        .json(buildError('ESCALIONCLOUD_REQUEST_FAILED', errorMessage))
    }

    return res.status(200).json({
      success: true,
      data: Array.isArray(upstreamBody)
        ? upstreamBody
        : upstreamBody?.data ?? upstreamBody,
    })
  } catch (error) {
    console.log('EscalionCloud upload API error:', error)
    return res.status(500).json(
      buildError(
        'INTERNAL_ERROR',
        'Unexpected error while uploading to EscalionCloud',
      ),
    )
  }
}
