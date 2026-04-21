'use client'

import PropTypes from 'prop-types'
import { reachAnalyticsGoal } from '@helpers/yandexMetrika'

export default function SeoContactsInfo({ phone, email, cityKey, pageType }) {
  return (
    <div className="space-y-2 text-[#b9d9ef]">
      <p>
        Телефон:{' '}
        <a
          className="text-[#cbe8ff] underline"
          href={`tel:${phone}`}
          onClick={() =>
            reachAnalyticsGoal('aq_click_phone', {
              city: cityKey || 'unknown',
              page_type: pageType || 'unknown',
              phone,
            })
          }
        >
          {phone}
        </a>
      </p>
      <p>
        Email:{' '}
        <a className="text-[#cbe8ff] underline" href={`mailto:${email}`}>
          {email}
        </a>
      </p>
      <p>График: Пн-Вс 10:00-22:00</p>
      <p>Формат работы: работаем по городу без офиса</p>
      <p>Стоимость участия: от 500 до 2000 рублей</p>
    </div>
  )
}

SeoContactsInfo.propTypes = {
  phone: PropTypes.string.isRequired,
  email: PropTypes.string,
  cityKey: PropTypes.string,
  pageType: PropTypes.string,
}

SeoContactsInfo.defaultProps = {
  email: 'support@actquest.ru',
  cityKey: '',
  pageType: 'city_page',
}
