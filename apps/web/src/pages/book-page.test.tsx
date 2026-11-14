import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBooking,
  getAvailability,
  listMeetingTypes,
  type Availability,
  type AvailabilitySlot,
  type Booking,
} from '@repo/sdk'
import { BookPage } from './book-page'

// Сеть подменяется на уровне SDK, а не через моки fetch (спецификация §13.3).
vi.mock('@repo/sdk', () => ({
  createBooking: vi.fn(),
  getAvailability: vi.fn(),
  listMeetingTypes: vi.fn(),
}))

// Сид-тип из спецификации §2: «Знакомство», 30 минут, без описания.
const introType = {
  id: 'intro',
  title: 'Знакомство',
  description: null,
  durationMinutes: 30,
}

/** 14 дат окна записи от 11 ноября 2026 (среда) по 24 ноября. */
function windowDates(): string[] {
  return Array.from({ length: 14 }, (_, offset) =>
    new Date(Date.UTC(2026, 10, 11 + offset)).toISOString().slice(0, 10),
  )
}

const freeSlot = {
  start: '2026-11-11T07:00:00Z',
  end: '2026-11-11T07:30:00Z',
  status: 'free',
} as const

const takenSlot = {
  start: '2026-11-11T08:00:00Z',
  end: '2026-11-11T08:30:00Z',
  status: 'taken',
} as const

// Соседний свободный слот 09:00–09:30 по Москве: в тестах конфликта он
// показывает, что календарь перечитан с сервера, а не помечен локально.
const morningSlot = {
  start: '2026-11-11T06:00:00Z',
  end: '2026-11-11T06:30:00Z',
  status: 'free',
} as const

/** Фикстура доступности: слоты первого дня, остальные дни пустые. */
function availabilityWithFirstDay(slots: AvailabilitySlot[]): Availability {
  return {
    meetingTypeId: 'intro',
    days: windowDates().map((date, index) => ({
      date,
      slots: index === 0 ? slots : [],
    })),
  }
}

/** Ответ createBooking с ошибкой конфликта (спецификация §8). */
function slotTakenError(): { data: undefined; error: { code: 'slot_taken'; message: string } } {
  return {
    data: undefined,
    error: { code: 'slot_taken', message: 'Это время только что заняли. Выберите другой слот' },
  }
}

/** Два ответа getAvailability: до конфликта и после него. */
function mockAvailabilityAroundConflict(before: Availability, after: Availability): void {
  vi.mocked(getAvailability)
    .mockReset()
    .mockResolvedValueOnce({ data: before, error: undefined })
    .mockResolvedValueOnce({ data: after, error: undefined })
}

function availabilityFixture(): Availability {
  const secondDaySlot = {
    start: '2026-11-12T06:00:00Z',
    end: '2026-11-12T06:30:00Z',
    status: 'free',
  } as const
  return {
    meetingTypeId: 'intro',
    days: windowDates().map((date, index) => ({
      date,
      slots: index === 0 ? [freeSlot, takenSlot] : index === 1 ? [secondDaySlot] : [],
    })),
  }
}

function mockAvailability(availability: Availability): void {
  vi.mocked(getAvailability).mockResolvedValue({ data: availability, error: undefined })
  vi.mocked(listMeetingTypes).mockResolvedValue({
    data: { items: [introType] },
    error: undefined,
  })
}

// Созданная бронь — форма ответа спецификации §8: id и end серверные.
const bookingFixture: Booking = {
  id: 'b-1',
  meetingTypeId: 'intro',
  meetingTypeTitle: 'Знакомство',
  start: freeSlot.start,
  end: freeSlot.end,
  guestName: 'Анна',
  guestEmail: 'anna@example.com',
  createdAt: '2026-11-11T09:15:00Z',
}

