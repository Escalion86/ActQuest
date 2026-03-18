const canManageTransactions = ({ role } = {}) =>
  role === 'admin' || role === 'dev'

export default canManageTransactions
