import {
  faBan,
  faBirthdayCake,
  faBriefcase,
  faCalendarDay,
  faCertificate,
  faCheck,
  faCheckCircle,
  faCircle,
  faClock,
  faComments,
  faCube,
  faGenderless,
  faGift,
  faHandHoldingHeart,
  faHeartbeat,
  faHistory,
  faLock,
  faMars,
  faMarsDouble,
  faPhone,
  faPieChart,
  faPlay,
  faShop,
  faShoppingBag,
  faSignInAlt,
  faTimesCircle,
  faTools,
  faUnlink,
  faUserAlt,
  faUsers,
  faUserTimes,
  faVenus,
} from '@fortawesome/free-solid-svg-icons'
import isDevMode from './isDevMode'

import {
  faBug,
  faChartBar,
  faCog,
  faCubes,
  faFilter,
  faFire,
  faHome,
  faMoneyBill,
  faUser,
  faHeart,
} from '@fortawesome/free-solid-svg-icons'
import {
  faCalendar,
  faCalendarAlt,
  faCreditCard,
} from '@fortawesome/free-regular-svg-icons'

import UsersContent from '@layouts/content/UsersContent'

import ContactsContent from '@layouts/content/ContactsContent'
import DevContent from '@layouts/content/DevContent'
import SettingsContent from '@layouts/content/SettingsContent'

const colors = [
  'border-blue-400',
  'border-red-400',
  'border-yellow-400',
  'border-green-400',
  'border-purple-400',
  'border-orange-400',
  'border-gray-400',
  'border-amber-400',
  'text-red-400',
  'text-blue-400',
  'text-yellow-400',
  'text-green-400',
  'text-purple-400',
  'text-orange-400',
  'text-gray-400',
  'text-amber-400',
  'bg-blue-400',
  'bg-red-400',
  'bg-yellow-400',
  'bg-green-400',
  'bg-purple-400',
  'bg-orange-400',
  'bg-gray-400',
  'bg-amber-400',
  'border-blue-500',
  'border-red-500',
  'border-yellow-500',
  'border-green-500',
  'border-purple-500',
  'border-orange-500',
  'border-gray-500',
  'border-amber-500',
  'text-red-500',
  'text-blue-500',
  'text-yellow-500',
  'text-green-500',
  'text-purple-500',
  'text-orange-500',
  'text-gray-500',
  'text-amber-500',
  'bg-blue-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-gray-500',
  'bg-amber-500',
  'border-blue-600',
  'border-yellow-600',
  'border-red-600',
  'border-green-600',
  'border-purple-600',
  'border-orange-600',
  'border-gray-600',
  'border-amber-600',
  'border-amber-700',
  'text-gray-600',
  'text-blue-600',
  'text-yellow-600',
  'text-green-600',
  'text-purple-600',
  'text-orange-600',
  'text-gray-600',
  'text-amber-600',
  'text-amber-700',
  'bg-blue-600',
  'bg-red-600',
  'bg-yellow-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-orange-600',
  'bg-gray-600',
  'bg-amber-600',
  'bg-amber-700',
  'hover:border-blue-400',
  'hover:border-red-400',
  'hover:border-yellow-400',
  'hover:border-green-400',
  'hover:border-purple-400',
  'hover:border-orange-400',
  'hover:border-gray-400',
  'hover:border-amber-400',
  'hover:text-red-400',
  'hover:text-blue-400',
  'hover:text-yellow-400',
  'hover:text-green-400',
  'hover:text-purple-400',
  'hover:text-orange-400',
  'hover:text-gray-400',
  'hover:text-amber-400',
  'hover:bg-blue-400',
  'hover:bg-red-400',
  'hover:bg-yellow-400',
  'hover:bg-green-400',
  'hover:bg-purple-400',
  'hover:bg-orange-400',
  'hover:bg-gray-400',
  'hover:bg-amber-400',
  'hover:border-blue-500',
  'hover:border-red-500',
  'hover:border-yellow-500',
  'hover:border-green-500',
  'hover:border-purple-500',
  'hover:border-orange-500',
  'hover:border-gray-500',
  'hover:border-amber-500',
  'hover:text-red-500',
  'hover:text-blue-500',
  'hover:text-yellow-500',
  'hover:text-green-500',
  'hover:text-purple-500',
  'hover:text-orange-500',
  'hover:text-gray-500',
  'hover:text-amber-500',
  'hover:text-amber-600',
  'hover:bg-blue-500',
  'hover:bg-red-500',
  'hover:bg-yellow-500',
  'hover:bg-green-500',
  'hover:bg-purple-500',
  'hover:bg-orange-500',
  'hover:bg-gray-500',
  'hover:bg-amber-500',
  'hover:border-blue-600',
  'hover:border-red-600',
  'hover:border-yellow-600',
  'hover:border-green-600',
  'hover:border-purple-600',
  'hover:border-orange-600',
  'hover:border-gray-600',
  'hover:border-amber-600',
  'hover:border-amber-700',
  'hover:text-red-600',
  'hover:text-blue-600',
  'hover:text-yellow-600',
  'hover:text-green-600',
  'hover:text-purple-600',
  'hover:text-orange-600',
  'hover:text-gray-600',
  'hover:text-amber-600',
  'hover:text-amber-700',
  'hover:bg-blue-600',
  'hover:bg-red-600',
  'hover:bg-yellow-600',
  'hover:bg-green-600',
  'hover:bg-purple-600',
  'hover:bg-orange-600',
  'hover:bg-gray-600',
  'hover:bg-amber-600',
  'hover:bg-amber-700',
]

