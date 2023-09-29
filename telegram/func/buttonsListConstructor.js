const buttonListConstructor = (array, page = 1, itemFunc) => {
  if (typeof page === 'number') {
    if (array?.length === 0) return []
    const buttons = array
      .filter((item, index) => index < page * 10 && index >= (page - 1) * 10)
      .map((item, index) => itemFunc(item, index + 1 + (page - 1) * 10))

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
          text:
            array.length === page * 10 + 1
              ? `${page * 10 + 1} \u{25B6}`
              : `${page}1-${
                  (page + 1) * 10 > array.length
                    ? array.length
                    : (page + 1) * 10
                } \u{25B6}`,
          hide: array.length <= page * 10,
        },
      ],
    ]
  } else return []
}

export default buttonListConstructor
