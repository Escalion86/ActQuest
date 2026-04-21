import PropTypes from 'prop-types'

export default function SeoContactsInfo({ phone, email }) {
  return (
    <div className="space-y-2 text-[#b9d9ef]">
      <p>
        Телефон:{' '}
        <a className="text-[#cbe8ff] underline" href={`tel:${phone}`}>
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
}

SeoContactsInfo.defaultProps = {
  email: 'support@actquest.ru',
}
