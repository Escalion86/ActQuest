import { atom } from 'jotai'
import isUserAdmin from '@helpers/isUserAdmin'
import loggedUserActiveRoleAtom from '@state/atoms/loggedUserActiveRoleAtom'

const isLoggedUserAdminSelector = atom((get) =>
  isUserAdmin({ role: get(loggedUserActiveRoleAtom) })
)

export default isLoggedUserAdminSelector
