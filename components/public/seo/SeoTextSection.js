import cn from 'classnames'

export default function SeoTextSection({
  title,
  paragraphs = [],
  listItems = [],
  ordered = false,
  className,
}) {
  const ListTag = ordered ? 'ol' : 'ul'

  return (
    <section className={cn('space-y-3', className)}>
      {title ? (
        <h3 className="text-base font-semibold tracking-[0.01em] text-[#eaf7ff] sm:text-lg">
          {title}
        </h3>
      ) : null}
      {Array.isArray(paragraphs)
        ? paragraphs.map((text, index) => (
            <p key={`${title || 'paragraph'}-${index}`} className="text-[#b9d9ef]">
              {text}
            </p>
          ))
        : null}
      {Array.isArray(listItems) && listItems.length > 0 ? (
        <ListTag
          className={cn(
            'space-y-2 pl-5 text-[#cbe8ff]',
            ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {listItems.map((item, index) => (
            <li key={`${title || 'list'}-${index}`}>{item}</li>
          ))}
        </ListTag>
      ) : null}
    </section>
  )
}
