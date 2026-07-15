const VALID_DIRECTIONS = new Set(['income', 'expense'])
const VALID_PAYMENT_METHODS = new Set([
  'cash',
  'transfer',
  'invoice',
  'coupon',
  'discount',
  'card',
  'remittance',
])
const VALID_STATUSES = new Set(['pending', 'completed', 'canceled'])

const normalizeString = (value) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const normalizeNullableString = (value) => {
  const normalized = normalizeString(value)
  return normalized || null
}

const normalizeCouponCode = (value) => {
  const code = normalizeString(value)
  return code ? code.toUpperCase() : null
}

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return numeric
}

export const computeUserBalanceDelta = ({ direction, amount, userId }) => {
  const normalizedAmount = Math.max(0, toNumber(amount, 0))
  if (!userId) return 0
  if (direction === 'income') return normalizedAmount
  if (direction === 'expense') return -normalizedAmount
  return 0
}

export const recalculateUserBonusBalance = async ({ db, userId }) => {
  const normalizedUserId = normalizeNullableString(userId)
  if (!normalizedUserId) return 0

  const Transactions = db.model('Transactions')
  const Users = db.model('Users')

  const transactions = await Transactions.find({
    userId: normalizedUserId,
    status: 'completed',
  })
    .select({ userBalanceDelta: 1 })
    .lean()

  const nextBalance = transactions.reduce((sum, item) => {
    return sum + toNumber(item?.userBalanceDelta, 0)
  }, 0)

  await Users.updateOne({ _id: normalizedUserId }, { $set: { bonusBalance: nextBalance } })
  return nextBalance
}

export const buildTransactionPayload = (input = {}) => {
  const paymentMethod = VALID_PAYMENT_METHODS.has(input.paymentMethod)
    ? input.paymentMethod
    : null
  const direction =
    paymentMethod === 'discount'
      ? 'income'
      : VALID_DIRECTIONS.has(input.direction)
        ? input.direction
        : null
  const amount = Math.max(0, toNumber(input.amount, 0))
  const status = VALID_STATUSES.has(input.status) ? input.status : 'completed'
  const userId = normalizeNullableString(input.userId)
  const couponCode = normalizeCouponCode(input.couponCode)
  const couponStatusRaw = normalizeString(input.couponStatus)
  const couponStatus = ['none', 'active', 'redeemed', 'expired'].includes(couponStatusRaw)
    ? couponStatusRaw
    : 'none'
  const teamId = normalizeNullableString(input.teamId)
  const gameTeamId = normalizeNullableString(input.gameTeamId)
  const paidAt = input.paidAt ? new Date(input.paidAt) : null
  const affectsUserBalance =
    input.affectsUserBalance === undefined
      ? paymentMethod !== 'discount' && !teamId && !gameTeamId
      : input.affectsUserBalance !== false

  if (!direction) throw new Error('Некорректное направление транзакции')
  if (!paymentMethod) throw new Error('Некорректный способ проведения транзакции')
  if (amount <= 0) throw new Error('Сумма транзакции должна быть больше нуля')

  const payload = {
    direction,
    paymentMethod,
    amount,
    status,
    userId,
    userTelegramId:
      input.userTelegramId === null || input.userTelegramId === undefined
        ? null
        : toNumber(input.userTelegramId, null),
    gameId: normalizeNullableString(input.gameId),
    teamId,
    gameTeamId,
    paidAt: paidAt && Number.isFinite(paidAt.getTime()) ? paidAt : null,
    location: normalizeNullableString(input.location),
    couponCode,
    couponStatus,
    couponOwnerUserId: normalizeNullableString(input.couponOwnerUserId),
    source: ['manual', 'promo', 'system', 'gateway'].includes(input.source)
      ? input.source
      : paymentMethod === 'coupon'
        ? 'promo'
        : 'manual',
    comment: normalizeString(input.comment),
    meta: input.meta && typeof input.meta === 'object' ? input.meta : {},
    redeemedGameId: normalizeNullableString(input.redeemedGameId),
    redeemedByUserId: normalizeNullableString(input.redeemedByUserId),
    redeemedAt: input.redeemedAt ? new Date(input.redeemedAt) : null,
  }

  payload.userBalanceDelta = affectsUserBalance
    ? computeUserBalanceDelta({
        direction: payload.direction,
        amount: payload.amount,
        userId: payload.userId,
      })
    : 0

  return payload
}

