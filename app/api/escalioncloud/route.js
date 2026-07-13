import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import resolveTeamMembershipForIdentity from '@helpers/resolveTeamMembershipForIdentity'

const ESCALIONCLOUD_API_URL =
  process.env.ESCALIONCLOUD_API_URL || 'https://cloud.escalion.ru/api'
const IOS_USER_AGENT_RE = /\b(iPhone|iPad|iPod)\b/i
const HEIC_HEIF_NAME_RE = /\.(heic|heif)$/i
const isDevEnv = process.env.NODE_ENV !== 'production'
const MAX_REQUEST_BYTES = 55 * 1024 * 1024
const MAX_ADMIN_FILE_BYTES = 50 * 1024 * 1024
const MAX_PLAYER_FILE_BYTES = 25 * 1024 * 1024
const MAX_FILES = 5
const SAFE_DIRECTORY_SEGMENT_RE = /^[a-zA-Z0-9._-]+$/
const PLAYER_IMAGE_NAME_RE = /\.(jpe?g|png|webp|heic|heif)$/i
const ESCALIONCLOUD_PROJECT =
  String(process.env.NEXT_PUBLIC_ESCALIONCLOUD_PROJECT || 'actquest').trim() ||
  'actquest'

const buildError = (type, message) => ({
  success: false,
  data: {
    error: {
      type,
      message,
    },
  },
})

const parseUpstreamResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

const normalizePathSegment = (value) =>
  typeof value === 'string' ? value.trim().replace(/^\/+|\/+$/g, '') : ''

const normalizeSafeDirectory = (value) => {
  const normalized = normalizePathSegment(value)
  if (!normalized) return ''
  const segments = normalized.split('/')
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !SAFE_DIRECTORY_SEGMENT_RE.test(segment),
    )
  ) {
    return ''
  }
  return segments.join('/')
}

const resolveSessionIdentity = (sessionUser) => ({
  userId:
    sessionUser?.globalUserId ||
    sessionUser?.userId ||
    sessionUser?._id ||
    sessionUser?.id ||
    null,
  telegramId: sessionUser?.telegramId ?? null,
  role: String(sessionUser?.role || '').trim().toLowerCase(),
})

const canUploadPlayerPhoto = async ({ directory, identity }) => {
  const segments = directory.split('/')
  if (
    segments.length !== 4 ||
    segments[0] !== ESCALIONCLOUD_PROJECT ||
    segments[1] !== 'game-photo-answers' ||
    !segments[2] ||
    !segments[3]
  ) {
    return false
  }

  const [, , gameId, teamId] = segments
  const db = await dbConnectGlobal()
  if (!db) return false

  const [game, gameTeam, teamUsers] = await Promise.all([
    db
      .model('Games')
      .findById(gameId)
      .select({ type: 1, status: 1 })
      .lean(),
    db.model('GamesTeams').findOne({ gameId, teamId }).select({ _id: 1 }).lean(),
    db
      .model('TeamsUsers')
      .find({ teamId })
      .select({ userId: 1, userTelegramId: 1, role: 1 })
      .lean(),
  ])

  if (game?.type !== 'photo' || game?.status !== 'started' || !gameTeam) {
    return false
  }

  return resolveTeamMembershipForIdentity({
    teamUsers,
    userId: identity.userId,
    telegramId: identity.telegramId,
  }).isTeamMember
}

const getRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const getFileMeta = (file) => {
  const name = typeof file?.name === 'string' ? file.name : ''
  const type = typeof file?.type === 'string' ? file.type : ''
  const size = Number.isFinite(file?.size) ? Number(file.size) : null
  const isHeic =
    /image\/hei(c|f)/i.test(type) || HEIC_HEIF_NAME_RE.test(String(name))

  return {
    name,
    type,
    size,
    isHeic,
  }
}

