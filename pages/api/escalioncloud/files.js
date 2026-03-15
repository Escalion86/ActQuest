const ESCALIONCLOUD_FILES_API_URL = 'https://api.escalioncloud.ru/api/files'

const buildError = (type, message) => ({
  success: false,
  data: {
    error: {
      type,
      message,
    },
  },
})

const parseBoolean = (value) =>
  value === 'true' || value === '1' || value === true

const parseUpstreamResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json(buildError('METHOD_NOT_ALLOWED', 'Method not allowed'))
  }

  const password = process.env.ESCALIONCLOUD_PASSWORD
  if (!password) {
    return res.status(500).json(
      buildError('CONFIG_ERROR', 'ESCALIONCLOUD_PASSWORD is not configured on the server'),
    )
  }

  try {
    const directory = req.query?.directory
    const noFoldersParam = req.query?.noFolders
    const upstreamSearchParams = new URLSearchParams()

    if (directory) upstreamSearchParams.set('directory', String(directory))
    if (typeof noFoldersParam !== 'undefined') {
      upstreamSearchParams.set(
        'noFolders',
        parseBoolean(noFoldersParam) ? '1' : '0',
      )
    }

    const queryString = upstreamSearchParams.toString()
    const upstreamUrl = queryString
      ? `${ESCALIONCLOUD_FILES_API_URL}?${queryString}`
      : ESCALIONCLOUD_FILES_API_URL

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'x-api-password': password,
      },
    })
    const upstreamBody = await parseUpstreamResponse(upstreamResponse)

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json(
        buildError(
          'ESCALIONCLOUD_REQUEST_FAILED',
          `EscalionCloud files request failed with status ${upstreamResponse.status}`,
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
    console.log('EscalionCloud files API error:', error)
    return res.status(500).json(
      buildError(
        'INTERNAL_ERROR',
        'Unexpected error while fetching files from EscalionCloud',
      ),
    )
  }
}
