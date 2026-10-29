import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { listSites, mutateSite } from '@server/miniSites/storage'
import { boundedBody } from '@server/miniSites/http'
import { LIMITS, MiniSiteError, fail, trustedOrigin } from '@server/miniSites/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const response = (payload, status = 200) => {
  const result = status === 200
    ? NextResponse.json(payload, { status: 200 })
    : NextResponse.json(payload, { status })
  result.headers.set('Cache-Control', 'no-store')
  result.headers.set('X-Content-Type-Options', 'nosniff')
  return result
}
async function authorize(request, mutation = false) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) fail('Недостаточно прав.', 403)
  if (mutation && request.headers.get('origin') !== trustedOrigin()) fail('Недопустимый Origin запроса.', 403)
}
function report(error) {
  if (error instanceof MiniSiteError) return response({ success: false, error: error.message }, error.status)
  const disk = ['ENOSPC', 'EDQUOT'].includes(error.code)
  console.error('[mini-sites] Ошибка операции:', error.code || 'IO')
  return response({ success: false, error: disk ? 'Недостаточно места на диске. Текущая версия сохранена.' : 'Не удалось выполнить операцию с мини-сайтом. Проверьте настройку хранилища.' }, disk ? 507 : 503)
}
function fieldsOnly(keys, allowed) {
  if (keys.some(key => !allowed.includes(key)) || new Set(keys).size !== keys.length) fail('Недопустимые или повторяющиеся поля запроса.')
}
const operationSignal = request => AbortSignal.any([AbortSignal.timeout(LIMITS.timeout), ...(request.signal ? [request.signal] : [])])
export async function GET(request) {
  try { await authorize(request); return response({ success: true, data: await listSites() }) } catch (error) { return report(error) }
}
export async function POST(request) {
  try {
    await authorize(request, true)
    const contentType = request.headers.get('content-type') || ''
    if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) fail('Нужен multipart/form-data с ZIP.', 415)
    const signal = operationSignal(request)
    const body = await boundedBody(request, LIMITS.body, signal)
    let form
    try { form = await new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': contentType }, body }).formData() } catch { fail('Некорректная multipart-форма.') }
    const action = form.get('action')
    if (!['create', 'replace'].includes(action)) fail('Неизвестное действие загрузки.')
    fieldsOnly([...form.keys()], action === 'create' ? ['action', 'slug', 'name', 'archive'] : ['action', 'slug', 'archive'])
    const file = form.get('archive')
    if (!file || typeof file.arrayBuffer !== 'function' || file.size > LIMITS.archive || !file.size) fail('Выберите ZIP размером до 20 МиБ.', 413)
    const result = await mutateSite({ action, slug: form.get('slug'), name: form.get('name'), archive: Buffer.from(await file.arrayBuffer()), signal })
    return response({ success: true, data: result })
  } catch (error) { return report(error) }
}
export async function PATCH(request) {
  try {
    await authorize(request, true)
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) fail('Нужен application/json.', 415)
    const signal = operationSignal(request)
    const raw = await boundedBody(request, LIMITS.json, signal)
    let body
    try { body = JSON.parse(raw.toString('utf8')) } catch { fail('Некорректный JSON.') }
    if (!body || Array.isArray(body) || typeof body !== 'object') fail('Нужен объект JSON.')
    fieldsOnly(Object.keys(body), ['action', 'slug'])
    if (!['enable', 'disable', 'rollback'].includes(body.action)) fail('Неизвестное действие.')
    return response({ success: true, data: await mutateSite({ ...body, signal }) })
  } catch (error) { return report(error) }
}
