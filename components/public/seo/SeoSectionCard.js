import cn from 'classnames'

export default function SeoSectionCard({
  title,
  description,
  children,
  className,
  titleClassName,
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-[#00D1FF]/30 bg-gradient-to-br from-[#12002a]/92 via-[#09001c]/96 to-[#040013]/98 p-5 shadow-[0_0_0_1px_rgba(0,209,255,0.08),0_18px_40px_rgba(6,2,30,0.55)] sm:p-6',
        className,
      )}
    >
      {title ? (
        <h2
          className={cn(
            'text-lg font-semibold tracking-[0.02em] text-[#eaf7ff] sm:text-xl',
            titleClassName,
          )}
        >
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[#b9d9ef] sm:text-base">
          {description}
        </p>
      ) : null}
      <div className={cn(title || description ? 'mt-4' : '')}>{children}</div>
    </section>
  )
}
