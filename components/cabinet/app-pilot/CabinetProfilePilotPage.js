import Link from 'next/link'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'

const roleLabelMap = {
  client: 'Пользователь',
  moder: 'Модератор',
  moderator: 'Модератор',
  admin: 'Администратор',
  dev: 'Разработчик',
}

const resolveRoleLabel = (role) => {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : ''
  return roleLabelMap[normalized] || 'Пользователь'
}

const resolveLocationLabel = (location) => {
  const value = typeof location === 'string' ? location.trim() : ''
  return value || 'Не указан'
}

const safeFieldValue = (value, fallback = 'Не указано') => {
  const prepared = typeof value === 'string' ? value.trim() : ''
  return prepared || fallback
}

const CabinetProfilePilotPage = ({ profile }) => {
  const avatarSrc = getUserAvatarSrc(profile)

  return (
    <main className="min-h-screen bg-[#0B001A] p-6 text-slate-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="rounded-2xl border border-[#00D1FF]/25 bg-[#090018]/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#00D1FF]">
            App Router Pilot
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Мой профиль</h1>
          <p className="mt-2 text-sm text-slate-300">
            Read-only пилот страницы профиля в app router.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/cabinet/profile"
              className="rounded-xl border border-[#00D1FF]/35 bg-[#00D1FF]/10 px-4 py-2 text-sm font-semibold text-[#bdf4ff]"
            >
              Открыть текущую pages-версию
            </Link>
            <Link
              href="/migration-check"
              className="rounded-xl border border-[#7A00FF]/35 bg-[#7A00FF]/10 px-4 py-2 text-sm font-semibold text-[#e3d7ff]"
            >
              Migration Check
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-700 bg-[#0a1632]/80 p-5">
          <div className="flex flex-wrap items-start gap-5">
            <img
              src={avatarSrc}
              alt={safeFieldValue(profile?.name, 'Пользователь')}
              className="h-20 w-20 rounded-full border border-white/20 object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-xl font-semibold">
                {safeFieldValue(profile?.name)}
              </h2>
              <p className="text-sm text-slate-300">
                Ник: {safeFieldValue(profile?.username)}
              </p>
              <p className="text-sm text-slate-300">
                Роль: {resolveRoleLabel(profile?.role)}
              </p>
              <p className="text-sm text-slate-300">
                Локация: {resolveLocationLabel(profile?.currentLocation)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-700 bg-[#0a1632]/80 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-cyan-300">
              Телефон
            </h3>
            <p className="mt-2 text-sm text-slate-200">
              {safeFieldValue(profile?.phone)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-[#0a1632]/80 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-cyan-300">
              Метод входа
            </h3>
            <p className="mt-2 text-sm text-slate-200">
              {safeFieldValue(profile?.authMethod)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-[#0a1632]/80 p-4 md:col-span-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-cyan-300">
              О себе
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
              {safeFieldValue(profile?.about, 'Пока нет описания')}
            </p>
          </article>
        </section>
      </div>
    </main>
  )
}

export default CabinetProfilePilotPage

