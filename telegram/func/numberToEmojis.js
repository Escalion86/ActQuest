const numberToEmojis = (number) => {
  if (!number) return '\u{0030}\u{20E3}'

  if (number == 10) return `\u{1F51F}`

  var digits = number.toString().split('')
  const emojis = digits.map((digit) => {
    switch (digit) {
      case '0':
        return `\u{0030}\u{20E3}`
      case '1':
        return `\u{0031}\u{20E3}`
      case '2':
        return `\u{0032}\u{20E3}`
      case '3':
        return `\u{0033}\u{20E3}`
      case '4':
        return `\u{0034}\u{20E3}`
      case '5':
        return `\u{0035}\u{20E3}`
      case '6':
        return `\u{0036}\u{20E3}`
      case '7':
        return `\u{0037}\u{20E3}`
      case '8':
        return `\u{0038}\u{20E3}`
      case '9':
        return `\u{0039}\u{20E3}`
      default:
        return `\u{002A}\u{20E3}`
    }
  })
  return emojis.join('')
}

export default numberToEmojis
