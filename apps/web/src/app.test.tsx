import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAvailability, listMeetingTypes, type Availability, type MeetingType } from '@repo/sdk'
import { AppRoutes } from './App'

// Сеть подменяется на уровне SDK, а не через моки fetch (спецификация §13.3).
vi.mock('@repo/sdk', () => ({
  getAvailability: vi.fn(),
  listMeetingTypes: vi.fn(),
}))

// Сид-тип из спецификации §6: «Знакомство», 30 минут, без описания.
const introType: MeetingType = {
  id: 'intro',
  title: 'Знакомство',
  description: null,
  durationMinutes: 30,
}

// Окно записи для страницы записи: 14 дней, у первого — один слот.
function availabilityFixture(): Availability {
  const freeSlot = {
    start: '2026-11-11T07:00:00Z',
    end: '2026-11-11T07:30:00Z',
    status: 'free',
  } as const
  return {
    meetingTypeId: 'intro',
    days: Array.from({ length: 14 }, (_, offset) => ({
      date: new Date(Date.UTC(2026, 10, 11 + offset)).toISOString().slice(0, 10),
      slots: offset === 0 ? [freeSlot] : [],
    })),
  }
}

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

function mockMeetingTypes(items: MeetingType[]): void {
  vi.mocked(listMeetingTypes).mockResolvedValue({ data: { items }, error: undefined })
}

beforeEach(() => {
  mockMeetingTypes([introType])
  vi.mocked(getAvailability).mockResolvedValue({
    data: availabilityFixture(),
    error: undefined,
  })
})

describe('Главная страница', () => {
  it('показывает типы встреч, полученные из API', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Знакомство' })).toBeVisible()
    expect(screen.getByText('30 минут')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute(
      'href',
      '/book?type=intro',
    )
  })

  it('показывает описание типа встречи, когда оно есть', async () => {
    mockMeetingTypes([
      {
        ...introType,
        id: 'project-review',
        title: 'Обзор проекта',
        description: 'Разбираем вашу задачу и план на встречу',
      },
    ])
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Обзор проекта' })).toBeVisible()
    expect(screen.getByText('Разбираем вашу задачу и план на встречу')).toBeVisible()
  })

  it('показывает пустое состояние, когда типов ещё нет', async () => {
    mockMeetingTypes([])
    renderApp('/')

    expect(await screen.findByText('Типов встреч пока нет — загляните позже.')).toBeVisible()
  })

  it('показывает сообщение об ошибке, если API не отвечает', async () => {
    vi.mocked(listMeetingTypes).mockRejectedValue(new Error('сеть недоступна'))
    renderApp('/')

    expect(await screen.findByRole('alert')).toBeVisible()
  })

  it('ведёт на страницу записи с календарём по кнопке «Записаться»', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Записаться' }))

    // Календарь окна записи на 14 дней (спецификация §7).
    expect(await screen.findByRole('heading', { name: 'Выберите время' })).toBeVisible()
    const days = screen.getByRole('group', { name: 'Дни записи' })
    expect(days.querySelectorAll('button')).toHaveLength(14)
  })

  it('позволяет вернуться на главную со страницы записи', async () => {
    const user = userEvent.setup()
    renderApp('/book?type=intro')

    await user.click(await screen.findByRole('link', { name: 'На главную' }))

    expect(screen.getByRole('heading', { name: 'Календарь звонков' })).toBeVisible()
  })
})