export const createTransaction = async ({ db, data }) => {
  const Transactions = db.model('Transactions')
  const payload = buildTransactionPayload(data)
  const created = await Transactions.create(payload)

  if (payload.userId) {
    await recalculateUserBonusBalance({ db, userId: payload.userId })
  }

  return created
}

export const updateTransaction = async ({ db, transactionId, data }) => {
  const Transactions = db.model('Transactions')
  const existing = await Transactions.findById(transactionId).lean()
  if (!existing) throw new Error('Транзакция не найдена')

  const payload = buildTransactionPayload({ ...existing, ...data })
  const updated = await Transactions.findByIdAndUpdate(transactionId, payload, {
    returnDocument: 'after',
    runValidators: true,
  })

  const affectedUsers = new Set([
    normalizeNullableString(existing.userId),
    normalizeNullableString(payload.userId),
  ])

  for (const userId of affectedUsers) {
    if (userId) await recalculateUserBonusBalance({ db, userId })
  }

  return updated
}

export const deleteTransaction = async ({ db, transactionId }) => {
  const Transactions = db.model('Transactions')
  const existing = await Transactions.findById(transactionId).lean()
  if (!existing) throw new Error('Транзакция не найдена')

  await Transactions.deleteOne({ _id: transactionId })

  const userId = normalizeNullableString(existing.userId)
  if (userId) await recalculateUserBonusBalance({ db, userId })
  return existing
}

export const issueCoupon = async ({ db, data }) => {
  const userId = normalizeNullableString(data.userId)
  const couponCode = normalizeCouponCode(data.couponCode)
  const amount = Math.max(0, toNumber(data.amount, 0))

  if (!userId) throw new Error('Необходимо указать userId для купона')
  if (!couponCode) throw new Error('Необходимо указать код купона')
  if (amount <= 0) throw new Error('Сумма купона должна быть больше нуля')

  const Transactions = db.model('Transactions')
  const duplicate = await Transactions.findOne({
    paymentMethod: 'coupon',
    couponCode,
    couponStatus: { $in: ['active', 'redeemed'] },
    status: { $ne: 'canceled' },
  })
    .select({ _id: 1 })
    .lean()

  if (duplicate) throw new Error('Купон с таким кодом уже существует')

  return createTransaction({
    db,
    data: {
      ...data,
      paymentMethod: 'coupon',
      direction: 'income',
      source: 'promo',
      couponCode,
      couponStatus: 'active',
      userId,
      couponOwnerUserId: userId,
      amount,
      status: 'completed',
    },
  })
}

export const redeemCoupon = async ({ db, data }) => {
  const userId = normalizeNullableString(data.userId)
  const gameId = normalizeNullableString(data.gameId)
  const couponCode = normalizeCouponCode(data.couponCode)

  if (!userId) throw new Error('Необходимо указать userId')
  if (!gameId) throw new Error('Необходимо указать gameId')
  if (!couponCode) throw new Error('Необходимо указать код купона')

  const Transactions = db.model('Transactions')
  const issue = await Transactions.findOne({
    paymentMethod: 'coupon',
    direction: 'income',
    couponCode,
    couponOwnerUserId: userId,
    couponStatus: 'active',
    status: 'completed',
  })

  if (!issue) throw new Error('Активный купон для пользователя не найден')

  const alreadyRedeemed = await Transactions.findOne({
    paymentMethod: 'coupon',
    direction: 'expense',
    couponCode,
    status: { $ne: 'canceled' },
  })
    .select({ _id: 1 })
    .lean()

  if (alreadyRedeemed) throw new Error('Купон уже был использован')

  const redeemed = await createTransaction({
    db,
    data: {
      paymentMethod: 'coupon',
      direction: 'expense',
      source: 'promo',
      couponCode,
      couponStatus: 'redeemed',
      amount: issue.amount,
      userId,
      couponOwnerUserId: userId,
      gameId,
      redeemedGameId: gameId,
      redeemedByUserId: userId,
      redeemedAt: new Date(),
      location: normalizeNullableString(data.location) ?? issue.location,
      comment: normalizeString(data.comment) || `Оплата участия купоном ${couponCode}`,
      status: 'completed',
      meta: { issueTransactionId: String(issue._id) },
    },
  })

  issue.couponStatus = 'redeemed'
  issue.redeemedAt = new Date()
  issue.redeemedGameId = gameId
  issue.redeemedByUserId = userId
  await issue.save()

  return redeemed
}
