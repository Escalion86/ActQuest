import Link from 'next/link'

export const metadata = {
  title: 'Страница не найдена',
}

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <h1 className="mb-2 text-7xl font-bold text-gray-300 dark:text-gray-700">
        404
      </h1>
      <p className="mb-6 text-lg text-gray-600 dark:text-gray-400">
        Страница не найдена
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          На главную
        </Link>
        <Link
          href="/cabinet"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          В кабинет
        </Link>
      </div>
    </div>
  )
}
