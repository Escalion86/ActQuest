import { ensureDateISOString, toStringId } from '@helpers/idAndDate'

const normalizeGameOrderForCabinet = (order) => ({
  id: toStringId(order?._id ?? order?.id) || '',
  companyName: typeof order?.companyName === 'string' ? order.companyName : '',
  contactName: typeof order?.contactName === 'string' ? order.contactName : '',
  phone: typeof order?.phone === 'string' ? order.phone : '',
  email: typeof order?.email === 'string' ? order.email : '',
  telegram: typeof order?.telegram === 'string' ? order.telegram : '',
  location: typeof order?.location === 'string' ? order.location : '',
  preferredDate: ensureDateISOString(order?.preferredDate),
  preferredTime:
    typeof order?.preferredTime === 'string' ? order.preferredTime : '',
  participantsCount: Number.isFinite(order?.participantsCount)
    ? Number(order.participantsCount)
    : null,
  gameType: typeof order?.gameType === 'string' ? order.gameType : 'any',
  selectedGameId:
    typeof order?.selectedGameId === 'string' ? order.selectedGameId : null,
  comment: typeof order?.comment === 'string' ? order.comment : '',
  status: typeof order?.status === 'string' ? order.status : 'new',
  createdByUserId:
    typeof order?.createdByUserId === 'string' ? order.createdByUserId : null,
  convertedGameId:
    typeof order?.convertedGameId === 'string' ? order.convertedGameId : null,
  managerComment:
    typeof order?.managerComment === 'string' ? order.managerComment : '',
  createdAt: ensureDateISOString(order?.createdAt),
  updatedAt: ensureDateISOString(order?.updatedAt),
})

export default normalizeGameOrderForCabinet
