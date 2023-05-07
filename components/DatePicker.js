import formatDate from '@helpers/formatDate'
import cn from 'classnames'
import InputWrapper from './InputWrapper'

const DatePicker = ({
  label = '',
  name,
  value,
  onChange,
  required = false,
  labelClassName,
  // wrapperClassName,
  className,
  disabled = false,
  showYears = false,
  showZodiac = false,
  error,
  fullWidth,
  defaultValue,
  noMargin,
}) => {
  return (
    <InputWrapper
      label={label}
      labelClassName={labelClassName}
      onChange={onChange}
      copyPasteButtons={false}
      value={value}
      className={cn(fullWidth ? '' : 'w-48', className)}
      required={required}
      error={error}
      fullWidth={fullWidth}
      paddingY="small"
      disabled={disabled}
      noMargin={noMargin}
    >
      <input
        className={cn(
          'text-input px-1 rounded focus:outline-none bg-transparent h-[26px] m-0',
          // required && !value ? ' border-red-700' : ' border-gray-400',
          { 'text-disabled cursor-not-allowed': disabled }
        )}
        type="date"
        name={name}
        value={value ? formatDate(value, true) : undefined}
        defaultValue={defaultValue ? formatDate(defaultValue, true) : undefined}
        onChange={(e) => {
          const value = e.target.value
          var year = value.substring(0, 4)
          var month = value.substring(5, 7)
          var day = value.substring(8, 10)

          onChange(new Date(year, month - 1, day).toISOString())
        }}
        pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
        // min="2018-01-01"
        // max="2018-12-31"
      />
    </InputWrapper>
  )
}

export default DatePicker
