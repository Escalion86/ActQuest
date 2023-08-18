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

export const USERS_ROLES = [
  { value: 'client', name: 'Пользователь', color: 'blue-400' },
  { value: 'moder', name: 'Модератор', color: 'green-400' },
  { value: 'admin', name: 'Администратор', color: 'orange-400' },
  { value: 'dev', name: 'Разработчик', color: 'danger' },
]
