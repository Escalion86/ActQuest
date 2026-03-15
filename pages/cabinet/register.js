import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { signIn, useSession } from 'next-auth/react'

import getSessionSafe from '@helpers/getSessionSafe'
import { extractRelativePath, resolveCabinetCallback } from '@helpers/cabinetAuth'
import { formatPhoneInput, normalizePhoneForSubmit } from '@helpers/phoneInputMask'
import { LOCATIONS } from '@server/serverConstants'

const availableLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({ key, ...value }))

const defaultLocation = availableLocations[0]?.key ?? 'dev'

const CabinetRegisterPage = ({ authCallbackUrl }) => {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [location, setLocation] = useState(
    () => session?.user?.location || defaultLocation,
  )
  const [nameInput, setNameInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordRepeatInput, setPasswordRepeatInput] = useState('')
  const [authError, setAuthError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const effectiveCallbackUrl = authCallbackUrl || '/cabinet'

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session?.user?.location) {
      setLocation(session.user.location)
    }
  }, [session?.user?.location])

  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      return
    }

    const redirectTarget =
      effectiveCallbackUrl && effectiveCallbackUrl !== '/cabinet/register'
        ? effectiveCallbackUrl
        : '/cabinet'

    if (redirectTarget && redirectTarget !== router.asPath) {
      router.replace(redirectTarget).catch(() => {})
    }
  }, [effectiveCallbackUrl, router, session, status])

  const updateSession = useCallback(() => {
    if (typeof update === 'function') {
      return update()
    }

    return Promise.resolve()
  }, [update])

  const handleRegister = useCallback(
    async (event) => {
      event.preventDefault()
      if (isSubmitting) return

      const digitsOnly = normalizePhoneForSubmit(phoneInput)
      if (!digitsOnly || digitsOnly.length < 11) {
        setAuthError('Введите корректный номер телефона.')
        return
      }
      if (!passwordInput || passwordInput.length < 8) {
        setAuthError('Пароль должен содержать минимум 8 символов.')
        return
      }
      if (passwordInput !== passwordRepeatInput) {
        setAuthError('Пароли не совпадают.')
        return
      }

      setAuthError(null)
      setIsSubmitting(true)

      try {
        const response = await fetch('/api/cabinet/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location,
            data: JSON.stringify({
              phone: digitsOnly,
              password: passwordInput,
              name: nameInput,
            }),
          }),
        })
        const json = await response.json()

        if (!response.ok || json?.success === false) {
          throw new Error(json?.error || 'Не удалось завершить регистрацию.')
        }

        let absoluteCallbackUrl = effectiveCallbackUrl
        if (isClient) {
          try {
            absoluteCallbackUrl = new URL(
              effectiveCallbackUrl,
              window.location.origin,
            ).toString()
          } catch (buildUrlError) {
            console.error('Не удалось сформировать callbackUrl', buildUrlError)
            absoluteCallbackUrl = `${window.location.origin}/cabinet`
          }
        }

        const signInResult = await signIn('password', {
          redirect: false,
          callbackUrl: absoluteCallbackUrl,
          data: JSON.stringify({
            phone: digitsOnly,
            password: passwordInput,
          }),
          location,
        })

        if (signInResult?.error) {
          throw new Error(signInResult.error)
        }

        await updateSession()

        if (isClient) {
          const safeResultUrl = extractRelativePath(
            signInResult?.url,
            window.location.origin,
          )
          const redirectTarget =
            safeResultUrl && safeResultUrl !== '/cabinet/register'
              ? safeResultUrl
              : '/cabinet'

          if (redirectTarget !== router.asPath) {
            await router.replace(redirectTarget)
          }
        }
      } catch (error) {
        console.error('Register error', error)
        setAuthError(error?.message || 'Не удалось завершить регистрацию.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      effectiveCallbackUrl,
      isClient,
      isSubmitting,
      location,
      nameInput,
      passwordInput,
      passwordRepeatInput,
      phoneInput,
      router,
      updateSession,
    ],
  )

  return (
    <>
      <Head>
        <title>ActQuest — регистрация</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="px-4 py-16 mx-auto max-w-3xl">
          <div className="p-8 bg-white dark:bg-slate-900/80 rounded-3xl shadow-2xl">
            <h1 className="text-2xl font-semibold text-primary">Регистрация</h1>
            <p className="mt-2 text-sm text-slate-500">
              Создайте пароль для входа в личный кабинет по номеру телефона.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Игровой регион
                <select
                  className="px-4 py-3 text-base transition border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  disabled={isSubmitting}
                >
                  {availableLocations.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.townRu[0].toUpperCase() + item.townRu.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <input
                type="text"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder="Имя (необязательно)"
                disabled={isSubmitting}
                className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              />

              <input
                type="tel"
                value={phoneInput}
                onChange={(event) =>
                  setPhoneInput(formatPhoneInput(event.target.value))
                }
                placeholder="+7 900 000-00-00"
                disabled={isSubmitting}
                className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              />

              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Пароль (минимум 8 символов)"
                disabled={isSubmitting}
                className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              />

              <input
                type="password"
                value={passwordRepeatInput}
                onChange={(event) => setPasswordRepeatInput(event.target.value)}
                placeholder="Повторите пароль"
                disabled={isSubmitting}
                className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 text-sm font-semibold text-white transition bg-emerald-600 rounded-xl hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Регистрация…' : 'Зарегистрироваться'}
              </button>
            </form>

            {authError ? (
              <p className="mt-4 w-full px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                {authError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 text-sm">
              <Link href={`/cabinet/login?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`} className="text-primary hover:underline">
                Уже есть аккаунт? Войти
              </Link>
              <Link href="/cabinet/login" className="text-slate-500 hover:underline">
                Войти через VK
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)
  const { relativeCallback, isSafe } = resolveCabinetCallback(
    context?.query?.callbackUrl,
    context?.req,
  )

  if (session) {
    const destination = isSafe && relativeCallback ? relativeCallback : '/cabinet'
    return {
      redirect: {
        destination,
        permanent: false,
      },
    }
  }

  return {
    props: {
      authCallbackUrl: isSafe && relativeCallback ? relativeCallback : '/cabinet',
    },
  }
}

export default CabinetRegisterPage
