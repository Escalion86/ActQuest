export async function fetchingAll(setState = () => {}) {
  const urls = ['/api/admin']
  const result = await Promise.all(
    urls.map(async (url) => {
      const resp = await fetch(url)
        .then((res) => res.json())
        .then((json) => json.data)
      return resp
    })
  )
  setState(result[0])
  return result[0]
}

export async function fetchingUsers(location = process.env.NEXTAUTH_SITE) {
  const resp = await fetch(`${location}/api/users`)
    .then((res) => res.json())
    .then((json) => json.data)
    .catch((error) => console.log('fetchingUsers ERROR:', error))
  return resp
}

export async function fetchingUsersById(
  id,
  location = process.env.NEXTAUTH_SITE
) {
  const resp = await fetch(`${location}/api/users/byId/${id}`)
    .then((res) => res.json())
    .then((json) => json.data)
    .catch((error) => console.log('fetchingUsersById ERROR:', error))
  return resp
}

export async function fetchingUserByPhone(
  phone,
  location = process.env.NEXTAUTH_SITE
) {
  const resp = await fetch(`${location}/api/users/byPhone/${phone}`)
    .then((res) => res.json())
    .then((json) => json.data)
    .catch((error) => console.log('fetchingUserByPhone ERROR:', error))
  return resp
}

export async function fetchingLog(data, location = process.env.NEXTAUTH_SITE) {
  // console.log('Запущен fetchingLog')
  const resp = await fetch(`${location}/api/log`, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    // mode: 'cors', // no-cors, *cors, same-origin
    // cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    // credentials: 'same-origin', // include, *same-origin, omit
    // headers: {
    // 'Content-Type': 'application/json'
    // 'Content-Type': 'application/x-www-form-urlencoded',
    // },
    // redirect: 'follow', // manual, *follow, error
    // referrerPolicy: 'no-referrer', // no-referrer, *client
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  })
    .then((res) => res.json())
    .then((json) => json.data)
    .catch((error) => console.log('fetchingLog ERROR:', error))
  return resp
}

export async function fetchingSiteSettings(
  location = process.env.NEXTAUTH_SITE
) {
  const resp = await fetch(`${location}/api/site`)
    .then((res) => res.json())
    .then((json) => json.data)
    .catch((error) => console.log('fetchingSiteSettings ERROR:', error))
  return resp
}
