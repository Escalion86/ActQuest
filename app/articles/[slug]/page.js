import { notFound } from 'next/navigation'

import {
  buildArticleJsonLd,
  getSeoArticleBySlug,
  getSeoArticleMetadata,
  seoArticles,
} from '@app/_lib/seoArticles'
import SeoMetrikaTracker from '@components/analytics/SeoMetrikaTracker'
import SeoActionLink from '@components/public/seo/SeoActionLink'
import SeoLinksList from '@components/public/seo/SeoLinksList'
import SeoSectionCard from '@components/public/seo/SeoSectionCard'
import SeoTextSection from '@components/public/seo/SeoTextSection'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export async function generateStaticParams() {
  return seoArticles.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const slug = resolvedParams?.slug
  const article = getSeoArticleBySlug(slug)
  if (!article) return {}
  return getSeoArticleMetadata(article)
}

export default async function ArticlePage({ params }) {
  const resolvedParams = await params
  const slug = resolvedParams?.slug
  const article = getSeoArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const jsonLd = buildArticleJsonLd(article)
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
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: `${siteUrl}/articles/${article.slug}`,
      },
    ],
  }

  const relatedArticles = seoArticles
    .filter((item) => item.slug !== article.slug)
    .filter((item) =>
      article.citySlug ? item.citySlug === article.citySlug || !item.citySlug : true,
    )
    .slice(0, 3)
  const relatedArticleLinks = relatedArticles.map((item) => ({
    href: `/articles/${item.slug}`,
    label: item.title,
  }))

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <SeoMetrikaTracker
        viewGoal="aq_view_article"
        viewParams={{
          article_slug: article.slug,
          city: article.citySlug || 'all',
          page_type: 'article_page',
        }}
        scrollParams={{
          article_slug: article.slug,
          city: article.citySlug || 'all',
          page_type: 'article_page',
        }}
      />
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />

      <SeoSectionCard title={article.title} titleClassName="text-xl sm:text-3xl">
        <SeoTextSection paragraphs={[article.intro]} />

        <div className="mt-6 space-y-6">
          {article.sections.map((section) => (
            <SeoTextSection
              key={section.heading}
              title={section.heading}
              paragraphs={section.paragraphs}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <SeoActionLink
            href="/cabinet/login?mode=register"
            variant="primary"
            metrikaGoal="aq_click_register"
            metrikaParams={{
              city: article.citySlug || 'all',
              page_type: 'article_page',
              placement: 'article_inline_cta',
              article_slug: article.slug,
            }}
          >
            Записаться на игру
          </SeoActionLink>
          <SeoActionLink href="/articles" variant="secondary">
            Все статьи
          </SeoActionLink>
          {article.citySlug ? (
            <SeoActionLink href={`/${article.citySlug}`} variant="ghost">
              Страница города
            </SeoActionLink>
          ) : null}
        </div>
      </SeoSectionCard>

      {relatedArticles.length > 0 ? (
        <SeoSectionCard className="mt-6" title="Что ещё посмотреть">
          <SeoLinksList items={relatedArticleLinks} />
        </SeoSectionCard>
      ) : null}
    </main>
  )
}
