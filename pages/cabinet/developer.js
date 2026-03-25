import { useState } from 'react'
import Head from 'next/head'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import getSessionSafe from '@helpers/getSessionSafe'
import useMergedSession from '@helpers/useMergedSession'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const DeveloperPage = ({ session: initialSession }) => {
  const { activeSession } = useMergedSession(initialSession)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isClosingFinished, setIsClosingFinished] = useState(false)
  const [result, setResult] = useState(null)
  const [closeFinishedResult, setCloseFinishedResult] = useState(null)
  const [error, setError] = useState('')

  const handleRecalculate = async () => {
    if (isRecalculating) {
      return
    }

    setIsRecalculating(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/cabinet/dev/recalculate-ratings', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось пересчитать рейтинг')
      }

      setResult(json?.data ?? null)
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось пересчитать рейтинг')
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleCloseFinishedGames = async () => {
    if (isClosingFinished) {
      return
    }

    setIsClosingFinished(true)
    setError('')
    setCloseFinishedResult(null)

    try {
      const response = await fetch('/api/cabinet/dev/close-finished-games', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      })

      const json = await response.json()
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось закрыть завершенные игры')
      }

      setCloseFinishedResult(json?.data ?? null)
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось закрыть завершенные игры')
    } finally {
      setIsClosingFinished(false)
    }
  }

  if (!isDeveloperRole(activeSession?.user?.role)) {
    return (
      <>
        <Head>
          <title>ActQuest — Разработчик</title>
        </Head>
        <CabinetLayout
          title="Разработчик"
          description="Доступ только для разработчика."
          activePage="developer"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              У вас нет доступа к разделу разработчика.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Разработчик</title>
      </Head>
      <CabinetLayout
        title="Разработчик"
        description="Сервисные операции для полного обслуживания системы."
        activePage="developer"
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Полный пересчёт рейтингов
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Пересчитывает рейтинг всех игроков и команд по всем завершённым и закрытым рейтинговым играм,
            затем обновляет данные в базе.
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleRecalculate}
              variant="primary"
              tone="brand"
              disabled={isRecalculating}
            >
              {isRecalculating ? 'Выполняется пересчёт...' : 'Пересчитать рейтинг игроков и команд'}
            </CabinetButton>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>Пересчёт завершён.</p>
              <p className="mt-1">Игр обработано: {result.gamesProcessed ?? 0}</p>
              <p className="mt-1">Игры с достроенным результатом: {result.gamesWithRebuiltResults ?? 0}</p>
              <p className="mt-1">Пропущено без snapshot: {result.gamesSkippedNoSnapshots ?? 0}</p>
              <p className="mt-1">Операций обновления gameStats игроков: {result.usersStatsUpdatedOperations ?? 0}</p>
              <p className="mt-1">Операций обновления gameStats команд: {result.teamsStatsUpdatedOperations ?? 0}</p>
              <p className="mt-1">Операций обновления игроков: {result.usersUpdatedOperations ?? 0}</p>
              <p className="mt-1">Операций обновления команд: {result.teamsUpdatedOperations ?? 0}</p>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Закрытие всех завершённых игр
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Принудительно переводит все игры со статусом <code>finished</code> в <code>closed</code>.
          </p>
          <div className="mt-4">
            <CabinetButton
              onClick={handleCloseFinishedGames}
              variant="primary"
              tone="danger"
              disabled={isClosingFinished}
            >
              {isClosingFinished ? 'Закрываем игры...' : 'Закрыть завершенные игры'}
            </CabinetButton>
          </div>

          {closeFinishedResult ? (
            <div className="mt-4 rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p>Операция завершена.</p>
              <p className="mt-1">Найдено игр в статусе finished: {closeFinishedResult.finishedGamesFound ?? 0}</p>
              <p className="mt-1">Переведено в closed: {closeFinishedResult.gamesClosed ?? 0}</p>
              <p className="mt-1">С достроенным результатом: {closeFinishedResult.gamesWithRebuiltResults ?? 0}</p>
              <p className="mt-1">Без snapshot: {closeFinishedResult.gamesWithoutSnapshots ?? 0}</p>
              <p className="mt-1">Пропущено в пересчёте метрик: {closeFinishedResult.gamesSkippedMetrics ?? 0}</p>
              <p className="mt-1">Операций обновления игроков: {closeFinishedResult.usersUpdatedOperations ?? 0}</p>
              <p className="mt-1">Операций обновления команд: {closeFinishedResult.teamsUpdatedOperations ?? 0}</p>
            </div>
          ) : null}
        </section>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/developer'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  return {
    props: {
      session,
    },
  }
}

export default DeveloperPage
