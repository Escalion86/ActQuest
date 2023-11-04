import Head from 'next/head'
import Script from 'next/script'
import TelegramLoginButton from 'react-telegram-login'

const handleTelegramResponse = (response) => {
  console.log(response)
}

export default function Home(props) {
  return (
    <>
      <Head>
        <title>{`ActQuest`}</title>
      </Head>
      <div>{'ActQuest'}</div>
      <TelegramLoginButton
        dataOnauth={handleTelegramResponse}
        botName="ActQuest_dev_bot"
      />
      {/* <Script
        async
        src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login="ActQuest_dev_bot"
        data-size="large"
        data-onauth="onTelegramAuth(user)"
        data-request-access="write"
      ></Script>
      <Script type="text/javascript">
        {`function onTelegramAuth(user) {
    alert('Logged in as ' + user.first_name + ' ' + user.last_name + ' (' + user.id + (user.username ? ', @' + user.username : '') + ')');
  }`}
      </Script> */}
    </>
  )
}
