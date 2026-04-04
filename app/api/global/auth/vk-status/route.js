import { NextResponse } from 'next/server'

import { LOCATIONS } from '@server/serverConstants'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || !LOCATIONS[normalized] || LOCATIONS[normalized]?.hidden) {
    return null
  }
  return normalized
}

export async function GET(request) {
  const location = normalizeLocation(request.nextUrl.searchParams.get('location'))
  if (!location) {
    return NextResponse.json(
      {
        success: false,
        data: {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Location is invalid',
          },
        },
      },
      { status: 400 },
    )
  }

  try {
    const controls = await getSiteAccessControlsByLocation(location)
    return NextResponse.json(
      {
        success: true,
        data: {
          location,
          allowVkAuth: Boolean(controls.allowSiteAuth && controls.enableVkOneTap),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load vk status', error)
    return NextResponse.json(
      {
        success: true,
        data: {
          location,
          allowVkAuth: false,
          source: 'fallback',
        },
      },
      { status: 200 },
    )
  }
}
