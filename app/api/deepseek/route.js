import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const MAX_MESSAGE_LENGTH = 20_000
const MAX_MESSAGES = 40
const MAX_TOTAL_CONTENT_LENGTH = 60_000

const wrongMethodResponse = () =>
  NextResponse.json({ success: false, error: 'Wrong method' }, { status: 405 })

const badRequest = (error) =>
  NextResponse.json({ success: false, error }, { status: 400 })

export async function GET() {
  return wrongMethodResponse()
}

export async function PUT() {
  return wrongMethodResponse()
}

export async function PATCH() {
  return wrongMethodResponse()
}

export async function DELETE() {
  return wrongMethodResponse()
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const role = String(session?.user?.role || '').trim().toLowerCase()
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }
  if (role !== 'moder' && role !== 'admin' && role !== 'dev') {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const apiKey = String(process.env.DEEPSEEK_KEY || '').trim()
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'DeepSeek API key is not configured' },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const content =
    typeof body?.content === 'string'
      ? body.content.trim().slice(0, MAX_MESSAGE_LENGTH)
      : ''
  const systemPrompt =
    typeof body?.systemPrompt === 'string'
      ? body.systemPrompt.trim().slice(0, MAX_MESSAGE_LENGTH)
      : ''
  const deep = body?.deep === true
  const rawMessages = Array.isArray(body?.messages)
    ? body.messages.slice(0, MAX_MESSAGES)
    : []
  const normalizedMessages = rawMessages
    .map((item) => ({
      role:
        item?.role === 'assistant' || item?.role === 'system'
          ? item.role
          : 'user',
      content:
        typeof item?.content === 'string'
          ? item.content.trim().slice(0, MAX_MESSAGE_LENGTH)
          : '',
    }))
    .filter((item) => item.content)

  if (!content && normalizedMessages.length === 0) {
    return badRequest('content is required')
  }

  const totalContentLength =
    content.length +
    systemPrompt.length +
    normalizedMessages.reduce((sum, item) => sum + item.content.length, 0)
  if (totalContentLength > MAX_TOTAL_CONTENT_LENGTH) {
    return badRequest('Слишком большой объём запроса')
  }

  const model = deep ? 'deepseek-v4-pro' : 'deepseek-v4-flash'
  const fallbackSystemPrompt = systemPrompt || 'Напиши ответ на русском языке'
  const messages =
    normalizedMessages.length > 0
      ? normalizedMessages
      : [
          {
            role: 'system',
            content: fallbackSystemPrompt,
          },
          { role: 'user', content },
        ]

  const hasSystemMessage = messages.some((message) => message.role === 'system')
  const messagesWithSystem = hasSystemMessage
    ? messages
    : [{ role: 'system', content: fallbackSystemPrompt }, ...messages]

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messagesWithSystem,
      }),
      cache: 'no-store',
    })

    const json = await response.json().catch(() => null)

    if (!response.ok || !json) {
      return NextResponse.json(
        {
          success: false,
          error:
            (json && typeof json.error?.message === 'string'
              ? json.error.message
              : '') || 'DeepSeek request failed',
        },
        { status: response.status || 502 },
      )
    }

    return NextResponse.json({ success: true, data: json }, { status: 200 })
  } catch (error) {
    console.error('DeepSeek request failed', error)
    return NextResponse.json(
      { success: false, error: 'Failed to call DeepSeek API' },
      { status: 500 },
    )
  }
}
