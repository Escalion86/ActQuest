import { runLegacyHandler } from '@app/api/_lib/legacyHandlerAdapter'

export const runLocationLegacyHandler = ({
  request,
  params,
  handler,
  defaultStatus,
  defaultJson,
}) =>
  runLegacyHandler({
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
