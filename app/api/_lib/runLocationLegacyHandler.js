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
      req.query = {
        ...req.query,
        ...(params?.location ? { location: params.location } : {}),
        ...(params?.id ? { id: params.id } : {}),
      }

      return handler(req, res)
    },
  })
