const contentType = 'application/json'

export const getData = async (
  url,
  form,
  callbackOnSuccess = null,
  callbackOnError = null
) => {
  const getArray = []

  for (const key in form) {
    getArray.push(key + '=' + form[key])
  }

  const actualUrl = url + (getArray.length > 0 ? '?' + getArray.join('&') : '')
  console.log('actualUrl :>> ', actualUrl)
  try {
    const res = await fetch(actualUrl, {
      method: 'GET',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
    })
    console.log('res :>> ', res)
    // Throw error with status code in case Fetch API req failed
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text)
    }

    const json = await res.json()

    // mutate(url, data, false) // Update the local data without a revalidation
    if (callbackOnSuccess) callbackOnSuccess(json)
    return json
  } catch (error) {
    console.log('Failed to update (GET) on ' + actualUrl)
    console.log(error)
    if (callbackOnError) callbackOnError(error)
    return null
  }
}

export const putData = async (
  url,
  form,
  callbackOnSuccess = null,
  callbackOnError = null
) => {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
      body: JSON.stringify(form),
    })

    // Throw error with status code in case Fetch API req failed
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text)
    }

    const json = await res.json()

    // mutate(url, data, false) // Update the local data without a revalidation
    if (callbackOnSuccess) callbackOnSuccess(json)
    return json
  } catch (error) {
    console.log('Failed to update (PUT) on ' + url)
    console.log(error)
    if (callbackOnError) callbackOnError(error)
    return error
  }
}

/* The POST method adds a new entry in the mongodb database. */
export const postData = async (
  url,
  form,
  callbackOnSuccess = null,
  callbackOnError = null
) => {
  try {
    const body = JSON.stringify(form)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
      body,
    })

    // Throw error with status code in case Fetch API req failed
    if (!res.ok) {
      const text = await res.text()
      throw new Error(JSON.stringify(JSON.parse(text), null, '\t'))
    }
    // if (!res.ok) {
    //   throw new Error(await res.json())
    // }
    const json = await res.json()

    // mutate(url, data, false)
    if (callbackOnSuccess) callbackOnSuccess(json)
    return json
  } catch (error) {
    console.log('Failed to add (POST) on ' + url)
    console.log(error)
    if (callbackOnError) callbackOnError(error)
    return error
  }
}

export const deleteData = async (
  url,
  callbackOnSuccess = null,
  callbackOnError = null,
  params = {}
) => {
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
      body: JSON.stringify({ params }),
      // body: dontAddUserId
      //   ? JSON.stringify(form)
      //   : JSON.stringify({ data: form, userId }),
    })

    // Throw error with status code in case Fetch API req failed
    if (!res.ok) {
      throw new Error(res.status)
    }
    const json = await res.json()

    // mutate(url, data, false) // Update the local data without a revalidation
    if (callbackOnSuccess) callbackOnSuccess(json)
  } catch (error) {
    console.log('Failed to delete on ' + url)
    console.log(error)
    if (callbackOnError) callbackOnError(error)
  }
}
