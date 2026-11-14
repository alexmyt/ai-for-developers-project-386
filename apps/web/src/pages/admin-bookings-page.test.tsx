import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listBookings, type Booking } from '@repo/sdk'
import { AppRoutes } from '../App'

// Сеть подменяется на уровне SDK, а не через моки fetch (спецификация §13.3).
vi.mock('@repo/sdk', () => ({
  listBookings: vi.fn(),
}))

// Бронь из примера спецификации §9: 07:00 UTC — это 10:00 по Москве (§3).
const introBooking: Booking = {
  id: '6f1c1b8e-6a1e-4b3f-9d0e-2f3c4b5a6978',
  meetingTypeId: 'intro',
  meetingTypeTitle: 'Знакомство',
  start: '2026-11-12T07:00:00Z',
  end: '2026-11-12T07:30:00Z',
  guestName: 'Анна',
  guestEmail: 'anna@example.com',
  createdAt: '2026-11-10T12:00:00Z',
}

// Бронь другого типа: все типы встреч показываются в одном списке (§9).
const reviewBooking: Booking = {
  id: 'c2a9d0f4-1b2c-4d3e-8f5a-6b7c8d9e0f1a',
  meetingTypeId: 'review',
  meetingTypeTitle: 'Обзор проекта',
  start: '2026-11-13T06:00:00Z',
  end: '2026-11-13T07:00:00Z',
  guestName: 'Борис',
  guestEmail: 'boris@example.com',
  createdAt: '2026-11-10T13:00:00Z',
}

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

function mockBookings(items: Booking[]): void {
  vi.mocked(listBookings).mockResolvedValue({ data: { items }, error: undefined })
}

beforeEach(() => {
  mockBookings([])
})

describe('Раздел «Предстоящие события»', () => {
  it('показывает пустое состояние, когда предстоящих броней нет', async () => {
    renderApp('/admin/bookings')

    expect(
      await screen.findByText('Пока нет брони. Новые записи появятся здесь автоматически.'),
    ).toBeVisible()
  })

  it('показывает гостя, тип встречи, дату, время слота и дату создания записи', async () => {
    mockBookings([introBooking])
    renderApp('/admin/bookings')

    // 07:00–07:30 UTC — это 10:00–10:30 по Москве (§3).
    expect(await screen.findByText('Анна')).toBeVisible()
    expect(screen.getByText('anna@example.com')).toBeVisible()
    expect(screen.getByText('Знакомство')).toBeVisible()
    expect(screen.getByText('12 ноября, 10:00–10:30 МСК')).toBeVisible()
    expect(screen.getByText('Запись создана 10 ноября')).toBeVisible()
  })

  it('показывает брони всех типов в одном списке в порядке API', async () => {
    mockBookings([introBooking, reviewBooking])
    renderApp('/admin/bookings')

    expect(await screen.findAllByRole('listitem')).toHaveLength(2)

    // Сортировку делает сервер (§9): раздел сохраняет порядок ответа.
    const annaRow = screen.getByRole('listitem', { name: /Анна/ })
    expect(annaRow).toHaveTextContent('Знакомство')
    const borisRow = screen.getByRole('listitem', { name: /Борис/ })
    expect(borisRow).toHaveTextContent('Обзор проекта')
    expect(within(borisRow).getByText('13 ноября, 09:00–10:00 МСК')).toBeVisible()

    // Анна идёт раньше Бориса, как в ответе API.
    expect(
      annaRow.compareDocumentPosition(borisRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('показывает сообщение, если API не отвечает', async () => {
    vi.mocked(listBookings).mockRejectedValue(new Error('сеть недоступна'))
    renderApp('/admin/bookings')

    expect(await screen.findByRole('alert')).toBeVisible()
  })

  it('появляется новая бронь без перезагрузки страницы', async () => {
    vi.useFakeTimers()
    try {
      renderApp('/admin/bookings')
      await act(async () => {})
      expect(
        screen.getByText('Пока нет брони. Новые записи появятся здесь автоматически.'),
      ).toBeVisible()

      // Гость забронировал слот: следующий опрос показывает бронь,
      // страница не перезагружалась (критерий приёмки).
      mockBookings([introBooking])
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(screen.getByText('Анна')).toBeVisible()
      expect(screen.queryByText(/Пока нет брони/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('загружает список заново при входе в раздел', async () => {
    const user = userEvent.setup()
    mockBookings([introBooking])
    renderApp('/admin')

    await user.click(screen.getByRole('link', { name: 'Предстоящие события' }))

    expect(await screen.findByText('Анна')).toBeVisible()
    expect(listBookings).toHaveBeenCalledTimes(1)
  })

  it('ведёт к созданию типа встречи со списка броней', async () => {
    const user = userEvent.setup()
    renderApp('/admin/bookings')

    await user.click(await screen.findByRole('link', { name: 'Создание типа встречи' }))

    expect(screen.getByRole('heading', { name: 'Создание типа встречи' })).toBeVisible()
  })
})
