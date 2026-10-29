'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import PropTypes from 'prop-types'
import { useSession } from 'next-auth/react'
import { ASSISTANT_CITIES, isAssistantCabinet, isAssistantVisible, resolveInitialAssistantCity } from '../../helpers/assistantVisibility.mjs'

import { ASSISTANT_QUICK_QUESTIONS as quickQuestions, strictAssistantIntent } from '../../helpers/assistantQuestions.mjs'
const buttonClass = 'rounded-xl border border-cyan-300/30 px-3 py-2 text-left text-sm text-slate-100 hover:bg-cyan-300/10 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50'

function AssistantPanel({ initialCity, pathname }) {
  const [open, setOpen] = useState(false)
  const [city, setCity] = useState(initialCity)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [gameId, setGameId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const launcher = useRef(null)
  const dialog = useRef(null)
  const log = useRef(null)
  const pending = useRef(null)
  const [assistantAiEnabled, setAssistantAiEnabled] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    let inflight = false
    const controller = new AbortController()
    const refresh = async () => {
      if (inflight) return
      inflight = true
      let enabled = false
      try {
        const response = await fetch('/api/assistant/settings', { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        enabled = response.ok && data.assistantAiEnabled === true
      } catch { /* Ошибка загрузки означает OFF. */ }
      if (active) { setAssistantAiEnabled(enabled); if (!enabled) setQuestion('') }
      inflight = false
    }
    void refresh()
    const interval = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { active = false; controller.abort(); clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [open])

  useEffect(() => {
    const button = launcher.current
    if (!button) return
    const root = document.documentElement
    const properties = ['--aq-site-audio-right', '--aq-site-audio-bottom']
    const previous = properties.map((name) => root.style.getPropertyValue(name))
    const positionAudio = () => {
      const rect = button.getBoundingClientRect()
      // Звук располагается слева от реальной ширины кнопки, а не фиксированной оценки.
      root.style.setProperty(properties[0], `${window.innerWidth - rect.left + 12}px`)
      root.style.setProperty(properties[1], `${window.innerHeight - rect.bottom + (rect.height - 44) / 2}px`)
    }
    positionAudio()
    const observer = new ResizeObserver(positionAudio)
    observer.observe(button)
    window.addEventListener('resize', positionAudio)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', positionAudio)
      properties.forEach((name, index) => {
        if (previous[index]) root.style.setProperty(name, previous[index])
        else root.style.removeProperty(name)
      })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    dialog.current?.focus()
    const button = launcher.current
    return () => {
      pending.current?.abort()
      pending.current = null
      button?.focus()
    }
  }, [open])
  useEffect(() => {
    // При выборе города или отключении быстрой кнопки браузер может сбросить
    // фокус на body. Возвращаем его в окно, но не в поле и не поверх ручного ввода.
    if (open && document.activeElement === document.body) dialog.current?.focus()
  }, [open, city, busy, assistantAiEnabled])
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }) }, [messages, busy, error])
  useEffect(() => () => pending.current?.abort(), [])

  function close() {
    pending.current?.abort()
    pending.current = null
    setBusy(false)
    setAssistantAiEnabled(false); setQuestion('')
    setOpen(false)
  }
  function chooseCity(nextCity) {
    if (!Object.hasOwn(ASSISTANT_CITIES, nextCity)) return
    setCity(nextCity); setMessages([]); setGameId(null); setQuestion(''); setError('')
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (event.key !== 'Tab') return
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')]
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  async function ask(text, selectedGameId = gameId) {
    const value = text.trim()
    if (!Object.hasOwn(ASSISTANT_CITIES, city) || !value || value.length > 700 || pending.current) return
    if (!assistantAiEnabled && !strictAssistantIntent(value)) return
    const controller = new AbortController()
    pending.current = controller
    const timer = setTimeout(() => controller.abort(), 18000)
    const history = messages.filter((message) => message.role === 'user').slice(-4).map((message) => ({ role: 'user', content: message.text.slice(0, 500) }))
    setMessages((items) => [...items.slice(-9), { role: 'user', text: value }])
    setQuestion(''); setError(''); setBusy(true)
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, question: value, history, pathname, ...(selectedGameId ? { gameId: selectedGameId } : {}) }), signal: controller.signal,
      })
      const data = await response.json()
      if (pending.current !== controller) return
      if (data.code === 'ASSISTANT_AI_DISABLED') { setAssistantAiEnabled(false); setQuestion('') }
      if (!response.ok || !data.success) { setError(data.error || 'Не удалось получить ответ. Попробуйте позже.'); return }
      setMessages((items) => [...items.slice(-9), { role: 'assistant', text: data.answer, mode: data.mode, links: data.links || [], games: data.games || [], notice: data.notice }])
    } catch (failure) {
      if (pending.current === controller) setError(failure.name === 'AbortError' ? 'Помощник не успел ответить. Попробуйте позже.' : failure.message === 'Failed to fetch' ? 'Не удалось подключиться. Проверьте интернет и попробуйте позже.' : 'Не удалось получить ответ. Попробуйте позже.')
    } finally {
      clearTimeout(timer)
      if (pending.current === controller) { pending.current = null; setBusy(false) }
    }
  }

  return (
    <div className="fixed z-[100] text-slate-100" style={{ right: 'max(12px, env(safe-area-inset-right))', bottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      {open && (
        <section ref={dialog} id="actquest-assistant-dialog" role="dialog" tabIndex={-1} aria-label="Помощник ActQuest" onKeyDown={onKeyDown}
          className="mb-3 flex flex-col overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#100821] shadow-2xl"
          style={{ width: 'min(390px, calc(100vw - 24px))', maxHeight: 'min(680px, calc(100dvh - 100px))' }}>
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4">
            <div><h2 className="font-semibold">Помощник ActQuest</h2></div>
            <button type="button" className={buttonClass} onClick={close} aria-label="Закрыть помощника">×</button>
          </header>
          {!city ? (
            <div className="space-y-3 p-4">
              <p className="text-sm">В каком городе хотите играть?</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ASSISTANT_CITIES).map(([key, title]) => <button key={key} data-assistant-city={key} type="button" className={buttonClass} onClick={() => chooseCity(key)}>{title}</button>)}
              </div>
            </div>
          ) : <>
          <div className="shrink-0 px-4 pt-3">
            <label className="flex items-center gap-3 text-sm">Город
              <select aria-label="Город помощника" value={city} disabled={busy} className="min-w-0 flex-1 rounded-lg border border-white/20 bg-[#100821] p-2" onChange={(event) => chooseCity(event.target.value)}>
                {Object.entries(ASSISTANT_CITIES).map(([key, title]) => <option key={key} value={key}>{title}</option>)}
              </select>
            </label>
          </div>
          <div ref={log} role="log" aria-live="polite" aria-relevant="additions text" aria-busy={busy} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
            {messages.length === 0 && <p className="text-sm text-slate-300">Помогу выбрать игру и разобраться с участием.</p>}
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((text) => <button key={text} type="button" disabled={busy} className={buttonClass} onClick={() => ask(text)}>{text}</button>)}
            </div>
            {messages.map((message, index) => (
              <div key={index} className={`rounded-xl p-3 text-sm ${message.role === 'user' ? 'ml-6 bg-cyan-300/10' : 'mr-2 bg-white/5'}`}>
                <p className="mb-1 text-xs text-slate-400">{message.role === 'user' ? 'Вы' : 'Помощник'}</p>
                <p className="whitespace-pre-wrap break-words">{message.text}</p>
                {message.games?.length > 0 && <><p className="mt-3 text-slate-300">Нажмите на игру, чтобы узнать подробности</p><ul className="mt-2 space-y-2">{message.games.map((game) => <li key={game.gameId}><button type="button" disabled={busy} className={buttonClass} onClick={() => { setGameId(game.gameId); ask('Подробнее об игре', game.gameId) }}>{game.title}</button></li>)}</ul></>}
                {message.notice && <p className="mt-2 text-xs text-amber-200">{message.notice}</p>}
                {message.links?.length > 0 && <ul className="mt-3 space-y-2">{message.links.map((link) => <li key={link.href}><a href={link.href} className="text-cyan-200 underline underline-offset-4">{link.title}</a></li>)}</ul>}
              </div>
            ))}
            {busy && <p role="status" className="text-sm text-cyan-200">Готовлю ответ…</p>}
            {error && <p role="alert" className="rounded-lg bg-amber-300/10 p-3 text-sm text-amber-100">{error}</p>}
          </div>
          {assistantAiEnabled ? <form className="shrink-0 border-t border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); ask(question) }}>
            <label htmlFor="actquest-assistant-question" className="text-xs text-slate-300">Ваш вопрос об ActQuest</label>
            <textarea id="actquest-assistant-question" rows={2} maxLength={700} value={question} onChange={(event) => setQuestion(event.target.value)}
              className="mt-1 w-full resize-none rounded-xl border border-white/20 bg-white/5 p-2 text-base focus-visible:outline-2 focus-visible:outline-cyan-300" />
            <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{question.length}/700</span><button type="submit" disabled={busy || !question.trim()} className={buttonClass}>Отправить</button></div>
          </form> : <p className="shrink-0 border-t border-white/10 p-3 text-sm text-slate-300">Выберите вопрос из списка</p>}
          </>}
        </section>
      )}
      <button ref={launcher} type="button" onClick={() => open ? close() : setOpen(true)} aria-label="Открыть помощника ActQuest" aria-expanded={open} aria-controls="actquest-assistant-dialog"
        className="ml-auto block rounded-full border border-cyan-300/50 bg-[#160b2d] px-5 py-3 text-sm font-semibold shadow-lg hover:bg-[#231340] focus-visible:outline-2 focus-visible:outline-cyan-300">Помощник ActQuest</button>
    </div>
  )
}
AssistantPanel.propTypes = { initialCity: PropTypes.oneOf(Object.keys(ASSISTANT_CITIES)), pathname: PropTypes.string.isRequired }

export default function ActQuestAssistant() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  if (!isAssistantVisible(pathname) || status === 'loading') return null
  const cabinet = isAssistantCabinet(pathname)
  const sessionCity = session?.user?.location
  const city = resolveInitialAssistantCity(pathname, sessionCity)
  const userKey = session?.user?.globalUserId ?? session?.user?.userId ?? session?.user?._id ?? session?.user?.id ?? session?.user?.telegramId ?? session?.user?.vkId ?? session?.user?.phone ?? session?.user?.email ?? 'anonymous'
  // Смена пользователя, logout, города или public/cabinet сбрасывает диалог и pending.
  return <AssistantPanel key={`${status}:${userKey}:${sessionCity}:${city}:${cabinet ? 'cabinet' : 'public'}`} initialCity={city} pathname={pathname} />
}
