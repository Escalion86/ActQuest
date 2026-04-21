import { NextResponse } from 'next/server'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import getTelegramTokenByLocation from '@utils/telegram/getTelegramTokenByLocation'
import {
  PROJECT_CITY_OPTIONS,
  parseStartPayloadFromText,
  resolveCityFromStartPayload,
  resolveEnvCityChatUrls,
} from '@helpers/telegramProjectChatConfig'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

const PROJECT_TELEGRAM_TOKEN =
  process.env.TELEGRAM_PROJECT_TOKEN || getTelegramTokenByLocation('project')

const CITY_TITLE_BY_KEY = PROJECT_CITY_OPTIONS.reduce((acc, item) => {
  acc[item.key] = item.title
  return acc
}, {})

const isProjectCityKey = (value) =>
  typeof value === 'string' && value in CITY_TITLE_BY_KEY

const getCityChatUrls = async () => {
  const envFallback = resolveEnvCityChatUrls()

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return envFallback
    }

    const settingsDoc = await db.model('SiteSettings').findOne({}).lean()
    const normalizedSettings = normalizeSiteSettings(settingsDoc)
    const chatUrlsByLocation = normalizedSettings?.chatUrlsByLocation || {}

    return PROJECT_CITY_OPTIONS.reduce((acc, city) => {
      const fromSettings = chatUrlsByLocation[city.key]
      acc[city.key] =
        typeof fromSettings === 'string' && fromSettings.trim()
          ? fromSettings.trim()
          : envFallback[city.key] || ''
      return acc
    }, {})
  } catch (error) {
    console.error('[telegram_project] failed to read chat urls', error)
    return envFallback
  }
}

const postTelegram = async (method, payload) => {
  if (!PROJECT_TELEGRAM_TOKEN) {
    throw new Error('TELEGRAM_PROJECT_TOKEN is not set')
  }

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${PROJECT_TELEGRAM_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  )

  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) {
    throw new Error(
      `[telegram_project] ${method} failed: ${JSON.stringify(
        json || { status: response.status },
      )}`,
    )
  }

  return json
}

const buildCityChooserKeyboard = () => ({
  inline_keyboard: [
    ...PROJECT_CITY_OPTIONS.map((city) => [
      {
        text: city.title,
        callback_data: `project_city:${city.key}`,
      },
    ]),
  ],
})

const buildCityChatKeyboard = ({ cityKey, cityChatUrl }) => ({
  inline_keyboard: [
    [
      {
        text: `Перейти в чат ${CITY_TITLE_BY_KEY[cityKey]}`,
        url: cityChatUrl,
      },
    ],
    [
      {
        text: 'Выбрать другой город',
        callback_data: 'project_city:change',
      },
    ],
  ],
})

const sendOrEditMessage = async ({
  chatId,
  text,
  replyMarkup,
  callbackQuery = null,
}) => {
  const commonPayload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: replyMarkup,
  }

  if (callbackQuery?.message?.message_id) {
    return postTelegram('editMessageText', {
      ...commonPayload,
      message_id: callbackQuery.message.message_id,
    })
  }

  return postTelegram('sendMessage', commonPayload)
}

const sendCityChooser = async ({ chatId, callbackQuery = null }) =>
  sendOrEditMessage({
    chatId,
    callbackQuery,
    text: [
      '<b>ActQuest — чат проекта</b>',
      '',
      'Выберите город, чтобы перейти в нужный чат сообщества:',
    ].join('\n'),
    replyMarkup: buildCityChooserKeyboard(),
  })

const sendCityChatLink = async ({ chatId, cityKey, cityChatUrl, callbackQuery = null }) => {
  const cityTitle = CITY_TITLE_BY_KEY[cityKey]
  if (!cityTitle) {
    return sendCityChooser({ chatId, callbackQuery })
  }

  if (!cityChatUrl) {
    return sendOrEditMessage({
      chatId,
      callbackQuery,
      text: [
        `<b>${cityTitle}</b>`,
        '',
        'Чат для этого города пока не настроен.',
        'Нажмите «Выбрать другой город».',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [{ text: 'Выбрать другой город', callback_data: 'project_city:change' }],
        ],
      },
    })
  }

  return sendOrEditMessage({
    chatId,
    callbackQuery,
    text: [
      `<b>${cityTitle}</b>`,
      '',
      'Нажмите кнопку ниже, чтобы перейти в чат вашего города.',
    ].join('\n'),
    replyMarkup: buildCityChatKeyboard({ cityKey, cityChatUrl }),
  })
}

const answerCallbackQuery = async (callbackQueryId) => {
  if (!callbackQueryId) return
  try {
    await postTelegram('answerCallbackQuery', { callback_query_id: callbackQueryId })
  } catch (error) {
    console.error('[telegram_project] answerCallbackQuery failed', error)
  }
}

const handleMessageUpdate = async (message, cityChatUrls) => {
  const text = typeof message?.text === 'string' ? message.text.trim() : ''
  if (!text) return

  const chatId = Number(message?.chat?.id || message?.from?.id)
  if (!Number.isFinite(chatId)) return

  if (!text.toLowerCase().startsWith('/start')) {
    await sendCityChooser({ chatId })
    return
  }

  const payload = parseStartPayloadFromText(text)
  const selectedCity = resolveCityFromStartPayload(payload)

  if (selectedCity && isProjectCityKey(selectedCity)) {
    await sendCityChatLink({
      chatId,
      cityKey: selectedCity,
      cityChatUrl: cityChatUrls[selectedCity],
    })
    return
  }

  await sendCityChooser({ chatId })
}

const handleCallbackUpdate = async (callbackQuery, cityChatUrls) => {
  const callbackData = typeof callbackQuery?.data === 'string' ? callbackQuery.data : ''
  const callbackId = callbackQuery?.id
  const chatId = Number(callbackQuery?.message?.chat?.id || callbackQuery?.from?.id)

  await answerCallbackQuery(callbackId)

  if (!Number.isFinite(chatId)) return

  if (callbackData === 'project_city:change') {
    await sendCityChooser({ chatId, callbackQuery })
    return
  }

  if (callbackData.startsWith('project_city:')) {
    const cityKey = callbackData.slice('project_city:'.length)
    if (isProjectCityKey(cityKey)) {
      await sendCityChatLink({
        chatId,
        cityKey,
        cityChatUrl: cityChatUrls[cityKey],
        callbackQuery,
      })
      return
    }
  }

  await sendCityChooser({ chatId, callbackQuery })
}

export async function POST(request) {
  if (!PROJECT_TELEGRAM_TOKEN) {
    console.error('[telegram_project] TELEGRAM_PROJECT_TOKEN is not configured')
    return NextResponse.json(
      { success: false, error: 'Project Telegram token is not configured' },
      { status: 503 },
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const cityChatUrls = await getCityChatUrls()

    if (body?.message) {
      await handleMessageUpdate(body.message, cityChatUrls)
    } else if (body?.callback_query) {
      await handleCallbackUpdate(body.callback_query, cityChatUrls)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[telegram_project] route failed', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process Telegram update' },
      { status: 500 },
    )
  }
}
