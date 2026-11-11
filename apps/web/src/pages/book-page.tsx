import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { createBooking, getAvailability, listMeetingTypes } from '@repo/sdk'
import type { Availability, AvailabilityDay, AvailabilitySlot, MeetingType } from '@repo/sdk'
import { INPUT_LIMITS, dayLabel, slotLabel } from '../lib/calendar-ui'

// Страница записи: календарь на 14 дней и двухшаговый выбор — свободный
// слот, затем по «Продолжить» форма имени и email (спецификация §7, §8, §11).
type LoadState = 'loading' | 'error' | 'success'

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

  // Выбранный свободный слот и шаг экрана: клик по слоту активирует
  // «Продолжить», форма имени и email открывается этой кнопкой (§11).
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookedSlot, setBookedSlot] = useState<AvailabilitySlot | null>(null)

  // Данные гостя живут на уровне страницы: после конфликта гость
  // возвращается к выбору слота, не теряя введённое (§11).
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

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

  /** Выбор свободного слота активирует «Продолжить» (спецификация §11). */
  function selectSlot(slot: AvailabilitySlot): void {
    setSelectedSlot(slot)
    setSubmitError(null)
    setBookedSlot(null)
  }

  /** «Продолжить» открывает форму имени и email для выбранного слота. */
  function openGuestForm(): void {
    setFormOpen(true)
  }

  /** Забронированный слот становится занятым в календаре (спецификация §11). */
  function markSlotTaken(startIso: string): void {
    setAvailability((prev) =>
      prev
        ? {
            ...prev,
            days: prev.days.map((day) => ({
              ...day,
              slots: day.slots.map((slot) =>
                slot.start === startIso ? { ...slot, status: 'taken' as const } : slot,
              ),
            })),
          }
        : prev,
    )
  }

  /**
   * Перечитывает доступность через SDK: конфликтный слот и брони других
   * гостей становятся занятыми (спецификация §11).
   */
  async function refreshAvailability(): Promise<void> {
    if (!meetingTypeId) {
      return
    }
    try {
      const { data, error } = await getAvailability({ query: { meetingTypeId } })
      if (!error && data) {
        setAvailability(data)
      }
    } catch {
      // При ошибке перечитывания остаётся локальная пометка конфликтного
      // слота; остальные статусы обновятся при следующей загрузке.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedSlot || !meetingTypeId) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const { data, error } = await createBooking({
        body: {
          meetingTypeId,
          start: selectedSlot.start,
          name: guestName,
          email: guestEmail,
        },
      })

      if (error) {
        if (error.code === 'slot_taken') {
          // Конфликт: время только что заняли. Гость возвращается к выбору
          // слота с сохранением имени и email, календарь перечитывается
          // (спецификация §11).
          setSubmitError(error.message)
          setFormOpen(false)
          setSelectedSlot(null)
          markSlotTaken(selectedSlot.start)
          void refreshAvailability()
          return
        }
        setSubmitError(error.message)
        return
      }

      markSlotTaken(data.start)
      setBookedSlot(selectedSlot)
      setFormOpen(false)
      // Слот занят: до нового выбора «Продолжить» неактивна (§11).
      setSelectedSlot(null)
    } catch {
      setSubmitError('Не удалось отправить бронь. Попробуйте ещё раз.')
    } finally {
      setIsSubmitting(false)
    }
  }

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

          {/* Ошибка отправки брони: видна и при открытой форме, и после
              возврата к выбору слота — конфликт (спецификация §11). */}
          {submitError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </p>
          )}

          {/* Слоты выбранного дня: пустой день — нормальное состояние (§4). */}
          <section aria-label="Слоты дня">
            <h2 className="mb-2 text-sm font-medium text-slate-500">
              {selectedDay ? `Слоты на ${selectedDate}` : 'Слоты'}
            </h2>
            {selectedDay && selectedDay.slots.length === 0 && (
              <p className="text-slate-600">На этот день свободных слотов нет.</p>
            )}
            <ul className="flex flex-col gap-2">
              {selectedDay?.slots.map((slot) =>
                slot.status === 'free' ? (
                  // Свободный слот выбирается кликом: выбор активирует
                  // «Продолжить» ниже (спецификация §11).
                  <li key={slot.start}>
                    <button
                      type="button"
                      aria-pressed={selectedSlot?.start === slot.start}
                      onClick={() => selectSlot(slot)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left transition hover:border-slate-400 aria-pressed:border-slate-900 aria-pressed:bg-slate-900"
                    >
                      <span className="text-slate-900 aria-pressed:text-white">
                        {slotLabel(slot.start, slot.end)}
                      </span>
                      <span className="font-medium text-emerald-700 aria-pressed:text-white">
                        {STATUS_LABELS[slot.status]}
                      </span>
                    </button>
                  </li>
                ) : (
                  <li
                    key={slot.start}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5"
                  >
                    <span className="text-slate-900">{slotLabel(slot.start, slot.end)}</span>
                    <span className="text-slate-400 line-through">
                      {STATUS_LABELS[slot.status]}
                    </span>
                  </li>
                ),
              )}
            </ul>

            {/* «Продолжить»: активна, только когда выбран свободный слот.
                У типа без свободных слотов в окне выбрать нечего, и кнопка
                неактивна (спецификация §11). Пока открыта форма, кнопка
                скрыта — её заменяет «Изменить». */}
            {!formOpen && (
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={openGuestForm}
                className="mt-3 rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                Продолжить
              </button>
            )}
          </section>

          {/* Успех: слот занят, гостю показывают подтверждение (спецификация §11). */}
          {bookedSlot && (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
            >
              Бронь подтверждена. До встречи!
            </p>
          )}

          {/* Форма брони: имя и email для выбранного слота (спецификация §8, §11). */}
          {selectedSlot && formOpen && (
            <section aria-label="Данные гостя">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  Выбрано время: {slotLabel(selectedSlot.start, selectedSlot.end)}
                </h2>
                <div className="flex flex-col gap-1">
                  <label htmlFor="guest-name" className="font-medium text-slate-900">
                    Имя
                  </label>
                  <input
                    id="guest-name"
                    name="name"
                    type="text"
                    required
                    maxLength={INPUT_LIMITS.guestName}
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="guest-email" className="font-medium text-slate-900">
                    Email
                  </label>
                  <input
                    id="guest-email"
                    name="email"
                    type="email"
                    required
                    maxLength={INPUT_LIMITS.guestEmail}
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    Подтвердить запись
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition hover:border-slate-400"
                  >
                    Изменить
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      )}

      <Link to="/" className="font-medium text-slate-900 underline hover:no-underline">
        На главную
      </Link>
    </main>
  )
}
