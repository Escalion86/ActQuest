import { useMemo } from 'react'
import { useSession } from 'next-auth/react'

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
    },
  }
}

const useMergedSession = (initialSession = null) => {
  const { data: session, status, update } = useSession()

  const activeSession = useMemo(
    () => mergeSessions(initialSession, session),
    [initialSession, session]
  )

  return {
    session,
    activeSession,
    status,
    update,
  }
}

export default useMergedSession
