'use client'

import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { formatPhoneInput, normalizePhoneForSubmit } from '@helpers/phoneInputMask'

const initialForm = {
  companyName: '',
  contactName: '',
  phone: '',
  email: '',
  telegram: '',
  location: '',
  preferredDate: '',
  preferredTime: '',
  participantsCount: '',
  gameType: 'any',
  comment: '',
}

const inputClass =
  'rounded-lg border border-cyan-400/25 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/20'
const labelClass = 'grid gap-1 text-sm font-medium text-slate-200'

const CorporateOrderPageClient = ({
  locationOptions,
  initialValues,
  embedded,
}) => {
  const [form, setForm] = useState(() => ({
    ...initialForm,
    ...(initialValues || {}),
    location:
      initialValues?.location ||
      locationOptions[0]?.value ||
      '',
  }))
  const [feedback, setFeedback] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedLocationLabel = useMemo(() => {
    const selected = locationOptions.find((item) => item.value === form.location)
    return selected?.label || 'вашем городе'
  }, [form.location, locationOptions])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'phone' ? formatPhoneInput(value) : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const normalizedPhone = normalizePhoneForSubmit(form.phone)
      if (form.phone && normalizedPhone.length !== 11) {
        throw new Error('Введите номер телефона полностью')
      }

      const response = await fetch('/api/corporate-orders', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          phone: normalizedPhone || '',
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось отправить заявку')
      }
      setFeedback({
        type: 'success',
        message:
          'Заявка отправлена. Организатор свяжется с вами, чтобы согласовать дату и формат игры.',
      })
      setForm((prev) => ({
        ...initialForm,
        location: prev.location || locationOptions[0]?.value || '',
      }))
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось отправить заявку',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formElement = (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-cyan-400/25 bg-slate-950/82 p-5 shadow-[0_0_0_1px_rgba(0,209,255,0.08),0_24px_70px_rgba(0,0,0,0.42)]"
    >
      <h2 className="text-xl font-semibold text-slate-50">Оставить заявку</h2>
      <p className="mt-1 text-sm text-slate-400">
        Расскажите о мероприятии в {selectedLocationLabel}.
      </p>

      <div className="mt-5 grid gap-4">
        <label className={labelClass}>
          Компания
          <input
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            className={inputClass}
            placeholder="Название компании"
          />
        </label>
        <label className={labelClass}>
          Контактное лицо
          <input
            name="contactName"
            value={form.contactName}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder="Имя"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Телефон
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="+7 999 123-45-67"
            />
          </label>
          <label className={labelClass}>
            Telegram
            <input
              name="telegram"
              value={form.telegram}
              onChange={handleChange}
              className={inputClass}
              placeholder="@username"
            />
          </label>
        </div>
        <label className={labelClass}>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className={inputClass}
            placeholder="mail@example.ru"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Город
            <select
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              className={inputClass}
            >
              {locationOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Участников
            <input
              name="participantsCount"
              type="number"
              min="1"
              value={form.participantsCount}
              onChange={handleChange}
              className={inputClass}
              placeholder="Например, 20"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Желаемая дата
            <input
              name="preferredDate"
              type="date"
              value={form.preferredDate}
              onChange={handleChange}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Время
            <input
              name="preferredTime"
              type="time"
              value={form.preferredTime}
              onChange={handleChange}
              className={inputClass}
            />
          </label>
        </div>
        <label className={labelClass}>
          Формат
          <select
            name="gameType"
            value={form.gameType}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="any">Помогите выбрать</option>
            <option value="classic">Классический автоквест</option>
            <option value="photo">Фотоквест</option>
          </select>
        </label>
        <label className={labelClass}>
          Комментарий
          <textarea
            name="comment"
            value={form.comment}
            onChange={handleChange}
            rows={4}
            className={`${inputClass} resize-none`}
            placeholder="Повод, пожелания, ограничения по времени"
          />
        </label>
      </div>

      {feedback?.message ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
              : 'border-rose-400/30 bg-rose-400/10 text-rose-100'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 w-full rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Отправляем...' : 'Отправить заявку'}
      </button>
    </form>
  )

  if (embedded) {
    return formElement
  }

  return (
    <main className="min-h-screen bg-[#0B001A] text-slate-100">
      <section className="border-b border-cyan-400/15 bg-[radial-gradient(circle_at_20%_18%,rgba(122,0,255,0.22),transparent_34%),radial-gradient(circle_at_78%_22%,rgba(0,209,255,0.18),transparent_30%),linear-gradient(140deg,#16032c_0%,#0B001A_48%,#090014_100%)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:py-12">
          <div className="flex flex-col justify-center">
            <Link
              href="/"
              className="mb-8 inline-flex w-fit text-sm font-semibold text-cyan-200 transition hover:text-white"
            >
              ActQuest
            </Link>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white md:text-5xl">
              Заказать автоквест для компании
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Организуем закрытую городскую игру в удобную дату: для
              тимбилдинга, дня рождения, корпоративного праздника или встречи
              команды.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-slate-100 sm:grid-cols-3">
              {['Дата под вашу команду', 'Classic или photo формат', 'Сценарий и результаты в системе'].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-cyan-400/25 bg-white/6 px-4 py-3 font-semibold backdrop-blur-sm"
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>
          {formElement}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Для корпоративов',
              text: 'Команды перемещаются по городу, решают задания и соревнуются в общем зачете.',
            },
            {
              title: 'Для праздников',
              text: 'Можно провести закрытую игру для друзей, семьи или клуба в согласованную дату.',
            },
            {
              title: 'Для команд',
              text: 'После игры остаются результаты, места и понятная история прохождения.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-cyan-400/20 bg-white/6 p-5"
            >
              <h2 className="text-lg font-semibold text-white">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {item.text}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Как проходит заказная игра
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              После заявки организатор уточняет формат, количество участников,
              район старта и удобное время. Затем создается закрытая игра:
              участники не видят ее в публичном расписании, а управление
              командами и результатами идет через ActQuest.
            </p>
          </div>
          <ol className="grid gap-3 text-sm text-slate-200">
            {[
              'Вы оставляете заявку с городом, датой и контактами.',
              'Организатор согласует сценарий, длительность и состав команд.',
              'Мы создаем закрытую игру и готовим запуск.',
              'Команды проходят маршрут, а результаты фиксируются в системе.',
            ].map((item, index) => (
              <li
                key={item}
                className="flex gap-3 rounded-lg border border-cyan-400/20 bg-white/6 p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  )
}

CorporateOrderPageClient.propTypes = {
  locationOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  initialValues: PropTypes.shape({
    companyName: PropTypes.string,
    contactName: PropTypes.string,
    phone: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    email: PropTypes.string,
    telegram: PropTypes.string,
    location: PropTypes.string,
  }),
  embedded: PropTypes.bool,
}

CorporateOrderPageClient.defaultProps = {
  initialValues: null,
  embedded: false,
}

export default CorporateOrderPageClient
