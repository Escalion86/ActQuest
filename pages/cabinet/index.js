import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'
import { LOCATIONS } from '@server/serverConstants'
import ConversationEntry from '@components/cabinet/ConversationEntry'
import TelegramLogin from '@components/cabinet/TelegramLogin'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

const CabinetPage = () => {
  const { data: session, status } = useSession()
  const [location, setLocation] = useState(
    () => session?.user?.location ?? defaultLocation
  )
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasSyncedLocation, setHasSyncedLocation] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session?.user?.location && !hasSyncedLocation) {
      setLocation(session.user.location)
      setHasSyncedLocation(true)
    }

    if (!session && hasSyncedLocation) {
      setHasSyncedLocation(false)
      setLocation(defaultLocation)
    }
  }, [session, hasSyncedLocation])

  useEffect(() => {
    if (session && status === 'authenticated') {
      loadMainMenu(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, location])

  const appendEntry = (entry) => {
    setHistory((prev) => [...prev, entry])
  }

  const loadMainMenu = async (resetHistory = false) => {
    if (resetHistory) {
      setHistory([])
    }

    await sendCommand({
      command: 'mainMenu',
      meta: 'Главное меню',
      skipUserEcho: true,
    })
  }

  const sendCommand = async ({ command, message, meta, skipUserEcho } = {}) => {
    if (!session) return

    if (!skipUserEcho && (meta || message)) {
      appendEntry({ type: 'user', text: meta || message })
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/webapp/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location, command, message }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Не удалось выполнить команду')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Не удалось выполнить команду')
      }

      const keyboard = data.result?.keyboard?.inline_keyboard || []

      appendEntry({
        type: 'bot',
        text: data.result?.text,
        keyboard,
        onAction: (button) =>
          sendCommand({
            command: button.callback_data,
            meta: button.text,
          }),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!input.trim()) return

    const value = input.trim()
    const isCommand = value.startsWith('/')

    sendCommand({
      command: isCommand ? value : undefined,
      message: isCommand ? undefined : value,
      meta: value,
    })

    setInput('')
  }

  const handleTelegramAuth = (userData) => {
    console.log('userData :>> ', userData)
    if (!userData) return

    signIn('telegram', {
      data: JSON.stringify(userData),
      location,
      redirect: false,
    }).then((response) => {
      if (response?.error) {
        setError('Не удалось авторизоваться. Попробуйте ещё раз.')
      } else {
        setError(null)
      }
    })
  }

  const renderLogin = () => (
    <TelegramLogin
      availableLocations={availableLocations}
      location={location}
      onLocationChange={setLocation}
      onAuth={handleTelegramAuth}
      isClient={isClient}
    />
  )

  const renderDashboard = () => (
    <div className="flex flex-col w-full max-w-6xl gap-8 mx-auto mt-10">
      <div className="flex flex-col justify-between gap-4 p-6 text-white shadow-lg rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">
            {session?.user?.name ||
              session?.user?.username ||
              'Участник ActQuest'}
          </h2>
          <p className="mt-1 text-sm text-blue-100">
            {LOCATIONS[location]?.townRu
              ? `Регион: ${LOCATIONS[
                  location
                ].townRu[0].toUpperCase()}${LOCATIONS[location].townRu.slice(
                  1
                )}`
              : 'Регион не выбран'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="px-4 py-2 text-sm font-semibold text-white transition border outline-none rounded-xl border-white/40 bg-white/20 hover:bg-white/30"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            {availableLocations.map((item) => (
              <option key={item.key} value={item.key} className="text-gray-900">
                {item.townRu[0].toUpperCase() + item.townRu.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadMainMenu(true)}
            className="px-4 py-2 text-sm font-semibold text-blue-600 transition bg-white rounded-xl hover:bg-blue-50"
          >
            Обновить меню
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 text-sm font-semibold text-white transition border rounded-xl border-white/40 hover:bg-white/20"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6 bg-white shadow-lg rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-primary">
            Диалог с ActQuest
          </h3>
          {isLoading ? (
            <span className="text-sm text-blue-500">Загрузка…</span>
          ) : null}
        </div>
        <div className="h-[420px] overflow-y-auto rounded-2xl bg-gray-50 p-4">
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              Нажмите на кнопку, чтобы получить меню бота.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {history.map((entry, index) => (
                <ConversationEntry key={index} entry={entry} />
              ))}
            </div>
          )}
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 md:flex-row"
        >
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Введите команду или ответ..."
            className="flex-1 px-4 py-3 text-base border border-gray-200 shadow-sm rounded-2xl focus:border-blue-400 focus:outline-none focus:ring"
          />
          <button
            type="submit"
            className="px-6 py-3 text-base font-semibold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-700"
          >
            Отправить
          </button>
        </form>
        {error ? (
          <div className="px-4 py-3 text-sm text-red-600 rounded-xl bg-red-50">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>ActQuest — Личный кабинет</title>
      </Head>
      <div className="min-h-screen bg-[#F5F6F8] pb-16">
        <header className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between max-w-6xl px-4 py-5 mx-auto">
            <Link href="/" className="text-2xl font-bold text-primary">
              ActQuest
            </Link>
            <nav className="flex items-center gap-6 text-sm font-semibold text-gray-600">
              <Link href="/" className="transition hover:text-primary">
                Главная
              </Link>
              <a
                href="https://t.me/ActQuest_dev_bot"
                className="transition hover:text-primary"
                target="_blank"
                rel="noreferrer"
              >
                Бот в Telegram
              </a>
            </nav>
          </div>
        </header>

        <main className="px-4">
          <div className="max-w-4xl mx-auto mt-10 text-center">
            <h1 className="text-3xl font-bold text-primary md:text-4xl">
              Управляйте квестами и командами в веб-интерфейсе ActQuest
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Все функции Telegram-бота, но с большими экранами, быстрым
              доступом к действиям и удобной навигацией.
            </p>
          </div>

          {session ? renderDashboard() : renderLogin()}
        </main>
      </div>
    </>
  )
}

export default CabinetPage
