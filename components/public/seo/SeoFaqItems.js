import PropTypes from 'prop-types'

export default function SeoFaqItems({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article key={item.question}>
          <h3 className="text-base font-semibold text-[#eaf7ff]">{item.question}</h3>
          <p className="mt-1 text-[#b9d9ef]">{item.answer}</p>
        </article>
      ))}
    </div>
  )
}

SeoFaqItems.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      question: PropTypes.string.isRequired,
      answer: PropTypes.string.isRequired,
    }),
  ),
}

SeoFaqItems.defaultProps = {
  items: [],
}
