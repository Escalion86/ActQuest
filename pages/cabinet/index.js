import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'
import { LOCATIONS } from '@server/serverConstants'
import TelegramLogin from '@components/cabinet/TelegramLogin'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

const formatText = (text) =>
  (text || '')
    .split('\n')
    .map((part) => part.trim())
    .join('\n')

const buildBlocksFromResult = (result) => {
  if (!result) return []

  const blocks = []
  const formattedText = formatText(result.text)

  if (formattedText) {
    blocks.push({
      id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'text',
      content: formattedText,
    })
  }

  const media = []

  if (Array.isArray(result.images)) {
    media.push(...result.images.filter(Boolean))
  }

  if (Array.isArray(result.photos)) {
    media.push(...result.photos.filter(Boolean))
  }

  if (result.photo) {
    media.push(result.photo)
  }

  if (result.image) {
    media.push(result.image)
  }

  media.forEach((url, index) => {
    blocks.push({
      id: `image-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      type: 'image',
      content: url,
    })
  })

  return blocks
}

const CabinetPage = () => {
  const { data: session, status, update: updateSession } = useSession()
  const [location, setLocation] = useState(() => session?.user?.location ?? defaultLocation)
  const [input, setInput] = useState('')
  const [displayBlocks, setDisplayBlocks] = useState([])
  const [keyboardButtons, setKeyboardButtons] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasSyncedLocation, setHasSyncedLocation] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [theme, setTheme] = useState('light')
  const lastInteractionRef = useRef('bot')
  const displayRef = useRef(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const storedTheme = window.localStorage.getItem('aq-theme')

    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
      return
    }

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    setTheme(prefersDark ? 'dark' : 'light')
  }, [isClient])

  useEffect(() => {
    if (!isClient) return

    window.document.documentElement.classList.toggle('dark', theme === 'dark')
    window.document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('aq-theme', theme)
  }, [theme, isClient])

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
    if (!session) {
      setDisplayBlocks([])
      setKeyboardButtons([])
      lastInteractionRef.current = 'bot'
    }
  }, [session])

  useEffect(() => {
    if (session && status === 'authenticated') {
      loadMainMenu({ resetDisplay: true, initiatedByUser: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status])

  const loadMainMenu = async ({ resetDisplay = false, initiatedByUser = true, targetLocation } = {}) => {
    await sendCommand({
      command: 'mainMenu',
      meta: 'Главное меню',
      skipUserEcho: true,
      initiatedByUser,
      resetDisplay,
      targetLocation,
    })
  }

  const sendCommand = async ({
    command,
    message,
    meta: _meta,
    skipUserEcho: _skipUserEcho,
    initiatedByUser = true,
    resetDisplay = false,
    targetLocation,
  } = {}) => {
    if (!session) return

    const shouldAppend = !initiatedByUser && !resetDisplay && lastInteractionRef.current === 'bot'

    if (initiatedByUser) {
      lastInteractionRef.current = 'user'
    }

    if (resetDisplay) {
      setDisplayBlocks([])
      setKeyboardButtons([])
    }

    setIsLoading(true)
    setError(null)

    try {
      const resolvedLocation = targetLocation ?? location
      const response = await fetch('/api/webapp/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location: resolvedLocation, command, message }),
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
      setKeyboardButtons(keyboard)

      const blocks = buildBlocksFromResult(data.result)

      if (blocks.length > 0) {
        setDisplayBlocks((prev) => (shouldAppend ? [...prev, ...blocks] : blocks))
      } else if (!shouldAppend) {
        setDisplayBlocks([])
      }

      lastInteractionRef.current = 'bot'
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

  const handleKeyboardAction = (button) => {
    if (!button) return

    if (button.url) {
      window.open(button.url, '_blank', 'noopener,noreferrer')
      return
    }

    sendCommand({
      command: button.callback_data,
      meta: button.text,
    })
  }

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleLocationChange = (value) => {
    setLocation(value)
    loadMainMenu({ resetDisplay: true, initiatedByUser: true, targetLocation: value })
  }

  useEffect(() => {
    if (!displayRef.current) return
    displayRef.current.scrollTop = displayRef.current.scrollHeight
  }, [displayBlocks])

  const handleTelegramAuth = async (userData) => {
    if (!userData) return

    try {
      setError(null)
      const payload = JSON.stringify(userData)
      const result = await signIn('telegram', {
        redirect: false,
        callbackUrl: `${window.location.origin}/cabinet`,
        data: payload,
        location,
      })

      if (result?.error) {
        let errorMessage = result.error

        if (result.error === 'CredentialsSignin') {
          try {
            const debugResponse = await fetch('/api/webapp/telegram/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ location, data: payload }),
            })

            const debugData = await debugResponse.json().catch(() => null)

            if (debugData) {
              if (debugData.success) {
                errorMessage =
                  'Авторизация прошла успешно, но не удалось обновить сессию. Попробуйте перезагрузить страницу.'
              } else if (debugData.errorMessage) {
                errorMessage = debugData.errorMessage
              } else if (debugData.errorCode) {
                errorMessage = `Ошибка авторизации Telegram (${debugData.errorCode}).`
              }
            }
          } catch (debugError) {
            console.error('Telegram auth debug error', debugError)
          }
        }

        throw new Error(errorMessage)
      }

      await updateSession()
    } catch (authError) {
      console.error('Telegram auth error', authError)
      setError(authError.message || 'Не удалось авторизоваться. Попробуйте ещё раз.')
    }
  }

  const renderLogin = () => (
    <TelegramLogin
      availableLocations={availableLocations}
      location={location}
      onLocationChange={handleLocationChange}
      onAuth={handleTelegramAuth}
      isClient={isClient}
    />
  )

  const renderDashboard = () => (
    <div className="flex flex-col w-full max-w-5xl gap-8 mx-auto mt-10">
      <div className="flex flex-col justify-between gap-4 p-6 text-white shadow-lg rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 dark:from-slate-700 dark:to-slate-900 dark:shadow-slate-950/40 lg:flex-row lg:items-center">
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
            className="px-4 py-2 text-sm font-semibold text-white transition border outline-none rounded-xl border-white/40 bg-white/20 hover:bg-white/30 dark:border-white/20"
            value={location}
            onChange={(event) => handleLocationChange(event.target.value)}
          >
            {availableLocations.map((item) => (
              <option key={item.key} value={item.key} className="text-gray-900">
                {item.townRu[0].toUpperCase() + item.townRu.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadMainMenu({ resetDisplay: true, initiatedByUser: true })}
            className="px-4 py-2 text-sm font-semibold text-blue-600 transition bg-white rounded-xl hover:bg-blue-50 dark:text-blue-100 dark:bg-white/10 dark:hover:bg-white/20"
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

      <div className="flex flex-col gap-6 p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-primary dark:text-white">
            Ответ сервера ActQuest
          </h3>
          {isLoading ? (
            <span className="text-sm text-blue-500 dark:text-blue-300">Загрузка…</span>
          ) : null}
        </div>
        <div
          ref={displayRef}
          className="min-h-[260px] max-h-[480px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left text-gray-800 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100"
        >
          {displayBlocks.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-slate-400">
              Нажмите кнопку или отправьте сообщение, чтобы получить ответ сервера.
            </div>
          ) : (
            displayBlocks.map((block, index) => {
              if (block.type === 'image') {
                return (
                  <div key={block.id} className={index > 0 ? 'mt-4' : ''}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={block.content}
                      alt="Изображение от сервера ActQuest"
                      className="w-full rounded-2xl border border-gray-200 object-contain dark:border-slate-700"
                    />
                  </div>
                )
              }

              return (
                <div
                  key={block.id}
                  className={`leading-relaxed ${index > 0 ? 'mt-4' : ''}`}
                  dangerouslySetInnerHTML={{ __html: block.content.replace(/\n/g, '<br />') }}
                />
              )
            })
          )}
        </div>

        {keyboardButtons.length ? (
          <div className="flex flex-col gap-2">
            {keyboardButtons.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="flex flex-wrap gap-2">
                {row.map((button) => {
                  if (button.url) {
                    return (
                      <a
                        key={button.url}
                        href={button.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                      >
                        {button.text}
                      </a>
                    )
                  }

                  return (
                    <button
                      key={button.callback_data || button.text}
                      className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                      onClick={() => handleKeyboardAction(button)}
                      type="button"
                      disabled={isLoading}
                    >
                      {button.text}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Введите команду или ответ..."
            className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-base shadow-sm focus:border-blue-400 focus:outline-none focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            Отправить
          </button>
        </form>
        {error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
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
      <div className="min-h-screen bg-[#F5F6F8] pb-16 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-gray-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
            <Link href="/" className="text-2xl font-bold text-primary transition-colors dark:text-white">
              ActQuest
            </Link>
            <nav className="flex items-center gap-6 text-sm font-semibold text-gray-600 dark:text-slate-300">
              <Link href="/" className="transition hover:text-primary dark:hover:text-white">
                Главная
              </Link>
              <a
                href="https://t.me/ActQuest_dev_bot"
                className="transition hover:text-primary dark:hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Бот в Telegram
              </a>
            </nav>
            <button
              type="button"
              onClick={handleThemeToggle}
              className="ml-6 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
            >
              {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            </button>
          </div>
        </header>

        <main className="px-4">
          <div className="mx-auto mt-10 max-w-4xl text-center">
            <h1 className="text-3xl font-bold text-primary transition-colors dark:text-white md:text-4xl">
              Управляйте квестами и командами в веб-интерфейсе ActQuest
            </h1>
            <p className="mt-4 text-lg text-gray-600 transition-colors dark:text-slate-300">
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
