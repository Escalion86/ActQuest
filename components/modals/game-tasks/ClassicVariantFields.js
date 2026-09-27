import PropTypes from 'prop-types'

export const outcomes = { completed: 'Выполнен', timeout: 'Время истекло', captain_failed: 'Слит капитаном' }
export const categories = { main: 'Основной', bonus: 'Бонусный', penalty: 'Штрафной' }
export const codesFor = (content, category) => category === 'main' ? content.codes || [] : (content[`${category}Codes`] || []).map((entry) => entry.code)

export function Field({ label, children }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium">{label}</span>{children}</label>
}
Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node }