export async function POST(request) {
  const requestId = getRequestId()
  const userAgent = String(request.headers.get('user-agent') || '')
  const contentLength = String(request.headers.get('content-length') || '')
  const isIosClient = IOS_USER_AGENT_RE.test(userAgent)

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(buildError('UNAUTHORIZED', 'Необходима авторизация'), {
      status: 401,
    })
  }

  const identity = resolveSessionIdentity(session.user)
  const hasElevatedAccess =
    identity.role === 'moder' ||
    identity.role === 'admin' ||
    identity.role === 'dev'
  const requestBytes = Number(contentLength)
  if (Number.isFinite(requestBytes) && requestBytes > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      buildError('FILE_TOO_LARGE', 'Слишком большой объём загрузки'),
      { status: 413 },
    )
  }

  const password = process.env.ESCALIONCLOUD_PASSWORD
  if (!password) {
    return NextResponse.json(
      buildError(
        'CONFIG_ERROR',
        'ESCALIONCLOUD_PASSWORD is not configured on the server',
      ),
      { status: 500 },
    )
  }

  try {
    const incomingFormData = await request.formData()
    const files = incomingFormData.getAll('files')
    const filesMeta = files.map((file) => getFileMeta(file))
    const hasHeicFiles = filesMeta.some((file) => file.isHeic)
    const directoryRaw = incomingFormData.get('directory')
    const fileNameRaw = incomingFormData.get('fileName')
    const extensionRaw = incomingFormData.get('extension')
    const generateNameRaw = incomingFormData.get('generateName')
    const legacyProjectRaw = incomingFormData.get('project')
    const legacyFolderRaw = incomingFormData.get('folder')
    const directoryFromNewContract = normalizeSafeDirectory(directoryRaw)
    const fileName =
      typeof fileNameRaw === 'string' && fileNameRaw.trim().length > 0
        ? fileNameRaw.trim()
        : null
    const extension =
      typeof extensionRaw === 'string' && extensionRaw.trim().length > 0
        ? extensionRaw.trim()
        : null
    const generateName =
      typeof generateNameRaw === 'string' && generateNameRaw.trim().length > 0
        ? generateNameRaw.trim()
        : null
    const legacyProject = normalizeSafeDirectory(legacyProjectRaw)
    const legacyFolder = normalizeSafeDirectory(legacyFolderRaw)
    const directory =
      directoryFromNewContract ||
      [legacyProject, legacyFolder].filter(Boolean).join('/')

    if (!files.length) {
      console.error('[EscalionCloud][upload][validation-error]', {
        requestId,
        reason: 'NO_FILES',
        isIosClient,
        userAgent,
        contentLength,
      })
      return NextResponse.json(
        buildError('VALIDATION_ERROR', 'No files provided for upload'),
        { status: 400 },
      )
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        buildError('VALIDATION_ERROR', `За один раз можно загрузить не более ${MAX_FILES} файлов`),
        { status: 400 },
      )
    }

    if (!directory) {
      console.error('[EscalionCloud][upload][validation-error]', {
        requestId,
        reason: 'EMPTY_DIRECTORY',
        isIosClient,
        userAgent,
        contentLength,
        filesMeta,
      })
      return NextResponse.json(
        buildError(
          'VALIDATION_ERROR',
          'Directory is required. Expected "<project>/<folder>"',
        ),
        { status: 400 },
      )
    }


    if (!hasElevatedAccess) {
      const hasPlayerAccess = await canUploadPlayerPhoto({ directory, identity })
      if (!hasPlayerAccess) {
        return NextResponse.json(
          buildError('FORBIDDEN', 'Нет доступа к указанному каталогу загрузки'),
          { status: 403 },
        )
      }
    }

    const maxFileBytes = hasElevatedAccess
      ? MAX_ADMIN_FILE_BYTES
      : MAX_PLAYER_FILE_BYTES
    const invalidFile = files.find((file) => {
      const meta = getFileMeta(file)
      if (meta.size === null || meta.size <= 0 || meta.size > maxFileBytes) {
        return true
      }
      if (hasElevatedAccess) {
        return !/^(image|audio|video)\//i.test(meta.type)
      }
      return !/^image\//i.test(meta.type) && !PLAYER_IMAGE_NAME_RE.test(meta.name)
    })
    if (invalidFile) {
      return NextResponse.json(
        buildError(
          'VALIDATION_ERROR',
          hasElevatedAccess
            ? 'Разрешены только изображения, аудио и видео установленного размера'
            : 'Разрешены только изображения размером до 25 МБ',
        ),
        { status: 400 },
      )
    }

    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    formData.append('directory', directory)
    if (fileName) {
      formData.append('fileName', fileName)
    }
    if (extension) {
      formData.append('extension', extension)
    }
    if (generateName) {
      formData.append('generateName', generateName)
    }

    const upstreamResponse = await fetch(ESCALIONCLOUD_API_URL, {
      method: 'POST',
      headers: {
        'x-api-password': password,
      },
      body: formData,
    })

    const upstreamBody = await parseUpstreamResponse(upstreamResponse)

    if (isDevEnv) {
      console.log('[EscalionCloud][upload][upstream-response]', {
        requestId,
        status: upstreamResponse.status,
        ok: upstreamResponse.ok,
        directory,
        filesCount: files.length,
        filesMeta,
        body: upstreamBody,
      })
    }

    if (!upstreamResponse.ok) {
      const upstreamMessage =
        upstreamBody?.reason || upstreamBody?.message || upstreamBody
      const errorMessage =
        typeof upstreamMessage === 'string'
          ? upstreamMessage
          : JSON.stringify(upstreamMessage) ||
            `EscalionCloud upload failed with status ${upstreamResponse.status}`
      const isHeicLikelyRejected =
        hasHeicFiles &&
        /hei(c|f)|unsupported|format|mime|type|extension/i.test(
          String(errorMessage),
        )

      console.error('[EscalionCloud][upload][upstream-error]', {
        requestId,
        status: upstreamResponse.status,
        directory,
        isIosClient,
        contentLength,
        filesMeta,
        upstreamBody,
      })

      return NextResponse.json(
        buildError(
          'ESCALIONCLOUD_REQUEST_FAILED',
          isHeicLikelyRejected
            ? 'Формат HEIC/HEIF сейчас не поддерживается загрузчиком. На iPhone выберите фото в JPEG (Настройки -> Камера -> Форматы -> Наиболее совместимые) или пересохраните изображение.'
            : errorMessage,
        ),
        { status: upstreamResponse.status },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: Array.isArray(upstreamBody)
          ? upstreamBody
          : upstreamBody?.data ?? upstreamBody,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[EscalionCloud][upload][internal-error]', {
      requestId,
      isIosClient,
      contentLength,
      message: error?.message,
      stack: error?.stack,
    })
    return NextResponse.json(
      buildError(
        'INTERNAL_ERROR',
        'Unexpected error while uploading to EscalionCloud',
      ),
      { status: 500 },
    )
  }
}
