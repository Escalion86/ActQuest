import PropTypes from 'prop-types'

import SeoActionLink from '@components/public/seo/SeoActionLink'
import SeoLinksList from '@components/public/seo/SeoLinksList'
import SeoSectionCard from '@components/public/seo/SeoSectionCard'

export default function SeoHomepageFooterSections({ cityLinks, featuredArticles }) {
  return (
    <section className="w-full max-w-6xl px-4 mx-auto mt-6 space-y-4 reveal-g">
      <SeoSectionCard title="Города">
        <div className="flex flex-wrap gap-2.5">
          {cityLinks.map((city) => (
            <SeoActionLink key={city.slug} href={`/${city.slug}`} variant="ghost">
              {city.title}
            </SeoActionLink>
          ))}
        </div>
      </SeoSectionCard>

      <SeoSectionCard
        title="Гайды и статьи"
        description="Практические материалы по подготовке команды, сценариям и прохождению игр."
      >
        <SeoLinksList
          items={featuredArticles.map((article) => ({
            href: `/articles/${article.slug}`,
            label: article.title,
          }))}
          className="text-sm"
          linkClassName="hover:text-[#e7f7ff]"
        />
        <div className="mt-3">
          <SeoActionLink href="/articles" variant="secondary">
            Все статьи
          </SeoActionLink>
        </div>
      </SeoSectionCard>
    </section>
  )
}

SeoHomepageFooterSections.propTypes = {
  cityLinks: PropTypes.arrayOf(
    PropTypes.shape({
      slug: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }),
  ),
  featuredArticles: PropTypes.arrayOf(
    PropTypes.shape({
      slug: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }),
  ),
}

SeoHomepageFooterSections.defaultProps = {
  cityLinks: [],
  featuredArticles: [],
}
