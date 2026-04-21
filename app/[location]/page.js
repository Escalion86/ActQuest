import { notFound } from 'next/navigation'

import {
  CityLandingPage,
  cityPagesList,
  getCityPageConfig,
  getCityPageMetadata,
} from '@app/_lib/cityLandingPages'

export async function generateStaticParams() {
  return cityPagesList.map((city) => ({ location: city.slug }))
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const location = resolvedParams?.location
  if (typeof location !== 'string') return {}

  const city = getCityPageConfig(location)
  if (!city) {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  return getCityPageMetadata(location)
}

export default async function LocationLandingPage({ params }) {
  const resolvedParams = await params
  const location = resolvedParams?.location

  if (typeof location !== 'string') {
    notFound()
  }

  const city = getCityPageConfig(location)
  if (!city) {
    notFound()
  }

  return <CityLandingPage slug={location} />
}
