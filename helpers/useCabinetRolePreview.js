import { useCallback, useEffect, useMemo, useState } from 'react'

export const CABINET_ROLE_PREVIEW_STORAGE_KEY = 'cabinet-role-preview'
export const CABINET_ROLE_PREVIEW_EVENT = 'cabinet-role-preview-changed'

const ROLE_PREVIEW_OPTIONS = ['client', 'admin', 'dev']

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return ROLE_PREVIEW_OPTIONS.includes(normalized) ? normalized : null
}

const useCabinetRolePreview = (sessionRole) => {
  const normalizedSessionRole = normalizeRole(sessionRole) ?? 'client'
  const isDeveloper = normalizedSessionRole === 'dev'
  const [previewRole, setPreviewRole] = useState(null)

  const resolveStoredPreviewRole = useCallback(() => {
    if (typeof window === 'undefined' || !isDeveloper) {
      return null
    }

    const storedRole = normalizeRole(
      window.localStorage.getItem(CABINET_ROLE_PREVIEW_STORAGE_KEY),
    )

    if (!storedRole || storedRole === normalizedSessionRole) {
      return null
    }

    return storedRole
  }, [isDeveloper, normalizedSessionRole])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isDeveloper) {
      window.localStorage.removeItem(CABINET_ROLE_PREVIEW_STORAGE_KEY)
      setPreviewRole(null)
      window.dispatchEvent(new Event(CABINET_ROLE_PREVIEW_EVENT))
      return
    }

    setPreviewRole(resolveStoredPreviewRole())

    const syncFromStorage = () => {
      setPreviewRole(resolveStoredPreviewRole())
    }

    const handleStorage = (event) => {
      if (
        event?.key === null ||
        event?.key === CABINET_ROLE_PREVIEW_STORAGE_KEY
      ) {
        syncFromStorage()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(CABINET_ROLE_PREVIEW_EVENT, syncFromStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(CABINET_ROLE_PREVIEW_EVENT, syncFromStorage)
    }
  }, [isDeveloper, resolveStoredPreviewRole])

  const effectiveRole = useMemo(() => {
    if (!isDeveloper) {
      return normalizedSessionRole
    }

    return previewRole ?? normalizedSessionRole
  }, [isDeveloper, normalizedSessionRole, previewRole])

  const setRolePreview = useCallback(
    (nextRole) => {
      if (typeof window === 'undefined' || !isDeveloper) {
        return
      }

      const normalizedNextRole = normalizeRole(nextRole)
      if (!normalizedNextRole || normalizedNextRole === normalizedSessionRole) {
        window.localStorage.removeItem(CABINET_ROLE_PREVIEW_STORAGE_KEY)
        setPreviewRole(null)
        window.dispatchEvent(new Event(CABINET_ROLE_PREVIEW_EVENT))
        return
      }

      window.localStorage.setItem(
        CABINET_ROLE_PREVIEW_STORAGE_KEY,
        normalizedNextRole,
      )
      setPreviewRole(normalizedNextRole)
      window.dispatchEvent(new Event(CABINET_ROLE_PREVIEW_EVENT))
    },
    [isDeveloper, normalizedSessionRole],
  )

  return {
    isDeveloper,
    previewRole,
    effectiveRole,
    setRolePreview,
  }
}

export default useCabinetRolePreview
