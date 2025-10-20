import { useState } from 'react'
import Head from 'next/head'
import { getSession, useSession } from 'next-auth/react'
import CabinetLayout from '@components/cabinet/CabinetLayout'

const ProfilePage = () => {
  const { data: session } = useSession()
  const [formState, setFormState] = useState({
    name: session?.user?.name || '',
    username: session?.user?.username || '',
    email: '',
    phone: '',
    about: 'Расскажите о своём опыте и любимых форматах квестов.',
    preferences: ['Городские квесты', 'Командные задания'],
  })
  const [isSaved, setIsSaved] = useState(false)

  const togglePreference = (preference) => {
    setFormState((prevState) => {
      const hasPreference = prevState.preferences.includes(preference)

      return {
        ...prevState,
        preferences: hasPreference
          ? prevState.preferences.filter((item) => item !== preference)
          : [...prevState.preferences, preference],
      }
    })
  }

  const handleChange = (field, value) => {
    setFormState((prevState) => ({ ...prevState, [field]: value }))
    setIsSaved(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setIsSaved(true)
  }

  return (
    <>
      <Head>
        <title>ActQuest — Моя анкета</title>
      </Head>
      <CabinetLayout
        title="Моя анкета"
        description="Заполните профиль, чтобы коллеги и участники знали, как с вами связаться."
        activePage="profile"
      >
        <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className="text-sm font-semibold text-primary">
                  Имя и фамилия
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={formState.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-username" className="text-sm font-semibold text-primary">
                  Никнейм в ActQuest
                </label>
                <input
                  id="profile-username"
                  type="text"
                  value={formState.username}
                  onChange={(event) => handleChange('username', event.target.value)}
                  className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="profile-email" className="text-sm font-semibold text-primary">
                  Электронная почта
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={formState.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label htmlFor="profile-phone" className="text-sm font-semibold text-primary">
                  Телефон
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={formState.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
                  placeholder="+7 000 000-00-00"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-about" className="text-sm font-semibold text-primary">
                О себе
              </label>
              <textarea
                id="profile-about"
                value={formState.about}
                onChange={(event) => handleChange('about', event.target.value)}
                rows={5}
                className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-primary">Предпочитаемые форматы</p>
              <div className="flex flex-wrap gap-3 mt-3">
                {['Городские квесты', 'Настольные сценарии', 'Корпоративные игры', 'Командные задания'].map(
                  (preference) => {
                    const isActive = formState.preferences.includes(preference)

                    return (
                      <button
                        key={preference}
                        type="button"
                        onClick={() => togglePreference(preference)}
                        className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
                          isActive
                            ? 'text-white bg-primary shadow-sm'
                            : 'text-slate-600 border border-slate-200 hover:border-primary hover:text-primary'
                        }`}
                      >
                        {preference}
                      </button>
                    )
                  }
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="submit"
                className="inline-flex justify-center px-5 py-3 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
              >
                Сохранить профиль
              </button>
              {isSaved ? (
                <span className="px-5 py-3 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl">
                  Изменения сохранены
                </span>
              ) : null}
            </div>
          </form>
        </section>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSession(context)

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  return {
    props: {},
  }
}

export default ProfilePage