/** Обещание под контролем теста: проверяет состояние isSubmitting. */
function deferredBooking(): {
  promise: Promise<{ data: Booking; error: undefined }>
  resolve: (result: { data: Booking; error: undefined }) => void
} {
  type BookingResult = { data: Booking; error: undefined }
  let resolve!: (result: BookingResult) => void
  const promise = new Promise<BookingResult>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function selectFreeSlot(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  // Первый день выбран по умолчанию, в нём один свободный слот; ждём
  // загрузку календаря, прежде чем кликнуть. Имя кнопки — время и статус.
  // Форма открывается не кликом по слоту, а кнопкой «Продолжить» (§11).
  await user.click(await screen.findByRole('button', { name: /10:00–10:30/ }))
  await user.click(screen.getByRole('button', { name: 'Продолжить' }))
}

function renderBookPage(query = '?type=intro'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/book${query}`]}>
      <BookPage />
    </MemoryRouter>,
  )
}

describe('Страница записи', () => {
  beforeEach(() => {
    mockAvailability(availabilityFixture())
  })

  it('пока данные не пришли, показывает загрузку', () => {
    vi.mocked(getAvailability).mockReturnValue(new Promise<never>(() => {}))
    renderBookPage()

    expect(screen.getByText('Загружаем свободные слоты…')).toBeVisible()
  })

  it('показывает календарь на 14 дней и слоты первого дня', async () => {
    renderBookPage()

    const days = await screen.findByRole('group', { name: 'Дни записи' })
    expect(within(days).getAllByRole('button')).toHaveLength(14)
    // Первый день выбран по умолчанию и содержит свои слоты со статусами.
    expect(within(days).getByRole('button', { pressed: true })).toBeVisible()
    expect(screen.getByText('10:00–10:30 МСК')).toBeVisible()
    expect(screen.getByText('Свободно')).toBeVisible()
    expect(screen.getByText('11:00–11:30 МСК')).toBeVisible()
    expect(screen.getByText('Занято')).toBeVisible()
  })

  it('после выбора другого дня показывает его слоты', async () => {
    const user = userEvent.setup()
    renderBookPage()

    const days = await screen.findByRole('group', { name: 'Дни записи' })
    await user.click(within(days).getByRole('button', { name: /12 ноября/ }))

    expect(screen.getByText('09:00–09:30 МСК')).toBeVisible()
    expect(screen.queryByText('10:00–10:30 МСК')).not.toBeInTheDocument()
  })

  it('пустой день не ломает экран', async () => {
    const user = userEvent.setup()
    renderBookPage()

    // Третий день в фикстуре без слотов.
    const days = await screen.findByRole('group', { name: 'Дни записи' })
    await user.click(within(days).getByRole('button', { name: /13 ноября/ }))

    expect(screen.getByText('На этот день свободных слотов нет.')).toBeVisible()
    // Слот не выбран — «Продолжить» неактивна (спецификация §11).
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
    // Календарь на месте: дни по-прежнему можно переключать.
    expect(within(days).getAllByRole('button')).toHaveLength(14)
  })

  it('показывает длительность и число свободных слотов выбранного дня', async () => {
    renderBookPage()

    // В фикстуре первого дня один свободный слот из двух.
    expect(await screen.findByText('Длительность: 30 минут')).toBeVisible()
    expect(screen.getByText('Свободных слотов на этот день: 1')).toBeVisible()
  })

  it('показывает сообщение об ошибке, если API не отвечает', async () => {
    vi.mocked(getAvailability).mockRejectedValue(new Error('сеть недоступна'))
    renderBookPage()

    expect(await screen.findByRole('alert')).toBeVisible()
  })

  it('просит выбрать тип встречи, когда параметра type нет', () => {
    renderBookPage('')

    expect(screen.getByText('Тип встречи не выбран.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'На главную' })).toBeVisible()
  })

  it('ведёт назад на главную страницу', async () => {
    const user = userEvent.setup()
    renderBookPage()

    await user.click(await screen.findByRole('link', { name: 'На главную' }))
    // Возврат проверяется в app.test.tsx через маршруты; здесь — наличие ссылки.
    expect(screen.getByRole('link', { name: 'На главную' }).getAttribute('href')).toBe('/')
  })

  it('выбор свободного слота активирует «Продолжить», но форма ещё закрыта', async () => {
    const user = userEvent.setup()
    renderBookPage()

    // Пока слот не выбран, «Продолжить» неактивна (спецификация §11).
    expect(await screen.findByRole('button', { name: 'Продолжить' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /10:00–10:30/ }))

    // Слот выделен, кнопка активна, но имя и email спрашивают на следующем
    // шаге — после «Продолжить» (спецификация §11).
    expect(screen.getByRole('button', { name: /10:00–10:30/, pressed: true })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeEnabled()
    expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument()
  })

  it('когда в дне нет свободных слотов, «Продолжить» неактивна', async () => {
    mockAvailability(availabilityWithFirstDay([takenSlot]))
    renderBookPage()

    // В первом дне только занятый слот: выбрать нечего, кнопка неактивна —
    // так же она ведёт себя для типа без свободных слотов во всём окне (§11).
    expect(await screen.findByText('11:00–11:30 МСК')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
  })

  it('«Продолжить» открывает форму имени и email', async () => {
    const user = userEvent.setup()
    renderBookPage()
    await selectFreeSlot(user)

    // Форма показывает выбранный слот и поля гостя (спецификация §11).
    expect(screen.getByText('Выбрано время: 10:00–10:30 МСК')).toBeVisible()
    expect(screen.getByLabelText('Имя')).toBeVisible()
    expect(screen.getByLabelText('Email')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Подтвердить запись' })).toBeVisible()
  })

  it('отправляет бронь с выбранным слотом и данными гостя', async () => {
    const user = userEvent.setup()
    vi.mocked(createBooking).mockResolvedValue({ data: bookingFixture, error: undefined })
    renderBookPage()
    await selectFreeSlot(user)

    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Подтвердить запись' }))

    // В запросе — выбранный слот и тип встречи; end не передаётся (§8).
    await screen.findByRole('status')
    expect(vi.mocked(createBooking)).toHaveBeenCalledWith({
      body: {
        meetingTypeId: 'intro',
        start: freeSlot.start,
        name: 'Анна',
        email: 'anna@example.com',
      },
    })
  })

  it('блокирует кнопку подтверждения, пока бронь отправляется', async () => {
    const user = userEvent.setup()
    const deferred = deferredBooking()
    vi.mocked(createBooking).mockReturnValue(deferred.promise)
    renderBookPage()
    await selectFreeSlot(user)

    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Подтвердить запись' }))

    // isSubmitting: повторный клик невозможен (спецификация §8).
    expect(screen.getByRole('button', { name: 'Подтвердить запись' })).toBeDisabled()

    deferred.resolve({ data: bookingFixture, error: undefined })
    expect(await screen.findByRole('status')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Подтвердить запись' })).not.toBeInTheDocument()
  })

  it('после успеха показывает «Бронь подтверждена. До встречи!» и слот становится занятым', async () => {
    const user = userEvent.setup()
    vi.mocked(createBooking).mockResolvedValue({ data: bookingFixture, error: undefined })
    renderBookPage()
    await selectFreeSlot(user)

    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Подтвердить запись' }))

    expect(await screen.findByText('Бронь подтверждена. До встречи!')).toBeVisible()
    // Локальное обновление: забронированный слот теперь занят (спецификация §11).
    expect(screen.queryByText('Свободно')).not.toBeInTheDocument()
    const bookedRow = screen.getByText('10:00–10:30 МСК').closest('li')
    expect(bookedRow).not.toBeNull()
    expect(within(bookedRow as HTMLElement).getByText('Занято')).toBeVisible()
    // Число свободных слотов выбранного дня пересчитано.
    expect(screen.getByText('Свободных слотов на этот день: 0')).toBeVisible()
    // Слот занят — «Продолжить» снова неактивна до нового выбора (§11).
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
  })

  it('после брони пересекающиеся слоты становятся занятыми без перечитывания', async () => {
    const user = userEvent.setup()
    // Тип на 60 минут: сетка даёт пересекающиеся слоты 10:00–11:00 и
    // 10:30–11:30 — после брони занят и соседний (§6: занятый слот
    // не предлагается свободным).
    const hourSlot = {
      start: '2026-11-11T07:00:00Z',
      end: '2026-11-11T08:00:00Z',
      status: 'free',
    } as const
    const overlapSlot = {
      start: '2026-11-11T07:30:00Z',
      end: '2026-11-11T08:30:00Z',
      status: 'free',
    } as const
    // Касание границами — не пересечение (§8): 11:00–11:30 остаётся свободным.
    const touchingSlot = {
      start: '2026-11-11T08:00:00Z',
      end: '2026-11-11T08:30:00Z',
      status: 'free',
    } as const
    vi.mocked(getAvailability)
      .mockReset()
      .mockResolvedValue({
        data: availabilityWithFirstDay([hourSlot, overlapSlot, touchingSlot]),
        error: undefined,
      })
    vi.mocked(listMeetingTypes)
      .mockReset()
      .mockResolvedValue({
        data: { items: [{ ...introType, durationMinutes: 60 }] },
        error: undefined,
      })
    vi.mocked(createBooking).mockResolvedValue({
      data: { ...bookingFixture, start: hourSlot.start, end: hourSlot.end },
      error: undefined,
    })
    renderBookPage()

    await user.click(await screen.findByRole('button', { name: /10:00–11:00/ }))
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Подтвердить запись' }))

    await screen.findByText('Бронь подтверждена. До встречи!')
    expect(screen.getByText('10:00–11:00 МСК').closest('li')).toHaveTextContent('Занято')
    expect(screen.getByText('10:30–11:30 МСК').closest('li')).toHaveTextContent('Занято')
    expect(screen.getByText('11:00–11:30 МСК').closest('li')).toHaveTextContent('Свободно')
    // Обновление локальное: календарь не перечитывается и страница
    // не перезагружается.
    expect(vi.mocked(getAvailability)).toHaveBeenCalledTimes(1)
  })

  it('ошибка slot_taken показывает сообщение сервера', async () => {
    const user = userEvent.setup()
    vi.mocked(createBooking).mockResolvedValue({
      data: undefined,
      error: { code: 'slot_taken', message: 'Это время только что заняли. Выберите другой слот' },
    })
    renderBookPage()
    await selectFreeSlot(user)

    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Подтвердить запись' }))

    // Сообщение предлагает выбрать другой слот (спецификация §11).
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Это время только что заняли. Выберите другой слот',
    )
  })

  it('«Изменить» возвращает к выбору времени, не теряя выбранный слот', async () => {
    const user = userEvent.setup()
    renderBookPage()
    await selectFreeSlot(user)

    await user.click(screen.getByRole('button', { name: 'Изменить' }))

    expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument()
    // Слот остаётся выбранным: его кнопка нажата, «Продолжить» активна
    // и возвращает к форме (спецификация §11).
    expect(screen.getByRole('button', { name: /10:00–10:30/, pressed: true })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeEnabled()
  })

  it('данные гостя сохраняются при возврате к выбору времени и обратно', async () => {
    const user = userEvent.setup()
    renderBookPage()
    await selectFreeSlot(user)

    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Изменить' }))
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    // Введённое не потерялось между шагами (спецификация §11).
    expect(screen.getByLabelText('Имя')).toHaveValue('Анна')
    expect(screen.getByLabelText('Email')).toHaveValue('anna@example.com')
  })

  it('после конфликта перечитывает календарь и показывает конфликтный слот занятым', async () => {
    const user = userEvent.setup()
    // До конфликта свободны 09:00 и 10:00; после — оба заняли (соседний
    // занял другой гость), и это видно только после перечитывания.
    mockAvailabilityAroundConflict(
      availabilityWithFirstDay([freeSlot, morningSlot]),
      availabilityWithFirstDay([
        { ...freeSlot, status: 'taken' },
        { ...morningSlot, status: 'taken' },
      ]),
    )
    vi.mocked(createBooking).mockResolvedValue(slotTakenError())
    renderBookPage()
    await selectFreeSlot(user)

    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Подтвердить запись' }))

    // Доступность перечитана через SDK после ответа 409 (§11).
    await waitFor(() => {
      expect(vi.mocked(getAvailability)).toHaveBeenCalledTimes(2)
    })
    const conflictRow = screen.getByText('10:00–10:30 МСК').closest('li')
    expect(within(conflictRow as HTMLElement).getByText('Занято')).toBeVisible()
    const neighbourRow = screen.getByText('09:00–09:30 МСК').closest('li')
    expect(within(neighbourRow as HTMLElement).getByText('Занято')).toBeVisible()
    expect(screen.getByText('Свободных слотов на этот день: 0')).toBeVisible()
  })

  it('после конфликта возвращается к выбору слота, не теряя имя и email', async () => {
    const user = userEvent.setup()
    // Конфликт на 10:00; после перечитывания свободен только 09:00.
    mockAvailabilityAroundConflict(
      availabilityWithFirstDay([freeSlot, morningSlot]),
      availabilityWithFirstDay([{ ...freeSlot, status: 'taken' }, morningSlot]),
    )
    vi.mocked(createBooking).mockResolvedValue(slotTakenError())
    renderBookPage()
    await selectFreeSlot(user)

    await user.type(screen.getByLabelText('Имя'), 'Анна')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Подтвердить запись' }))

    // Сообщение о конфликте видно, форма закрыта — гость у выбора слота.
    await screen.findByText('Это время только что заняли. Выберите другой слот')
    expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument()
    expect(screen.getByText('10:00–10:30 МСК').closest('li')).toHaveTextContent('Занято')

    // Выбор другого слота и «Продолжить» открывают форму с сохранёнными
    // данными (спецификация §11).
    await user.click(screen.getByRole('button', { name: /09:00–09:30/ }))
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    expect(screen.getByLabelText('Имя')).toHaveValue('Анна')
    expect(screen.getByLabelText('Email')).toHaveValue('anna@example.com')
  })
})
