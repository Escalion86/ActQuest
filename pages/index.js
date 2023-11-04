import Head from 'next/head'
// import { TLoginButton, TLoginButtonSize } from 'react-telegram-auth'

export default function Home(props) {
  return (
    <>
      <Head>
        <title>{`ActQuest`}</title>
      </Head>
      <div>{'ActQuest'}</div>
      {/* <TLoginButton
        botName="ActQuest_dev_bot"
        buttonSize={TLoginButtonSize.Large}
        lang="ru"
        usePic={false}
        cornerRadius={20}
        onAuthCallback={(user) => {
          console.log('Hello, user!', user)
        }}
        requestAccess={'write'}
        additionalClasses={'css-class-for-wrapper'}
      />
      <div>раврв</div> */}
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
