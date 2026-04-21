import Link from 'next/link'

import { seoArticles } from '@app/_lib/seoArticles'
import SeoSectionCard from '@components/public/seo/SeoSectionCard'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export const metadata = {
  title: 'Статьи про автоквесты',
  description:
    'Гайды, кейсы и практические материалы по автоквестам: подготовка команды, маршруты, форматы и результат.',
  alternates: {
    canonical: '/articles',
  },
}

export default function ArticlesPage() {
  const breadcrumbsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: `${siteUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Статьи',
        item: `${siteUrl}/articles`,
      },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: seoArticles.map((article, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: article.title,
      url: `${siteUrl}/articles/${article.slug}`,
    })),
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <SeoSectionCard
        title="Статьи и гайды по автоквестам"
        description="Подборка материалов ActQuest про форматы автоквестов, подготовку команды, тимбилдинг и городские сценарии."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {seoArticles.map((article) => (
          <article
            key={article.slug}
            className="rounded-2xl border border-[#00D1FF]/30 bg-gradient-to-br from-[#12002a]/92 via-[#09001c]/96 to-[#040013]/98 p-5 shadow-[0_0_0_1px_rgba(0,209,255,0.08),0_18px_40px_rgba(6,2,30,0.55)]"
          >
            <h2 className="text-lg font-semibold text-[#eaf7ff]">
              <Link
                href={`/articles/${article.slug}`}
                className="underline decoration-[#00D1FF]/60 underline-offset-2 hover:text-white"
              >
                {article.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm text-[#b9d9ef]">{article.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {article.cityName ? (
                <span className="rounded-full border border-[#00D1FF]/35 bg-[#00D1FF]/10 px-2 py-0.5 text-xs text-[#bdefff]">
                  {article.cityName}
                </span>
              ) : (
                <span className="rounded-full border border-[#7A00FF]/35 bg-[#7A00FF]/10 px-2 py-0.5 text-xs text-[#e4d5ff]">
                  Общий материал
                </span>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