export const GRADIENT_COLORS = ['#504436', '#84725A']

export const MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

export const MONTHS_FULL_1 = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]

export const MONTHS_FULL = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

export const DAYS_OF_WEEK = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']

export const DEFAULT_USERS_SECURITY = Object.freeze({
  fullSecondName: null,
  fullThirdName: null,
  showBirthday: null,
  // showAge: null,
  // showContacts: null,
  showPhone: null,
  showWhatsapp: null,
  showViber: null,
  showTelegram: null,
  showInstagram: null,
  showVk: null,
  showEmail: null,
})

export const DEFAULT_USERS_NOTIFICATIONS = Object.freeze({
  telegram: { active: false, userName: null, id: null },
})

export const DEFAULT_USER = Object.freeze({
  firstName: '',
  secondName: '',
  thirdName: '',
  password: '',
  email: '',
  phone: null,
  whatsapp: null,
  viber: null,
  telegram: '',
  vk: '',
  instagram: '',
  birthday: null,
  gender: null,
  images: [],
  role: 'client',
  interests: '',
  profession: '',
  orientation: null,
  status: 'novice',
  lastActivityAt: null,
  prevActivityAt: null,
  archive: false,
  haveKids: null,
  security: DEFAULT_USERS_SECURITY,
  notifications: DEFAULT_USERS_NOTIFICATIONS,
})

export const DEFAULT_ADDRESS = Object.freeze({
  town: '',
  street: '',
  house: '',
  entrance: '',
  floor: '',
  flat: '',
  comment: '',
})

export const DEFAULT_QUESTIONNAIRE = Object.freeze({
  title: '',
  data: [],
})

export const DEFAULT_QUESTIONNAIRE_ITEM = {
  type: 'text',
  label: '',
  key: '',
  show: true,
  required: false,
}

export const DEFAULT_REVIEW = Object.freeze({
  author: '',
  review: '',
  authorAge: null,
  showOnSite: true,
})

export const DEFAULT_PAYMENT = Object.freeze({
  sector: 'event',
  payDirection: null,
  userId: null,
  eventId: null,
  serviceId: null,
  productId: null,
  payType: null,
  sum: 0,
  status: 'created',
  payAt: undefined,
  comment: '',
})

export const DEFAULT_ADDITIONAL_BLOCK = Object.freeze({
  title: '',
  description: '',
  image: null,
  menuName: '',
  index: null,
  showOnSite: true,
})

export const DEFAULT_SITE_SETTINGS = Object.freeze({
  email: '',
  phone: '',
  whatsapp: '',
  viber: '',
  telegram: '',
  instagram: '',
  vk: '',
  codeSendService: 'telefonip',
})

export const GENDERS = [
  { value: 'male', name: 'Мужчина', color: 'blue-400', icon: faMars },
  { value: 'famale', name: 'Женщина', color: 'red-400', icon: faVenus },
]

export const GENDERS_WITH_NO_GENDER = [
  ...GENDERS,
  { value: 'null', name: 'Не выбрано', color: 'gray-400', icon: faGenderless },
]

