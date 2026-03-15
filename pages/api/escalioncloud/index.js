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
    const legacyProjectRaw = incomingFormData.get('project')
    const legacyFolderRaw = incomingFormData.get('folder')
    const directoryFromNewContract = normalizePathSegment(directoryRaw)
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

    const upstreamResponse = await fetch(ESCALIONCLOUD_API_URL, {
      method: 'POST',
      headers: {
        'x-api-password': password,
      },
      body: formData,
    })

    const upstreamBody = await parseUpstreamResponse(upstreamResponse)

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
