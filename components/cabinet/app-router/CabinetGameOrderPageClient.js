'use client'

import PropTypes from 'prop-types'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CorporateOrderPageClient from '@components/public/CorporateOrderPageClient'

const CabinetGameOrderPageClient = ({ locationOptions, initialValues }) => (
  <CabinetLayout
    title="Заказать игру"
    description="Оставьте заявку на закрытый автоквест в удобную дату."
    activePage="game-orders"
  >
    <CorporateOrderPageClient
      embedded
      locationOptions={locationOptions}
      initialValues={initialValues}
    />
  </CabinetLayout>
)

CabinetGameOrderPageClient.propTypes = {
  locationOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  initialValues: PropTypes.shape({
    contactName: PropTypes.string,
    phone: PropTypes.string,
    telegram: PropTypes.string,
    location: PropTypes.string,
  }),
}

CabinetGameOrderPageClient.defaultProps = {
  initialValues: null,
}

export default CabinetGameOrderPageClient
