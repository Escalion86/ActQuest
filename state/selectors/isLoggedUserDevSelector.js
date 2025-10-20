import { atom } from 'jotai'
import loggedUserActiveRoleAtom from '@state/atoms/loggedUserActiveRoleAtom'

const isLoggedUserDevSelector = atom((get) => get(loggedUserActiveRoleAtom) === 'dev')

export default isLoggedUserDevSelector
