export const metadata = {
  title: 'ActQuest — App Router Check',
}

export default function MigrationCheckPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          width: '100%',
          border: '1px solid rgba(0,209,255,0.35)',
          borderRadius: '16px',
          padding: '20px',
          background:
            'linear-gradient(180deg, rgba(10,0,30,0.95), rgba(8,18,45,0.95))',
          color: '#dbeafe',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
          App Router активен
        </h1>
        <p style={{ marginTop: '12px', marginBottom: 0, lineHeight: 1.5 }}>
          Это пилотный маршрут для безопасного старта миграции. Текущий
          `pages`-роутер продолжает работать параллельно.
        </p>
        <ul style={{ marginTop: '14px', marginBottom: 0, paddingLeft: '18px' }}>
          <li>UI pilot: `/cabinet-app/games-upcoming`, `/cabinet-app/games-past`, `/cabinet-app/profile`, `/cabinet-app/teams`</li>
          <li>API pilot: `/api-pilot/cabinet/teams`</li>
        </ul>
      </div>
    </main>
  )
}
