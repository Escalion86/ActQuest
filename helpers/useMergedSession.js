import { useMemo } from 'react'
import { useSession } from 'next-auth/react'

const pickPreferNonEmpty = (primaryValue, fallbackValue) => {
  if (primaryValue === null || primaryValue === undefined) {
    return fallbackValue
  }
  if (typeof primaryValue === 'string' && primaryValue.trim().length === 0) {
    return fallbackValue
  }
  return primaryValue
}

const mergeSessions = (initialSession, session) => {
  if (!session && !initialSession) {
    return null
  }

  if (!session) {
    return initialSession
  }

  if (!initialSession) {
    return session
  }

  return {
    ...initialSession,
    ...session,
    user: {
      ...(initialSession.user ?? {}),
      ...(session.user ?? {}),
      _id: pickPreferNonEmpty(session?.user?._id, initialSession?.user?._id),
      globalUserId: pickPreferNonEmpty(
        session?.user?.globalUserId,
        initialSession?.user?.globalUserId,
      ),
      role: pickPreferNonEmpty(session?.user?.role, initialSession?.user?.role),
      location: pickPreferNonEmpty(
        session?.user?.location,
        initialSession?.user?.location,
      ),
      photoUrl: pickPreferNonEmpty(
        session?.user?.photoUrl,
        initialSession?.user?.photoUrl,
      ),
      isDeveloperImpersonating:
        session?.user?.isDeveloperImpersonating ??
        initialSession?.user?.isDeveloperImpersonating ??
        false,
      developerUserId:
        session?.user?.developerUserId ??
        initialSession?.user?.developerUserId ??
        null,
    },
  }
}

const useMergedSession = (initialSession = null) => {
  const { data: session, status, update } = useSession()

  const activeSession = useMemo(
    () => mergeSessions(initialSession, session),
    [initialSession, session],
  )

  return {
    session,
    activeSession,
    status,
    update,
  }
}

export default useMergedSession
