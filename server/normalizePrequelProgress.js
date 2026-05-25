import { buildDefaultPrequelProgress, normalizePrequelProgress } from '@helpers/normalizePrequel'

const normalizePrequelProgressForApi = (progress) => ({
  ...buildDefaultPrequelProgress(),
  ...normalizePrequelProgress(progress),
})

export default normalizePrequelProgressForApi
