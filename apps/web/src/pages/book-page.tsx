import { Link } from 'react-router'

// Заглушка страницы записи: гостевой флоу бронирования — issue #9.
export function BookPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Записаться</h1>
      <p className="text-slate-600">Флоу записи появится на следующем этапе.</p>
      <Link to="/" className="font-medium text-slate-900 underline hover:no-underline">
        На главную
      </Link>
    </main>
  )
}
