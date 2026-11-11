import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listMeetingTypes } from '@repo/sdk'
import type { MeetingType } from '@repo/sdk'

// Страница загружает типы встреч через сгенерированный SDK (ADR-0002):
// состояния загрузки, ошибки и пустого списка — часть поведения (спецификация §11).
type LoadState = 'loading' | 'error' | 'success'

export function MainPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([])

  useEffect(() => {
    let cancelled = false

    listMeetingTypes()
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.error) {
          setLoadState('error')
          return
        }
        setMeetingTypes(result.data?.items ?? [])
        setLoadState('success')
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-50 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Календарь звонков</h1>
        <p className="mt-2 text-slate-600">Выберите тип встречи и запишитесь на свободный слот.</p>
      </header>
      {loadState === 'loading' && <p className="text-slate-600">Загружаем типы встреч…</p>}
      {loadState === 'error' && (
        <p role="alert" className="text-slate-600">
          Не удалось загрузить типы встреч. Обновите страницу.
        </p>
      )}
      {loadState === 'success' && meetingTypes.length === 0 && (
        <p className="text-slate-600">Типов встреч пока нет — загляните позже.</p>
      )}
      <div className="flex w-full max-w-sm flex-col gap-6">
        {meetingTypes.map((meetingType) => (
          <section
            key={meetingType.id}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">{meetingType.title}</h2>
            {meetingType.description && (
              <p className="mt-1 text-slate-600">{meetingType.description}</p>
            )}
            {/* Длительности кратны 30, поэтому слово «минут» подходит всегда. */}
            <p className="mt-1 text-slate-600">{meetingType.durationMinutes} минут</p>
            <Link
              to={`/book?type=${meetingType.id}`}
              className="mt-6 block rounded-lg bg-slate-900 px-4 py-2.5 text-center font-medium text-white transition hover:bg-slate-700"
            >
              Записаться
            </Link>
          </section>
        ))}
      </div>
      <Link to="/admin" className="text-sm text-slate-500 underline hover:no-underline">
        Экран владельца
      </Link>
    </main>
  )
}
