const contentType = 'application/json'

let ensureIpv4FirstPromise

const ensureIpv4First = async () => {
  if (typeof window !== 'undefined') return

  if (!ensureIpv4FirstPromise) {
    ensureIpv4FirstPromise = (async () => {
      let dnsModule

      try {
        dnsModule = await import('node:dns')
      } catch (nodeDnsError) {
        try {
          dnsModule = await import('dns')
        } catch (error) {
          console.warn('IPv4 helper: failed to load dns module, cannot set IPv4 preference.', error)
          return
        }
      }

      const dns = dnsModule?.default ?? dnsModule

      if (!dns) {
        console.warn('IPv4 helper: dns module unavailable, cannot set IPv4 preference.')
        return
      }

      try {
        if (typeof dns.setDefaultResultOrder === 'function') {
          dns.setDefaultResultOrder('ipv4first')
          return
        }

        const setDefaultResultOrder = dns.promises?.setDefaultResultOrder
        if (typeof setDefaultResultOrder === 'function') {
          setDefaultResultOrder.call(dns.promises, 'ipv4first')
        } else if (dns.lookup) {
          const originalLookup = dns.lookup
          dns.lookup = (...args) => {
            if (typeof args[1] === 'function') {
              return originalLookup.call(dns, args[0], { family: 4, all: false }, args[1])
            }

            const options = { ...(args[1] || {}), family: 4, all: false }
            return originalLookup.call(dns, args[0], options, args[2])
          }
        }
      } catch (error) {
        console.warn('IPv4 helper: failed to enforce IPv4 DNS preference.', error)
      }
    })()
  }

  return ensureIpv4FirstPromise
}

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
    await ensureIpv4First()
    const res = await fetch(actualUrl, {
      method: 'GET',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
      ...(connectionOptions ?? {}),
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
    await ensureIpv4First()
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
      body: JSON.stringify(form),
      ...(connectionOptions ?? {}),
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
    await ensureIpv4First()
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
      body,
      ...(connectionOptions ?? {}),
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
    await ensureIpv4First()
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: contentType,
        'Content-Type': contentType,
      },
      body: JSON.stringify({ params }),
      ...(connectionOptions ?? {}),
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
