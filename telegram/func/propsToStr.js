const propsToStr = (props) => {
  const tempArray = []
  for (const key in props) {
    tempArray.push(`${key}=${props[key]}`)
  }
  const result = tempArray.join('/')
  return tempArray.length > 0 ? '/' + result : ''
}

export default propsToStr
