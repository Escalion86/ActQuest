const buttonListConstructor = (array, page, itemFunc) => {
  const buttons = array
    .filter((item, index) => index < page * 10 && index >= (page - 1) * 10)
    .map((item, index) => itemFunc(item, `${index + 1 + (page - 1) * 10}`))

  return [
    ...buttons,
    [
      {
        c: { page: page - 1 },
        text: `\u{25C0} ${page - 2 || ''}1-${page - 1}0`,
        hide: page <= 1,
      },
      {
        c: { page: page + 1 },
        text: `${page}1-${
          (page + 1) * 10 > array.length ? array.length : (page + 1) * 10
        } \u{25B6}`,
        hide: array.length < page * 10,
      },
    ],
  ]
}

export default buttonListConstructor
