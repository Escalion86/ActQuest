import './globals.css'

export const metadata = {
  title: 'ActQuest',
  description: 'ActQuest App Router Shell',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}

