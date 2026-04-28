import { NextResponse } from 'next/server'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

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
  const apiKey = String(process.env.DEEPSEEK_KEY || '').trim()
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'DeepSeek API key is not configured' },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  const systemPrompt =
    typeof body?.systemPrompt === 'string' ? body.systemPrompt.trim() : ''
  const deep = body?.deep === true
  const rawMessages = Array.isArray(body?.messages) ? body.messages : []
  const normalizedMessages = rawMessages
    .map((item) => ({
      role:
        item?.role === 'assistant' || item?.role === 'system'
          ? item.role
          : 'user',
      content: typeof item?.content === 'string' ? item.content.trim() : '',
    }))
    .filter((item) => item.content)

  if (!content && normalizedMessages.length === 0) {
    return badRequest('content is required')
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
