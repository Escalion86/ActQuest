import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import { startTelefonipReverseCall, startTelefonipSmsCode } from '@helpers/telefonipAuthCalls'
import { createPhoneVerificationCodeHash } from '@helpers/phoneVerificationCode'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import { authOptions } from '@server/auth/authOptions'
import { LOCATIONS } from '@server/serverConstants'

const COOLDOWN_MS = 60 * 1000
const errorJson = (status, type, message) => NextResponse.json(
  { success: false, error: { type, message } }, { status },
)
const rateLimit = () => errorJson(429, 'rate_limit', 'Слишком частый запрос. Повторите через минуту.')
const isDailyLimit = value => /number of shipments|quantity limit per day|limit per day/i.test(String(value || ''))

// Оба маршрута запуска используют одни guards и одну блокировку отправки.
export async function startPhoneVerification(request, { smsOnly = false } = {}) {
  const body = await request.json().catch(() => ({}))
  const phone = normalizeAuthPhone(body?.phone)
  const flow = String(body?.flow || 'register').trim().toLowerCase()
  const location = typeof body?.location === 'string' ? body.location.trim().toLowerCase() : null
  if (!phone) return errorJson(400, 'phone', 'Укажите корректный номер телефона.')
  if (!['register', 'recovery', 'change_phone'].includes(flow)) return errorJson(400, 'flow', 'Некорректный тип операции.')
  if ((flow === 'register' && !location) || (location && (!Object.hasOwn(LOCATIONS, location) || LOCATIONS[location].hidden))) {
    return errorJson(400, 'location', 'Выберите доступный город для регистрации.')
  }

  try {
    const controls = await getSiteAccessControlsByLocation(location)
    if (flow === 'register' && !controls.allowSiteRegistration) return errorJson(403, 'forbidden', 'Регистрация на сайте временно отключена для выбранного региона.')
    if (flow === 'recovery' && !controls.allowSiteAuth) return errorJson(403, 'forbidden', 'Восстановление пароля временно недоступно.')
    // Оба способа доступны всегда: приоритет решает только, какой предложить первым.
    const method = smsOnly || (body?.method === 'preferred' && controls.phoneVerificationPrimaryMethod === 'sms') ? 'sms' : 'call'
    const db = await dbConnectGlobal()
    if (!db) return errorJson(503, 'unknown', 'Не удалось подключиться к базе. Попробуйте позже.')
    const Users = db.model('Users')
    const Verifications = db.model('PhoneVerifications')
    const existingUser = await Users.findOne({ phone }).select({ _id: 1, passwordHash: 1 }).lean()
    if (flow === 'change_phone') {
      const session = await getServerSession(authOptions)
      if (!session?.user) return errorJson(401, 'auth', 'Необходима авторизация.')
      const filter = resolveSessionUserFilter(session.user)
      if (!filter) return errorJson(400, 'auth', 'Не удалось определить пользователя.')
      const currentUser = await Users.findOne(filter).select({ _id: 1, phone: 1 }).lean()
      if (!currentUser?._id) return errorJson(404, 'not_found', 'Пользователь не найден.')
      if (Number(currentUser.phone) === phone) return errorJson(400, 'phone', 'Указан текущий номер телефона.')
      if (existingUser && String(existingUser._id) !== String(currentUser._id)) return errorJson(400, 'phone', 'Такой номер уже зарегистрирован в другом профиле.')
    }
    if (flow === 'register' && existingUser?.passwordHash) return errorJson(400, 'phone', 'Такой номер уже зарегистрирован. Войдите по номеру телефона или через VK.')
    if (flow === 'recovery' && !existingUser) return errorJson(404, 'not_found', 'Аккаунт с таким номером не найден.')

    const latest = await Verifications.findOne({ phone, flow }).sort({ updatedAt: -1 }).lean()
    const now = new Date()
    // Общий cooldown не обходится сменой метода; учитываются и старые записи.
    const lastStart = Math.max(...[latest?.startRequestedAt || latest?.createdAt || latest?.updatedAt, latest?.smsSentAt].map(value => value ? new Date(value).getTime() : 0))
    if (now.getTime() - lastStart < COOLDOWN_MS) return rateLimit()
    // Детерминированный ObjectId нового запроса даёт уникальность без миграции
    // старых записей. CAS для существующей записи защищает несколько процессов.
    const id = latest?._id || createHash('sha256').update(`phone:${phone}:${flow}`).digest('hex').slice(0, 24)
    let reserved
    try {
      reserved = await Verifications.findOneAndUpdate(
        { _id: id, $or: [{ startRequestedAt: { $lte: new Date(now.getTime() - COOLDOWN_MS) } }, { startRequestedAt: { $exists: false } }, { startRequestedAt: null }] },
        { $set: { phone, flow, startRequestedAt: now }, $setOnInsert: { expiresAt: new Date(now.getTime() + 15 * 60 * 1000) } },
        { upsert: !latest, returnDocument: 'after', setDefaultsOnInsert: true },
      )
    } catch (error) {
      if (error?.code === 11000) return rateLimit()
      throw error
    }
    if (!reserved) return rateLimit()

    const provider = method === 'sms' ? await startTelefonipSmsCode(phone) : await startTelefonipReverseCall(phone)
    const data = provider?.data
    const smsCode = String(data?.data?.code || '').trim()
    const callId = Number(data?.data?.id)
    if (!provider?.success || data?.success !== true || data?.data?.status === false || (method === 'sms' ? !/^\d{4}$/.test(smsCode) : !Number.isFinite(callId) || callId <= 0)) {
      if (method === 'sms' && isDailyLimit(data?.error)) return errorJson(429, 'daily_limit', 'Достигнут суточный лимит SMS для этого номера. Попробуйте подтверждение звонком или повторите завтра.')
      return errorJson(502, 'provider', method === 'sms' ? 'Не удалось отправить SMS-код. Попробуйте позже.' : 'Не удалось запустить подтверждение звонком. Попробуйте позже.')
    }
    const expiresAt = new Date(Date.now() + (method === 'sms' ? 10 : 15) * 60 * 1000)
    const callExpiresAt = new Date(Date.now() + 120 * 1000)
    const fields = { verificationMethod: method, confirmed: false, providerStatus: method === 'sms' ? 'sms_pending' : 'pending', expiresAt, meta: null }
    const unset = {}
    if (method === 'sms') {
      const { hash, salt } = createPhoneVerificationCodeHash(smsCode)
      Object.assign(fields, { smsCodeHash: hash, smsCodeSalt: salt, smsAttempts: 0, smsSentAt: new Date(), callId: null, authPhone: null, imageUrl: null, callExpiresAt: null })
    } else {
      Object.assign(fields, { callId, authPhone: data.data.auth_phone || null, imageUrl: data.data.url_image || null, callExpiresAt })
      Object.assign(unset, { smsCodeHash: 1, smsCodeSalt: 1, smsSentAt: 1 })
    }
    const saved = await Verifications.updateOne({ _id: reserved._id, startRequestedAt: now }, { $set: fields, ...(Object.keys(unset).length ? { $unset: unset } : {}) })
    if (!saved.modifiedCount) return rateLimit()
    return NextResponse.json({ success: true, data: method === 'sms'
      ? { method, status: 'sms_pending', expiresAt: expiresAt.toISOString() }
      : { method, id: callId, auth_phone: fields.authPhone, url_image: fields.imageUrl, expiresAt: callExpiresAt.toISOString() } })
  } catch {
    // URL ошибки fetch может содержать токен провайдера. Сырые ошибки не логируем.
    return errorJson(500, 'unknown', 'Не удалось запустить проверку телефона. Попробуйте позже.')
  }
}
