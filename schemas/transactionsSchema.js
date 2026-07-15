import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const transactionsSchema = {
  // Финансовое направление транзакции: доход или затрата
  direction: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Необходимо указать направление транзакции'],
  },
  // Сумма транзакции в рублях
  amount: {
    type: Number,
    min: [0, 'Сумма не может быть отрицательной'],
    required: [true, 'Необходимо указать сумму транзакции'],
  },
  // Способ оплаты/проведения
  paymentMethod: {
    type: String,
    enum: [
      // Новые значения
      'cash', // наличка
      'transfer', // перевод
      'invoice', // оплата по счету
      'coupon', // купон
      'discount', // скидка: погашает стоимость участия, но не является доходом
      // Легаси-значения (для обратной совместимости)
      'card',
      'remittance',
    ],
    required: [true, 'Необходимо указать способ проведения транзакции'],
  },
  // Пользователь, если оплата/начисление относится к конкретному человеку
  userId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  // Легаси идентификатор пользователя для совместимости со старым потоком
  userTelegramId: {
    type: Number,
    default: null,
  },
  // Игра, если транзакция относится к участию/затратам конкретной игры
  gameId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  // Команда, за которую внесена оплата участия в игре
  teamId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  // Регистрация команды на конкретную игру
  gameTeamId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  // Фактическая дата внесения оплаты
  paidAt: {
    type: Date,
    default: null,
  },
  // Город/площадка, чтобы удобно фильтровать отчеты
  location: {
    type: String,
    default: null,
    trim: true,
  },
  // Код купона, если способ оплаты coupon
  couponCode: {
    type: String,
    default: null,
    trim: true,
  },
  // Статус купона для транзакции выдачи
  couponStatus: {
    type: String,
    enum: ['none', 'active', 'redeemed', 'expired'],
    default: 'none',
  },
  // Владелец купона (кому выдан), если транзакция про купон
  couponOwnerUserId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  // Игра, в которой купон был погашен
  redeemedGameId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  // Время погашения купона
  redeemedAt: {
    type: Date,
    default: null,
  },
  // Кто погасил купон
  redeemedByUserId: {
    type: String,
    default: null,
    set: normalizeIdForStorage,
  },
  // Влияние на бонусный баланс пользователя (рубли)
  userBalanceDelta: {
    type: Number,
    default: 0,
  },
  // Назначение транзакции (ручная операция, промокод, системная)
  source: {
    type: String,
    enum: ['manual', 'promo', 'system', 'gateway'],
    default: 'manual',
  },
  // Статус проведения
  status: {
    type: String,
    enum: ['pending', 'completed', 'canceled'],
    default: 'completed',
  },
  // Произвольный комментарий оператора/системы
  comment: {
    type: String,
    default: '',
    trim: true,
  },
  // Дополнительные данные (id платежа, id операции ЮКасса и т.п.)
  meta: {
    type: Object,
    default: {},
  },
}

export default transactionsSchema
