import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMoneyBill,
  faPencil,
  faPencilAlt,
  faPlus,
  // faSearch,
  faTimes,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { UserItem } from './ItemCards'

import cn from 'classnames'
import usersAtom from '@state/atoms/usersAtom'
import { useRecoilValue } from 'recoil'
import { modalsFuncAtom } from '@state/atoms'
import InputWrapper from './InputWrapper'
import filterWithRules from '@helpers/filterWithRules'
import Tooltip from './Tooltip'

export const SelectItem = ({
  items,
  itemComponent,
  // onChange,
  selectedId = null,
  // exceptedIds = [],
  className = '',
  // dropDownList = true,
  onClick = null,
  itemHeight,
  // noSearch = false,
  itemWidth,
  componentHeight,
  // moreOneFilterTurnOn = true,
  // onNoChoose,
}) => {
  // const [isMenuOpen, setIsMenuOpen] = useState(selectedId === '?')
  // const [searchText, setSearchText] = useState('')
  // const [moreOneFilter, setMoreOneFilter] = useState(moreOneFilterTurnOn)

  // const ref = useRef()
  // const inputRef = useRef()

  // const moreOneFilterTurnOnExists = items.length && items[0].count !== undefined

  const selectedItem = selectedId
    ? items.find((item) => item._id === selectedId)
    : null

  const Item = itemComponent

  // const preFilteredItemsArray = isMenuOpen
  //   ? [...filterItems(items, null, exceptedIds, {})].sort((a, b) =>
  //       a.name < b.name ? -1 : 1
  //     )
  //   : []

  // const filteredItemsArray = isMenuOpen
  //   ? filterItems(
  //       preFilteredItemsArray,
  //       searchText,
  //       [],
  //       moreOneFilterTurnOnExists && moreOneFilter ? { count: '>0' } : {}
  //     ).sort((a, b) => {
  //       if (a.name < b.name) {
  //         return -1
  //       }
  //       if (a.name > b.name) {
  //         return 1
  //       }
  //       return 0
  //     })
  //   : []

  // const toggleIsMenuOpen = () => {
  //   if (isMenuOpen && onNoChoose) onNoChoose()
  //   setIsMenuOpen((state) => !state)
  // }

  // const isSearchVisible = !noSearch && preFilteredItemsArray.length > 0

  // useEffect(() => {
  //   const checkIfClickedOutside = (e) => {
  //     if (
  //       !onClick &&
  //       dropDownList &&
  //       isMenuOpen &&
  //       ref.current &&
  //       !ref.current.contains(e.target)
  //     ) {
  //       if (isMenuOpen && onNoChoose) onNoChoose()
  //       setIsMenuOpen(false)
  //     }
  //   }

  //   document.addEventListener('mousedown', checkIfClickedOutside)

  //   if (isMenuOpen && isSearchVisible) inputRef.current.focus()

  //   return () => {
  //     document.removeEventListener('mousedown', checkIfClickedOutside)
  //   }
  // }, [onClick, dropDownList, isMenuOpen, ref, inputRef])

  return (
    <div
      className={cn(
        className,
        onClick ? 'cursor-pointer' : 'cursor-not-allowed',
        'relative bg-gray-100 flex justify-center items-center'
      )}
      style={{ height: itemHeight, width: itemWidth }}
      onClick={
        onClick
          ? () =>
              // if ((!selectedItem || !onClick) && dropDownList) toggleIsMenuOpen()
              onClick(selectedItem)
          : null
      }
      // ref={ref}
    >
      {/* {dropDownList && (
        <div
          className={cn(
            'absolute border overflow-hidden max-h-64 transform duration-300 ease-out flex flex-col top-full -left-[1px] -right-[1px] bg-white shadow border-gray-700 z-50',
            { hidden: !isMenuOpen },
            { 'opacity-0': !isMenuOpen }
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isSearchVisible && (
            <div
              className={cn(
                'flex gap-1 items-center border-gray-700 border-b p-1',
                { hidden: !isMenuOpen }
              )}
            >
              <input
                ref={inputRef}
                className="flex-1 outline-none"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <FontAwesomeIcon
                className={'w-6 h-6 text-gray-700 cursor-pointer'}
                icon={searchText ? faTimes : faSearch}
                onClick={
                  searchText
                    ? () => setSearchText('')
                    : () => inputRef.current.focus()
                }
              />
              {moreOneFilterTurnOnExists ? (
                <div
                  className={cn(
                    moreOneFilter ? 'bg-yellow-400' : 'bg-primary',
                    'hover:bg-toxic text-white flex items-center justify-center font-bold rounded cursor-pointer w-7 h-7'
                  )}
                  onClick={() => setMoreOneFilter(!moreOneFilter)}
                >
                  {'>0'}
                </div>
              ) : null}
            </div>
          )}
          {isMenuOpen &&
            (filteredItemsArray.length > 0 ? (
              <Virtuoso
                totalCount={filteredItemsArray.length}
                style={{
                  maxHeight: 400,
                  height: filteredItemsArray.length * itemHeight,
                }}
                className={cn({ hidden: !isMenuOpen })}
                data={filteredItemsArray}
                itemContent={(index, item) => (
                  <Item
                    key={item._id}
                    item={item}
                    onClick={() => {
                      setIsMenuOpen(false)
                      onChange(item)
                    }}
                    active={item._id === selectedId}
                  />
                )}
              />
            ) : (
              <div className="text-center bg-red-100">Нет элементов</div>
            ))}
        </div>
      )} */}
      {selectedItem ? (
        <Item item={selectedItem} />
      ) : (
        <div
          className="flex items-center justify-center text-sm text-gray-800"
          style={{ height: componentHeight }}
        >
          Не выбрано
        </div>
      )}
    </div>
  )
}

