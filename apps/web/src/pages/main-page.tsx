import { Link } from 'react-router'
import { seedMeetingType } from '../data/seed'

export function MainPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-50 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Календарь звонков</h1>
        <p className="mt-2 text-slate-600">Выберите тип встречи и запишитесь на свободный слот.</p>
      </header>
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{seedMeetingType.title}</h2>
        <p className="mt-1 text-slate-600">{seedMeetingType.durationMinutes} минут</p>
        <Link
          to="/book"
          className="mt-6 block rounded-lg bg-slate-900 px-4 py-2.5 text-center font-medium text-white transition hover:bg-slate-700"
        >
          Записаться
        </Link>
      </section>
    </main>
  )
}
