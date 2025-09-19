const buttonListConstructor = (array, page = 1, itemFunc) => {
  if (typeof page === 'number') {
    if (array?.length === 0) return []

    const maxPage = Math.ceil(array.length / 10)
    const realPage = page > maxPage ? maxPage : page

    const buttons = array
      .filter(
        (item, index) => index < realPage * 10 && index >= (realPage - 1) * 10
      )
      .map((item, index) => itemFunc(item, index + 1 + (realPage - 1) * 10))

    return [
      ...buttons,
      [
        {
          c: { page: realPage - 1 },
          text: `\u{25C0} ${realPage - 2 || ''}1-${realPage - 1}0`,
          hide: realPage <= 1,
        },
        {
          c: { page: realPage + 1 },
          text:
            array.length === realPage * 10 + 1
              ? `${realPage * 10 + 1} \u{25B6}`
              : `${realPage}1-${
                  (realPage + 1) * 10 > array.length
                    ? array.length
                    : (realPage + 1) * 10
                } \u{25B6}`,
          hide: array.length <= realPage * 10,
        },
      ],
      [
        {
          c: { page: realPage - 10 },
          text: `\u{23EA} ${realPage - 11 || ''}1-${realPage - 10}0`,
          hide: realPage <= 10,
        },
        {
          c: { page: realPage + 10 },
          text:
            array.length === realPage * 10 + 10
              ? `${realPage * 10 + 10} \u{23E9}`
              : `${realPage + 9}1-${
                  (realPage + 10) * 10 > array.length
                    ? array.length
                    : (realPage + 10) * 10
                } \u{23E9}`,
          hide: array.length <= realPage * 100,
        },
      ],
    ]
  } else return []
}

export default buttonListConstructor
