import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listBookings } from '@repo/sdk'
import type { Booking } from '@repo/sdk'

// Список владельца загружается при входе в раздел и обновляется опросом:
// новая бронь появляется без перезагрузки страницы (критерий приёмки #25).
const REFETCH_INTERVAL_MS = 5000

// Время показываем по Москве — пояс владельца (спецификация §3).
const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: 'numeric',
  month: 'long',
})

function slotLabel(startIso: string, endIso: string): string {
  return `${timeFormatter.format(new Date(startIso))}–${timeFormatter.format(new Date(endIso))}`
}

// Раздел владельца «Предстоящие события»: брони всех типов в одном
// списке (спецификация §9, §11). Сортировку и фильтр делает сервер.
export function AdminBookingsPage() {
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'success'>('loading')
  const [bookings, setBookings] = useState<Booking[]>([])

  useEffect(() => {
    let cancelled = false

    async function refetch(): Promise<void> {
      try {
        const result = await listBookings()
        if (cancelled) {
          return
        }
        if (result.error) {
          setLoadState('error')
          return
        }
        setBookings(result.data?.items ?? [])
        setLoadState('success')
      } catch {
        if (!cancelled) {
          setLoadState('error')
        }
      }
    }

    void refetch()
    const interval = setInterval(() => void refetch(), REFETCH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 bg-slate-50 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Предстоящие события</h1>
        <p className="mt-1 text-slate-600">Брони всех типов встреч в одном списке.</p>
      </header>

      {loadState === 'loading' && <p className="text-slate-600">Загружаем предстоящие события…</p>}
      {loadState === 'error' && (
        <p role="alert" className="text-slate-600">
          Не удалось загрузить предстоящие события. Обновите страницу.
        </p>
      )}

      {loadState === 'success' && bookings.length === 0 && (
        <p className="text-slate-600">Пока нет брони. Новые записи появятся здесь автоматически.</p>
      )}

      {loadState === 'success' && bookings.length > 0 && (
        <ul className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              aria-label={`Бронь: ${booking.guestName}, ${booking.meetingTypeTitle}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{booking.guestName}</h2>
                <p className="shrink-0 text-sm text-slate-600">
                  {dateFormatter.format(new Date(booking.start))},{' '}
                  {slotLabel(booking.start, booking.end)}
                </p>
              </div>
              <p className="mt-1 text-slate-600">{booking.guestEmail}</p>
              <p className="mt-1 text-slate-600">
                <span className="text-slate-500">Тип встречи: </span>
                <span>{booking.meetingTypeTitle}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Запись создана {dateFormatter.format(new Date(booking.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <Link to="/admin" className="font-medium text-slate-900 underline hover:no-underline">
          Создание типа встречи
        </Link>
        <Link to="/" className="text-sm text-slate-500 underline hover:no-underline">
          На главную
        </Link>
      </div>
    </main>
  )
}
