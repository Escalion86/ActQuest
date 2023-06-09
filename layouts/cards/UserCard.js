import { modalsFuncAtom } from '@state/atoms'
import { useRecoilValue } from 'recoil'
import isLoggedUserAdminSelector from '@state/selectors/isLoggedUserAdminSelector'
import userSelector from '@state/selectors/userSelector'
import loadingAtom from '@state/atoms/loadingAtom'

import CardButtons from '@components/CardButtons'
import birthDateToAge from '@helpers/birthDateToAge'
import { GENDERS } from '@helpers/constants'
import cn from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGenderless } from '@fortawesome/free-solid-svg-icons'
import { CardWrapper } from '@components/CardWrapper'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'
import UserStatusIcon from '@components/UserStatusIcon'
import formatDate from '@helpers/formatDate'
import UserName from '@components/UserName'
import isLoggedUserModerSelector from '@state/selectors/isLoggedUserModerSelector'

const UserCard = ({ userId, hidden = false, style }) => {
  const modalsFunc = useRecoilValue(modalsFuncAtom)
  const user = useRecoilValue(userSelector(userId))
  const loading = useRecoilValue(loadingAtom('user' + userId))
  // const eventUsers = useRecoilValue(eventsUsersSignedUpByUserIdSelector(userId))
  const isLoggedUserAdmin = useRecoilValue(isLoggedUserAdminSelector)
  const isLoggedUserModer = useRecoilValue(isLoggedUserModerSelector)

  // const widthNum = useWindowDimensionsTailwindNum()
  // const itemFunc = useRecoilValue(itemsFuncAtom)

  const userGender =
    user.gender && GENDERS.find((gender) => gender.value === user.gender)

  // const userStatusArr = USERS_STATUSES.find(
  //   (userStatus) => userStatus.value === user.status
  // )

  return (
    <CardWrapper
      loading={loading}
      onClick={() => modalsFunc.user.view(user._id)}
      hidden={hidden}
      style={style}
    >
      <div className="flex w-full">
        <div
          className={cn(
            'w-8 flex justify-center items-center',
            userGender ? 'bg-' + userGender.color : 'bg-gray-400'
          )}
        >
          <FontAwesomeIcon
            className="w-8 h-8 text-white"
            icon={userGender ? userGender.icon : faGenderless}
          />
        </div>
        <div className="flex flex-col flex-1 tablet:flex-row">
          <div className="flex flex-1 border-b tablet:border-b-0">
            <img
              className="hidden object-cover w-[5.25rem] h-[5.25rem] tablet:block min-w-[5.25rem] min-h-[5.25rem]"
              src={getUserAvatarSrc(user)}
              alt="user"
              // width={48}
              // height={48}
            />
            <div className="flex flex-col flex-1 text-xl font-bold">
              <div className="flex flex-1">
                <div className="flex flex-col flex-1">
                  <div className="flex flex-nowrap items-center px-1 py-0.5 leading-6 gap-x-1">
                    <UserStatusIcon status={user.status} />
                    <UserName
                      user={user}
                      className="h-8 tablet:h-auto text-base font-bold tablet:text-lg -mt-0.5 tablet:mt-0"
                      // noWrap
                    />
                  </div>
                  <div className="flex">
                    <img
                      className="object-cover w-14 h-14 min-w-14 min-h-14 tablet:hidden"
                      src={getUserAvatarSrc(user)}
                      alt="user"
                      // width={48}
                      // height={48}
                    />
                    <div className="flex flex-col justify-center px-1">
                      {user.birthday &&
                        (isLoggedUserModer ||
                          user.security?.showBirthday === true ||
                          user.security?.showBirthday === 'full') && (
                          <div className="flex text-sm leading-4 gap-x-2 ">
                            <span className="flex items-center font-bold">
                              Возраст:
                            </span>
                            <div className="flex items-center text-sm font-normal whitespace-nowrap gap-x-2">
                              <span className="leading-4">
                                {birthDateToAge(
                                  user.birthday,
                                  true,
                                  false,
                                  true
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      <div className="flex text-sm leading-4 gap-x-2 ">
                        <span className="font-bold">Зарегистрирован:</span>
                        <span className="font-normal">
                          {formatDate(user.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <CardButtons
                    item={user}
                    typeOfItem="user"
                    alwaysCompactOnPhone
                  />
                </div>
              </div>
              {/* <div className="flex-col justify-end flex-1 hidden px-2 tablet:flex"> */}
              {/* <div className="flex-1"> */}
              {/* {user.about && (
                <div>
                  <span className="font-bold">Обо мне:</span>
                  <span>{user.about}</span>
                </div>
              )}
              {user.profession && (
                <div>
                  <span className="font-bold">Профессия:</span>
                  <span>{user.profession}</span>
                </div>
              )}
              {user.interests && (
                <div>
                  <span className="font-bold">Интересы:</span>
                  <span>{user.interests}</span>
                </div>
              )} */}
              {/* </div> */}
              {/* <ContactsIconsButtons
                className="hidden px-2 tablet:flex"
                user={user}
              /> */}
              {/* </div> */}
            </div>
          </div>
          {/* <ContactsIconsButtons className="px-2 tablet:hidden" user={user} /> */}
        </div>
      </div>
    </CardWrapper>
  )
}

export default UserCard
