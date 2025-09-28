import cn from 'classnames'

const createTextTag = (Tag, baseClasses, defaultBold = true) => {
  const TextTag = ({ className, style, children, bold = defaultBold }) => (
    <Tag
      className={cn(baseClasses, { 'font-bold': bold }, className)}
      style={style}
    >
      {children}
    </Tag>
  )

  TextTag.displayName = `TextTag(${typeof Tag === 'string' ? Tag.toUpperCase() : 'Custom'})`

  return TextTag
}

export const H1 = createTextTag('h1', 'text-3xl text-center tablet:text-4xl')
export const H2 = createTextTag('h2', 'text-2xl text-center tablet:text-3xl')
export const H3 = createTextTag('h3', 'text-lg text-center tablet:text-xl')
export const H4 = createTextTag('h4', 'text-lg text-center')
export const P = createTextTag('p', 'text-base laptop:text-xl', false)
