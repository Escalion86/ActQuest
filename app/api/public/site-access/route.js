import { NextResponse } from 'next/server'

import { LOCATIONS } from '@server/serverConstants'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed || !LOCATIONS[trimmed] || LOCATIONS[trimmed]?.hidden) {
    return null
  }

  return trimmed
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const location = normalizeLocation(searchParams.get('location'))
    const controls = await getSiteAccessControlsByLocation(location)

    return NextResponse.json(
      {
        success: true,
        data: controls,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load public site access controls (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось загрузить настройки доступа сайта.',
      },
      { status: 500 },
    )
  }
}
