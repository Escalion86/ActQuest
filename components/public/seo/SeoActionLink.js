import Link from 'next/link'
import cn from 'classnames'

const variants = {
  primary:
    'border-[#00D1FF]/55 bg-[#00D1FF]/14 text-[#b8f5ff] hover:bg-[#00D1FF]/22',
  secondary:
    'border-[#7A00FF]/45 bg-[#7A00FF]/12 text-[#e6d6ff] hover:bg-[#7A00FF]/20',
  ghost:
    'border-[#9ecfff]/35 bg-transparent text-[#cbe8ff] hover:bg-white/5',
}

export default function SeoActionLink({
  href,
  children,
  className,
  variant = 'primary',
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex rounded-xl border px-4 py-2 text-sm font-semibold transition',
        variants[variant] || variants.primary,
        className,
      )}
    >
      {children}
    </Link>
  )
}
