import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getAvailability, listMeetingTypes } from '@repo/sdk'
import type { Availability, AvailabilityDay, MeetingType } from '@repo/sdk'

// Страница записи: календарь на 14 дней и слоты выбранного дня
// через сгенерированный SDK (спецификация §7, §11; ADR-0002).
type LoadState = 'loading' | 'error' | 'success'

// Время показываем по Москве — пояс владельца (спецификация §3).
const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
})

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  weekday: 'short',
  day: 'numeric',
  month: 'long',
})

function dayLabel(date: string): string {
  return dayFormatter.format(new Date(`${date}T00:00:00Z`))
}

function slotLabel(startIso: string, endIso: string): string {
  const start = timeFormatter.format(new Date(startIso))
  const end = timeFormatter.format(new Date(endIso))
  return `${start}–${end}`
}

const STATUS_LABELS: Record<AvailabilityDay['slots'][number]['status'], string> = {
  free: 'Свободно',
  taken: 'Занято',
}

export function BookPage() {
  const [searchParams] = useSearchParams()
  const meetingTypeId = searchParams.get('type') ?? undefined

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [meetingType, setMeetingType] = useState<MeetingType | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    if (!meetingTypeId) {
      setLoadState('error')
      return
    }
    let cancelled = false

    // Доступность и список типов приходят разными операциями API (§10):
    // из списка берём длительность для блока «Информация».
    Promise.all([getAvailability({ query: { meetingTypeId } }), listMeetingTypes()])
      .then(([availabilityResult, meetingTypesResult]) => {
        if (cancelled) {
          return
        }
        if (availabilityResult.error || meetingTypesResult.error) {
          setLoadState('error')
          return
        }
        const data = availabilityResult.data
        const type =
          meetingTypesResult.data?.items.find((item) => item.id === meetingTypeId) ?? null
        setAvailability(data)
        setMeetingType(type)
        setSelectedDate(data?.days[0]?.date ?? null)
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
  }, [meetingTypeId])

  if (!meetingTypeId) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Записаться</h1>
        <p className="text-slate-600">Тип встречи не выбран.</p>
        <Link to="/" className="font-medium text-slate-900 underline hover:no-underline">
          На главную
        </Link>
      </main>
    )
  }

  const selectedDay = availability?.days.find((day) => day.date === selectedDate) ?? null
  const freeCount = selectedDay?.slots.filter((slot) => slot.status === 'free').length ?? 0

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 bg-slate-50 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Выберите время</h1>
        {meetingType && <p className="mt-1 text-slate-600">{meetingType.title}</p>}
      </header>

      {loadState === 'loading' && <p className="text-slate-600">Загружаем свободные слоты…</p>}
      {loadState === 'error' && (
        <p role="alert" className="text-slate-600">
          Не удалось загрузить свободные слоты. Обновите страницу.
        </p>
      )}

      {loadState === 'success' && availability && (
        <>
          {/* Календарь окна записи: всегда 14 дней (спецификация §7). */}
          <section aria-label="Дни записи">
            <h2 className="mb-2 text-sm font-medium text-slate-500">Дни записи</h2>
            <div role="group" aria-label="Дни записи" className="flex flex-wrap gap-2">
              {availability.days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  aria-pressed={day.date === selectedDate}
                  onClick={() => setSelectedDate(day.date)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    day.date === selectedDate
                      ? 'border-slate-900 bg-slate-900 font-medium text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {dayLabel(day.date)}
                </button>
              ))}
            </div>
          </section>

          {/* Блок «Информация»: число свободных слотов и длительность (§11). */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <h2 className="text-sm font-medium text-slate-500">Информация</h2>
            <p className="mt-1">Свободных слотов на этот день: {freeCount}</p>
            {meetingType && (
              <p className="mt-1">Длительность: {meetingType.durationMinutes} минут</p>
            )}
          </section>

          {/* Слоты выбранного дня: пустой день — нормальное состояние (§4). */}
          <section aria-label="Слоты дня">
            <h2 className="mb-2 text-sm font-medium text-slate-500">
              {selectedDay ? `Слоты на ${selectedDate}` : 'Слоты'}
            </h2>
            {selectedDay && selectedDay.slots.length === 0 && (
              <p className="text-slate-600">На этот день свободных слотов нет.</p>
            )}
            <ul className="flex flex-col gap-2">
              {selectedDay?.slots.map((slot) => (
                <li
                  key={slot.start}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5"
                >
                  <span className="text-slate-900">{slotLabel(slot.start, slot.end)}</span>
                  <span
                    className={
                      slot.status === 'free'
                        ? 'font-medium text-emerald-700'
                        : 'text-slate-400 line-through'
                    }
                  >
                    {STATUS_LABELS[slot.status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Link to="/" className="font-medium text-slate-900 underline hover:no-underline">
        На главную
      </Link>
    </main>
  )
}
