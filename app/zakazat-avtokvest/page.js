import CorporateOrderPageClient from '@components/public/CorporateOrderPageClient'
import { LOCATIONS } from '@server/serverConstants'
import getSiteUrl from '@helpers/getSiteUrl'

const siteUrl = getSiteUrl()

export const metadata = {
  title: 'Заказать автоквест для компании',
  description:
    'Организация закрытого автоквеста для компании, тимбилдинга, дня рождения или частного мероприятия в удобную дату.',
  alternates: {
    canonical: `${siteUrl}/zakazat-avtokvest`,
  },
  openGraph: {
    title: 'Заказать автоквест для компании | ActQuest',
    description:
      'Закрытые городские игры для компаний, праздников и командных мероприятий.',
    url: `${siteUrl}/zakazat-avtokvest`,
    images: ['/logo_title.png'],
  },
}

export default function CorporateOrderPage() {
  const locationOptions = Object.entries(LOCATIONS)
    .filter(([, value]) => !value?.hidden)
    .map(([key, value]) => ({
      value: key,
      label:
        typeof value?.townRu === 'string' && value.townRu
          ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
          : key,
    }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Заказ автоквеста для компании',
    provider: {
      '@type': 'Organization',
      name: 'ActQuest',
      url: siteUrl,
    },
    areaServed: locationOptions.map((item) => item.label),
    serviceType: 'Организация городского автоквеста',
    url: `${siteUrl}/zakazat-avtokvest`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CorporateOrderPageClient locationOptions={locationOptions} />
    </>
  )
}
