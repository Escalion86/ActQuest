import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'

const ESCALIONCLOUD_API_URL =
  process.env.ESCALIONCLOUD_API_URL || 'https://cloud.escalion.ru/api'
const ESCALIONCLOUD_FILES_API_URL = `${ESCALIONCLOUD_API_URL.replace(/\/+$/g, '')}/files`

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

export async function GET(request) {
  const session = await getServerSession(authOptions)
  const role = String(session?.user?.role || '').trim().toLowerCase()
  if (!session?.user) {
    return NextResponse.json(buildError('UNAUTHORIZED', 'Необходима авторизация'), {
      status: 401,
    })
  }
  if (role !== 'moder' && role !== 'admin' && role !== 'dev') {
    return NextResponse.json(buildError('FORBIDDEN', 'Недостаточно прав'), {
      status: 403,
    })
  }

  const password = process.env.ESCALIONCLOUD_PASSWORD
  if (!password) {
    return NextResponse.json(
      buildError(
        'CONFIG_ERROR',
        'ESCALIONCLOUD_PASSWORD is not configured on the server',
      ),
      { status: 500 },
    )
  }

  try {
    const directory = request.nextUrl.searchParams.get('directory')
    const noFoldersParam = request.nextUrl.searchParams.get('noFolders')
    const upstreamSearchParams = new URLSearchParams()

    if (directory) upstreamSearchParams.set('directory', String(directory))
    if (typeof noFoldersParam !== 'undefined' && noFoldersParam !== null) {
      upstreamSearchParams.set('noFolders', String(noFoldersParam))
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
      return NextResponse.json(
        buildError(
          'ESCALIONCLOUD_REQUEST_FAILED',
          `EscalionCloud files request failed with status ${upstreamResponse.status}`,
        ),
        { status: upstreamResponse.status },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: Array.isArray(upstreamBody)
          ? upstreamBody
          : upstreamBody?.data ?? upstreamBody,
      },
      { status: 200 },
    )
  } catch (error) {
    console.log('EscalionCloud files API error:', error)
    return NextResponse.json(
      buildError(
        'INTERNAL_ERROR',
        'Unexpected error while fetching files from EscalionCloud',
      ),
      { status: 500 },
    )
  }
}
