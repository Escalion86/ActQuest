import { runLegacyHandler } from '@app/api/_lib/legacyHandlerAdapter'
import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import { NextResponse } from 'next/server'

/**
 * @param {Object} options
 * @param {boolean|'write'} [options.requireAuth='write']
 *   - true: auth обязательна для всех методов
 *   - 'write': auth обязательна только для POST/PUT/PATCH/DELETE (по умолчанию)
 *   - false: auth не требуется
 */
export const runLocationLegacyHandler = ({
  request,
  params,
  handler,
  defaultStatus,
  defaultJson,
  requireAuth = 'write',
}) => {
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    request.method,
  )

  const needsAuth =
    requireAuth === true || (requireAuth === 'write' && isWriteMethod)

  if (needsAuth) {
    return (async () => {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 },
        )
      }

      return runLegacyHandler({
        request,
        defaultStatus,
        defaultJson,
        handler: async (req, res) => {
          const resolvedParams = await params
          req.query = {
            ...req.query,
            ...(resolvedParams?.location
              ? { location: resolvedParams.location }
              : {}),
            ...(resolvedParams?.id ? { id: resolvedParams.id } : {}),
          }
          req.session = session

          return handler(req, res)
        },
      })
    })()
  }

  return runLegacyHandler({
    request,
    defaultStatus,
    defaultJson,
    handler: async (req, res) => {
      const resolvedParams = await params
      req.query = {
        ...req.query,
        ...(resolvedParams?.location
          ? { location: resolvedParams.location }
          : {}),
        ...(resolvedParams?.id ? { id: resolvedParams.id } : {}),
      }

      return handler(req, res)
    },
  })
}
