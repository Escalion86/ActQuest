'use client'

import { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import copyToClipboard from '@helpers/copyToClipboard'
import isUserAdmin from '@helpers/isUserAdmin'

const inputClass = 'block min-h-11 w-full min-w-0 rounded-xl border border-slate-400 bg-white px-3 py-2 text-slate-900 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-100'
const cardClass = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80'
const bytesLabel = bytes => `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} МиБ`
const dateLabel = date => new Date(date).toLocaleString('ru-RU')
const buttonProps = { type: 'button', variant: 'secondary', size: 'lg', className: 'min-h-11' }

function SiteCard({ site, pending, mutate, copy }) {
  const [file, setFile] = useState(null)
  const fileRef = useRef(null)
  async function replace(event) {
    event.preventDefault()
    const body = new FormData()
    body.append('action', 'replace'); body.append('slug', site.slug); body.append('archive', file)
    if (await mutate('POST', body)) { setFile(null); if (fileRef.current) fileRef.current.value = '' }
  }
  return (
    <article className={cardClass} aria-label={`Мини-сайт ${site.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="break-words text-xl font-semibold text-slate-900 dark:text-slate-100">{site.name}</h2>
        <p className="font-semibold text-slate-700 dark:text-slate-200">{site.enabled ? 'Включён' : 'Отключён'}</p>
      </div>
      <a className="mt-2 inline-flex min-h-11 max-w-full items-center break-all text-primary underline dark:text-cyan-200" href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Файлов: {site.fileCount} · {bytesLabel(site.bytes)}. Версия: {dateLabel(site.versionAt)}. Изменён: {dateLabel(site.updatedAt)}.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <CabinetButton {...buttonProps} disabled={pending} onClick={() => copy(site.url)}>Копировать ссылку</CabinetButton>
        <CabinetButton {...buttonProps} disabled={pending} onClick={() => mutate('PATCH', { slug: site.slug, action: site.enabled ? 'disable' : 'enable' })}>{site.enabled ? 'Отключить' : 'Включить'}</CabinetButton>
        <CabinetButton {...buttonProps} disabled={pending || !site.canRollback} onClick={() => mutate('PATCH', { slug: site.slug, action: 'rollback' })}>Откатить версию</CabinetButton>
      </div>
      <form onSubmit={replace} className="mt-5 space-y-3">
        <label htmlFor={`replace-${site.slug}`} className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Заменить ZIP ({site.slug})</label>
        <input ref={fileRef} id={`replace-${site.slug}`} type="file" accept=".zip,application/zip" required disabled={pending} onChange={event => setFile(event.target.files?.[0] || null)} className={inputClass + ' file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:px-3'} />
        <CabinetButton type="submit" variant="secondary" size="lg" className="min-h-11" disabled={pending || !file}>Заменить архив</CabinetButton>
        <p className="text-sm text-slate-600 dark:text-slate-300">Ссылка и состояние включения сохранятся. Доступен откат на одну предыдущую версию.</p>
      </form>
    </article>
  )
}
const siteShape = PropTypes.shape({ slug: PropTypes.string.isRequired, name: PropTypes.string.isRequired, url: PropTypes.string.isRequired, enabled: PropTypes.bool.isRequired, canRollback: PropTypes.bool.isRequired, fileCount: PropTypes.number.isRequired, bytes: PropTypes.number.isRequired, versionAt: PropTypes.string.isRequired, updatedAt: PropTypes.string.isRequired })
SiteCard.propTypes = { site: siteShape.isRequired, pending: PropTypes.bool.isRequired, mutate: PropTypes.func.isRequired, copy: PropTypes.func.isRequired }

export default function MiniSitesPageClient({ session, initialData }) {
  const [data, setData] = useState(initialData)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [file, setFile] = useState(null)
  const busy = useRef(false)
  const fileRef = useRef(null)
  const allowed = isUserAdmin({ role: session?.user?.role })

  async function mutate(method, body) {
    if (busy.current) return false
    busy.current = true; setPending(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/cabinet/admin/mini-sites', { method, cache: 'no-store', ...(method === 'PATCH' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { body }) })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Не удалось сохранить мини-сайт.')
      setData(result.data); setMessage('Изменения сохранены в хранилище. Доступность адреса зависит от настройки DNS, TLS и nginx.')
      return true
    } catch (failure) { setError(failure.message || 'Ошибка сети. Повторите попытку.'); return false }
    finally { busy.current = false; setPending(false) }
  }
  async function create(event) {
    event.preventDefault()
    const body = new FormData()
    body.append('action', 'create'); body.append('name', name); body.append('slug', slug); body.append('archive', file)
    if (await mutate('POST', body)) { setName(''); setSlug(''); setFile(null); if (fileRef.current) fileRef.current.value = '' }
  }
  async function copy(url) {
    setError(''); setMessage('')
    try { await copyToClipboard(url); setMessage('Ссылка скопирована. Это не подтверждает доступность сайта.') }
    catch { setError(`Не удалось скопировать. Выделите и скопируйте адрес вручную: ${url}`) }
  }
  return (
    <CabinetLayout title="HTML мини-сайты" description="Публикация готовых статических страниц на отдельных поддоменах." activePage="admin">
      <div className="min-w-0 space-y-5 text-slate-900 dark:text-slate-100" aria-busy={pending}>
        {!allowed ? <p role="alert">Доступ только для администраторов и разработчиков.</p> : <>
          <p className="text-sm text-slate-700 dark:text-slate-300">ZIP до 20 МиБ, до 1000 записей и 100 МиБ после распаковки. Нужен index.html. Загружаются только HTML, CSS, браузерный JavaScript и статические ресурсы.</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">Для публичного доступа оператор должен настроить DNS, TLS и nginx. На основном сайте предпросмотра HTML нет.</p>
          {!data.configured && <p role="alert" className={cardClass}>{data.configurationError} Оператору: см. docs/html-mini-sites.md. После настройки обновите страницу.</p>}
          {error && <p role="alert" className="break-words rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-400 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100">{message}</p>}
          <section className={cardClass} aria-labelledby="create-mini-site">
            <h2 id="create-mini-site" className="text-xl font-semibold">Новый мини-сайт</h2>
            <form onSubmit={create} className="mt-4 space-y-4">
              <fieldset disabled={pending || !data.configured} className="min-w-0 space-y-4">
                <legend className="sr-only">Данные нового мини-сайта</legend>
                <div><label htmlFor="mini-name" className="mb-2 block font-semibold">Название</label><input id="mini-name" value={name} onChange={event => setName(event.target.value)} required maxLength={100} className={inputClass} /></div>
                <div><label htmlFor="mini-slug" className="mb-2 block font-semibold">Короткий адрес</label><input id="mini-slug" value={slug} onChange={event => setSlug(event.target.value)} required maxLength={63} pattern={'[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?'} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="mini-slug-help" className={inputClass} /><p id="mini-slug-help" className="mt-2 text-sm text-slate-600 dark:text-slate-300">Строчные латинские буквы, цифры и дефис; по краям — буква или цифра. Адрес изменить нельзя.</p></div>
                <div><label htmlFor="mini-archive" className="mb-2 block font-semibold">ZIP-архив</label><input ref={fileRef} id="mini-archive" type="file" accept=".zip,application/zip" required onChange={event => setFile(event.target.files?.[0] || null)} className={inputClass + ' file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:px-3'} /></div>
                <CabinetButton type="submit" size="lg" className="min-h-11" disabled={pending || !data.configured || !file}>{pending ? 'Сохранение…' : 'Опубликовать мини-сайт'}</CabinetButton>
              </fieldset>
            </form>
          </section>
          <section aria-label="Сохранённые мини-сайты" className="space-y-5">
            {data.sites.length ? data.sites.map(site => <SiteCard key={site.slug} site={site} pending={pending} mutate={mutate} copy={copy} />) : <p className="text-slate-700 dark:text-slate-300">Мини-сайтов пока нет.</p>}
          </section>
        </>}
      </div>
    </CabinetLayout>
  )
}
MiniSitesPageClient.propTypes = { session: PropTypes.shape({ user: PropTypes.shape({ role: PropTypes.string }) }).isRequired, initialData: PropTypes.shape({ configured: PropTypes.bool.isRequired, configurationError: PropTypes.string, sites: PropTypes.arrayOf(siteShape).isRequired }).isRequired }
