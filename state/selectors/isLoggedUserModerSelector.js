import { atom } from 'jotai'
import isUserModer from '@helpers/isUserModer'
import loggedUserActiveRoleAtom from '@state/atoms/loggedUserActiveRoleAtom'

const isLoggedUserModerSelector = atom((get) =>
  isUserModer({ role: get(loggedUserActiveRoleAtom) })
)

export default isLoggedUserModerSelector
