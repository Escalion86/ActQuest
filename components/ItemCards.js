import { faCheck, faGenderless } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import birthDateToAge from '@helpers/birthDateToAge'
import { GENDERS } from '@helpers/constants'
import formatDateTime from '@helpers/formatDateTime'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'
import sanitize from '@helpers/sanitize'
import isLoggedUserModerSelector from '@state/selectors/isLoggedUserModerSelector'
import userSelector from '@state/selectors/userSelector'
import cn from 'classnames'
import { useRecoilValue } from 'recoil'
import TextLinesLimiter from './TextLinesLimiter'
import UserName from './UserName'
import UserNameById from './UserNameById'
import UserStatusIcon from './UserStatusIcon'

const ItemContainer = ({
  onClick,
  active,
  children,
  noPadding = false,
  className,
  noBorder,
  checkable = true,
  style,
}) => (
  <div
    className={cn(
      'relative flex w-full h-full max-w-full',
      { 'hover:bg-blue-200 cursor-pointer': onClick },
      { 'bg-green-200': active },
      { 'py-0.5 px-1': !noPadding },
      { 'border-b border-gray-700 last:border-0': !noBorder },
      className
    )}
    style={style}
    onClick={
      onClick
        ? (e) => {
            e.stopPropagation()
            onClick()
          }
        : null
    }
  >
    {checkable && (
      <div
        className={cn(
          'absolute flex items-center top-0 bottom-0 left-0 overflow-hidden duration-300 bg-green-400',
          active ? 'w-7' : 'w-0'
        )}
      >
        <FontAwesomeIcon icon={faCheck} className="w-5 h-5 ml-1 text-white" />
      </div>
    )}
    {children}
  </div>
)

export const UserItemFromId = ({
  userId,
  onClick = null,
  active = false,
  noBorder,
}) => {
  const user = useRecoilValue(userSelector(userId))
  return (
    <UserItem
      item={user}
      active={active}
      onClick={onClick}
      noBorder={noBorder}
    />
  )
}

export const UserItem = ({
  item,
  onClick = null,
  active = false,
  noBorder = false,
  style,
  className,
}) => {
  const isLoggedUserModer = useRecoilValue(isLoggedUserModerSelector)

  const userGender =
    item.gender && GENDERS.find((gender) => gender.value === item.gender)
  return (
    <ItemContainer
      onClick={onClick}
      active={active}
      noPadding
      className={cn('flex h-[40px]', className)}
      noBorder={noBorder}
      style={style}
    >
      <div
        className={cn(
          'w-6 tablet:w-7 flex justify-center items-center h-full',
          userGender ? 'bg-' + userGender.color : 'bg-gray-400'
        )}
      >
        <FontAwesomeIcon
          className="w-5 h-5 text-white tablet:w-6 tablet:h-6"
          icon={userGender ? userGender.icon : faGenderless}
        />
      </div>
      <img
        className="object-cover h-10 aspect-1"
        src={getUserAvatarSrc(item)}
        alt="user"
      />
      <div className="flex items-center flex-1 py-0.5 px-1">
        <div className="flex flex-wrap items-center flex-1 max-h-full text-xs text-gray-800 phoneH:text-sm tablet:text-base gap-x-1 gap-y-0.5">
          <UserName user={item} className="font-semibold" thin />
          {item.birthday &&
            (isLoggedUserModer ||
              item.security?.showBirthday === true ||
              item.security?.showBirthday === 'full') && (
              <span className="overflow-visible italic leading-4 max-h-3 -mt-0.5">
                {' (' + birthDateToAge(item.birthday) + ')'}
              </span>
            )}
        </div>
        {/* <div className="flex flex-wrap items-center justify-between flex-1 h-4 overflow-hidden text-xs text-gray-600 max-h-4 gap-x-2">
          <div className="whitespace-nowrap">
            Телефон: {item.phone ? '+' + item.phone : '[нет]'}
          </div>
          {item.whatsapp && (
            <div className="whitespace-nowrap">
              WhatsApp: {item.whatsapp ? '+' + item.whatsapp : '[нет]'}
            </div>
          )}
          {item.email && (
            <div className="whitespace-nowrap">
              Email: {item.email || '[нет]'}
            </div>
          )}
        </div> */}
        <UserStatusIcon status={item.status} />
      </div>
    </ItemContainer>
    // </Tooltip>
  )
}
