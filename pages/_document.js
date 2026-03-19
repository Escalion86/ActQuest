import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html className="scroll-smooth" data-scroll-behavior="smooth">
        <Head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  try {
                    var saved = localStorage.getItem('cabinet-theme');
                    var systemDark =
                      window.matchMedia &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var theme =
                      saved === 'dark' || saved === 'light'
                        ? saved
                        : (systemDark ? 'dark' : 'light');

                    var root = document.documentElement;
                    root.setAttribute('data-theme', theme);
                    root.classList.toggle('dark', theme === 'dark');
                    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
                    root.setAttribute('data-theme-ready', '1');
                  } catch (e) {
                    var root = document.documentElement;
                    root.setAttribute('data-theme', 'light');
                    root.classList.remove('dark');
                    root.style.colorScheme = 'light';
                    root.setAttribute('data-theme-ready', '1');
                  }
                })();
              `,
            }}
          />
          <style>{`
            html:not([data-theme-ready='1']) body {
              visibility: hidden;
            }
          `}</style>
          <meta name="application-name" content="ActQuest" />
          <meta name="theme-color" content="#111827" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icons/pwa-icon-192.png" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/icon?family=Material+Icons"
          />
          <link
            href="https://cdn.jsdelivr.net/npm/@tailwindcss/custom-forms@0.2.1/dist/custom-forms.css"
            rel="stylesheet"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
