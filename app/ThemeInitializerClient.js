'use client'

import { useEffect } from 'react'

export default function ThemeInitializerClient() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cabinet-theme')
      const systemDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      const theme =
        saved === 'dark' || saved === 'light'
          ? saved
          : systemDark
            ? 'dark'
            : 'light'

      const root = document.documentElement
      root.setAttribute('data-theme', theme)
      root.classList.toggle('dark', theme === 'dark')
      root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
      root.setAttribute('data-theme-ready', '1')
      document.cookie = `cabinet-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch {
      const root = document.documentElement
      root.setAttribute('data-theme', 'light')
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
      root.setAttribute('data-theme-ready', '1')
      document.cookie =
        'cabinet-theme=light; Path=/; Max-Age=31536000; SameSite=Lax'
    }
  }, [])

  return null
}
