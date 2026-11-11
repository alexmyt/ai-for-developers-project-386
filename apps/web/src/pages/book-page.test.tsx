import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAvailability, listMeetingTypes, type Availability } from '@repo/sdk'
import { BookPage } from './book-page'

// Сеть подменяется на уровне SDK, а не через моки fetch (спецификация §13.3).
vi.mock('@repo/sdk', () => ({
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
    expect(screen.getByText('10:00–10:30')).toBeVisible()
    expect(screen.getByText('Свободно')).toBeVisible()
    expect(screen.getByText('11:00–11:30')).toBeVisible()
    expect(screen.getByText('Занято')).toBeVisible()
  })

  it('после выбора другого дня показывает его слоты', async () => {
    const user = userEvent.setup()
    renderBookPage()

    const days = await screen.findByRole('group', { name: 'Дни записи' })
    await user.click(within(days).getByRole('button', { name: /12 ноября/ }))

    expect(screen.getByText('09:00–09:30')).toBeVisible()
    expect(screen.queryByText('10:00–10:30')).not.toBeInTheDocument()
  })

  it('пустой день не ломает экран', async () => {
    const user = userEvent.setup()
    renderBookPage()

    // Третий день в фикстуре без слотов.
    const days = await screen.findByRole('group', { name: 'Дни записи' })
    await user.click(within(days).getByRole('button', { name: /13 ноября/ }))

    expect(screen.getByText('На этот день свободных слотов нет.')).toBeVisible()
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
})