export const ORIENTATIONS = [
  { value: 'getero', name: 'Гетеросексуал', color: 'blue-400' },
  { value: 'bi', name: 'Бисексуал', color: 'purple-400' },
  { value: 'homo', name: 'Гомосексуал', color: 'red-400' },
]

export const CODE_SEND_SERVICES = [
  { value: 'telefonip', name: 'TelefonIP', color: 'orange-400' },
  { value: 'ucaller', name: 'UCaller', color: 'blue-400' },
]

export const CONTENTS = {
  users: {
    Component: UsersContent,
    name: 'Пользователи',
    accessRoles: ['moder', 'admin', 'dev'],
  },
  contacts: {
    Component: ContactsContent,
    name: 'Контакты на сайте',
    accessRoles: ['admin', 'dev'],
  },
  dev: { Component: DevContent, name: 'Разработчик', accessRoles: ['dev'] },
  settings: {
    Component: SettingsContent,
    name: 'Настройки',
    accessRoles: ['admin', 'dev'],
  },
}

export const pages = [
  {
    id: 7,
    group: 2,
    name: 'Контакты',
    href: 'contacts',
    icon: faPhone,
    accessRoles: CONTENTS['contacts'].accessRoles,
  },
  {
    id: 8,
    group: 3,
    name: 'Пользователи',
    href: 'users',
    icon: faUser,
    accessRoles: CONTENTS['users'].accessRoles,
  },
  {
    id: 80,
    group: 9,
    name: 'Настройки',
    href: 'settings',
    icon: faCog,
    accessRoles: CONTENTS['settings'].accessRoles,
  },
  {
    id: 99,
    group: 99,
    name: 'Разработчик',
    href: 'dev',
    icon: faBug,
    accessRoles: CONTENTS['dev'].accessRoles,
  },
]

export const pagesGroups = [
  { id: 2, name: 'Сайт', icon: faHome, accessRoles: ['admin', 'dev'] },
  {
    id: 3,
    name: 'Пользователи',
    icon: faUser,
    accessRoles: ['moder', 'admin', 'dev'],
  },
  {
    id: 4,
    name: 'Транзакции',
    icon: faMoneyBill,
    accessRoles: ['admin', 'dev'],
  },
  {
    id: 8,
    name: 'Инструменты',
    icon: faTools,
    accessRoles: ['moder', 'admin', 'dev'],
  },
  { id: 9, name: 'Настройки', icon: faCog, accessRoles: ['admin', 'dev'] },
  { id: 99, name: 'Разработчик', icon: faBug, accessRoles: ['dev'] },
]

export const EVENT_PAY_DIRECTIONS = [
  {
    value: 'toUser',
    name: 'Пользователю (за помощь)',
    color: 'red-400',
    icon: faMoneyBill, //faUserAlt,
  },
  {
    value: 'toEvent',
    name: 'Затраты на мероприятие',
    color: 'red-400',
    icon: faMoneyBill, //faCalendar,
  },
  {
    value: 'fromUser',
    name: 'Оплата мероприятия',
    color: 'green-400',
    icon: faMoneyBill, //faUserAlt,
  },
  {
    value: 'fromEvent',
    name: 'Доп. доходы',
    color: 'green-400',
    icon: faMoneyBill, //faCalendar,
  },
]

export const DEFAULT_USERS_STATUS_ACCESS = {
  noReg: true,
  novice: true,
  member: true,
}

export const DEFAULT_USERS_STATUS_DISCOUNT = {
  novice: 0,
  member: 0,
}

export const USERS_STATUSES = [
  { value: 'novice', name: 'Новичок', color: 'green-400', icon: faUser },
  {
    value: 'member',
    name: 'Участник клуба',
    color: 'blue-400',
    imageSrc: '/img/svg_icons/medal.svg',
  },
  { value: 'ban', name: 'Бан', color: 'danger', icon: faBan },
]

export const USERS_ROLES = [
  { value: 'client', name: 'Пользователь', color: 'blue-400' },
  { value: 'moder', name: 'Модератор', color: 'green-400' },
  { value: 'admin', name: 'Администратор', color: 'orange-400' },
  { value: 'dev', name: 'Разработчик', color: 'danger' },
]

export const UCALLER_VOICE = true
export const UCALLER_MIX = true