const ItemButton = ({
  onClick,
  icon,
  iconClassName,
  tooltip,
  text,
  textClassName,
  thin,
}) => (
  <div className="flex items-center justify-center bg-gray-100 border-l border-gray-700">
    <Tooltip title={tooltip}>
      <button
        onClick={onClick}
        className={cn(
          'flex items-center justify-center gap-x-0.5 h-full rounded-r shadow group whitespace-nowrap font-futuraDemi',
          thin ? 'px-1' : 'px-1.5'
        )}
      >
        {icon ? (
          <FontAwesomeIcon
            className={cn(
              'w-4 h-4 duration-300 group-hover:scale-125',
              iconClassName
            )}
            icon={icon}
          />
        ) : null}
        {text ? <div className={cn(textClassName)}>{text}</div> : null}
      </button>
    </Tooltip>
  </div>
)

const SelectItemContainer = ({
  required,
  label = '',
  onClickClearButton = null,
  onCreateNew,
  onEdit,
  bordered = true,
  children,
  error,
  buttons,
  selectedId,
  labelClassName,
  className,
  rounded = false,
}) => {
  const Container = ({ children }) => {
    if (label)
      return (
        <InputWrapper
          label={label}
          labelClassName={labelClassName}
          // onChange={onChange}
          // value={images}
          wrapperClassName={cn('flex-1 ', className)}
          required={required}
          value={selectedId}
          error={error}
          // paddingX={false}
          // paddingY={false}
          // noMargin
          // noBorder
          // labelPos="top"
        >
          {/* <label className="flex items-center justify-end leading-4 text-right">
      {label}
      {required && <span className="text-red-700">*</span>}
    </label> */}
          <div
            className={cn(
              'flex flex-1',
              rounded ? 'rounded overflow-hidden' : '',
              // error
              //   ? 'border border-red-500'
              //   :
              bordered ? 'border border-gray-700' : ''
            )}
          >
            {children}
          </div>
        </InputWrapper>
      )

    return (
      // <InputWrapper
      //   label={label}
      //   labelClassName={labelClassName}
      //   // onChange={onChange}
      //   // value={images}
      //   wrapperClassName={cn('flex-1 ', className)}
      //   required={required}
      //   value={selectedId}
      //   paddingX={false}
      //   paddingY={false}
      //   noMargin
      //   noBorder
      //   // labelPos="top"
      // >
      // {/* <label className="flex items-center justify-end leading-4 text-right">
      //   {label}
      //   {required && <span className="text-red-700">*</span>}
      // </label> */}
      <div
        className={cn(
          'flex flex-1',
          rounded ? 'rounded overflow-hidden' : '',
          error
            ? 'border border-red-500'
            : bordered
            ? 'border border-gray-700'
            : '',
          className
        )}
      >
        {children}
      </div>
      // {/* </InputWrapper> */}
    )
  }

  return (
    <Container>
      {children}
      {buttons &&
        buttons.map((item, index) => {
          const {
            onClick,
            icon,
            iconClassName,
            tooltip,
            text,
            textClassName,
            thin,
          } = item(selectedId)
          return (
            <ItemButton
              key={'button' + selectedId + index}
              tooltip={tooltip}
              onClick={onClick}
              icon={icon}
              iconClassName={iconClassName}
              text={text}
              textClassName={textClassName}
              thin={thin}
            />
          )
        })}
      {onEdit && (
        <ItemButton
          tooltip="Редактировать"
          onClick={onEdit}
          icon={faPencilAlt}
          iconClassName="text-primary"
        />
      )}
      {onCreateNew && (
        <ItemButton
          tooltip="Создать новый"
          onClick={onCreateNew}
          icon={faPlus}
          iconClassName="text-primary"
        />
      )}
      {onClickClearButton && (
        <ItemButton
          tooltip="Удалить из списка"
          onClick={onClickClearButton}
          icon={faTimes}
          iconClassName="text-red-700"
        />
      )}
    </Container>
  )
}

export const SelectUser = ({
  onChange,
  onDelete,
  selectedId = null,
  exceptedIds = [],
  required = false,
  clearButton = null,
  label,
  filter,
  // disableDropDownList,
  error,
  bordered = true,
  modalTitle,
  buttons,
  rounded = true,
  readOnly,
}) => {
  const users = useRecoilValue(usersAtom)
  const modalsFunc = useRecoilValue(modalsFuncAtom)

  const filteredUsers = filterWithRules(users, filter)

  const onClickClearButton =
    selectedId && clearButton
      ? onDelete
        ? () => onDelete()
        : () => onChange(null)
      : null

  return (
    <SelectItemContainer
      required={required}
      label={label}
      onClickClearButton={onClickClearButton}
      bordered={bordered}
      error={error}
      rounded={rounded}
      buttons={buttons}
      // buttons={
      //   onChange
      //     ? [
      //         {
      //           onClick: () =>
      //             modalsFunc.selectUsers(
      //               [selectedId],
      //               [],
      //               (data) => onChange(data[0]),
      //               [],
      //               1,
      //               false
      //             ),
      //           icon: faPencil,
      //           iconClassName: 'text-orange-400',
      //           tooltip: 'Изменить',
      //         },
      //       ]
      //     : null
      // }
      selectedId={selectedId}
    >
      <SelectItem
        items={filteredUsers}
        itemComponent={(props) => UserItem({ ...props, bordered })}
        componentHeight={40}
        // onChange={onChange}
        selectedId={selectedId}
        className={cn(
          'flex-1',
          selectedId && clearButton ? 'rounded-l' : 'rounded'
        )}
        exceptedIds={exceptedIds}
        onClick={
          !readOnly
            ? // (user) => modalsFunc.user.view(user._id)
              onChange
              ? () =>
                  modalsFunc.selectUsers(
                    [selectedId],
                    filter,
                    (data) => onChange(data[0]),
                    [],
                    1,
                    false,
                    modalTitle
                  )
              : (user) => modalsFunc.user.view(user._id)
            : null
          // disableDropDownList ? (user) => modalsFunc.user.view(user._id) : null
        }
        onNoChoose={onDelete}
      />
    </SelectItemContainer>
  )
}

// export const SelectPayment = ({
//   onChange,
//   onDelete,
//   onCreateNew,
//   onEdit,
//   selectedId = null,
//   exceptedIds = [],
//   required = false,
//   className = null,
//   clearButton = null,
//   label = null,
//   onClick = null,
//   dropDownList,
//   readOnly = false,
// }) => {
//   const { payments } = useSelector((state) => state)
//   const payment = payments.find((payment) => payment._id === selectedId)

//   return (
//     <SelectItemContainer
//       required={required}
//       label={label}
//       className={className}
//       onClickClearButton={
//         selectedId && clearButton
//           ? onDelete
//             ? () => onDelete(payment)
//             : () => onChange(null)
//           : null
//       }
//       onCreateNew={selectedId === '?' ? onCreateNew : null}
//       onEdit={
//         onEdit && selectedId !== '?' && payment ? () => onEdit(payment) : null
//       }
//       readOnly={readOnly}
//     >
//       <SelectItem
//         items={payments}
//         itemComponent={PaymentItem}
//         onChange={onChange}
//         selectedId={selectedId}
//         className={
//           'flex-1' +
//           (!readOnly && selectedId && clearButton
//             ? ' rounded-l-lg'
//             : ' rounded-lg')
//         }
//         exceptedIds={exceptedIds}
//         onClick={selectedId !== '?' && payment ? () => onClick(payment) : null}
//         dropDownList={dropDownList}
//         readOnly={readOnly}
//       />
//     </SelectItemContainer>
//   )
// }
