import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listMeetingTypes, type MeetingType } from '@repo/sdk'
import { AppRoutes } from './App'

// Сеть подменяется на уровне SDK, а не через моки fetch (спецификация §13.3).
vi.mock('@repo/sdk', () => ({
  listMeetingTypes: vi.fn(),
}))

// Сид-тип из спецификации §6: «Знакомство», 30 минут, без описания.
const introType: MeetingType = {
  id: 'intro',
  title: 'Знакомство',
  description: null,
  durationMinutes: 30,
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

  it('ведёт на заглушку страницы записи по кнопке «Записаться»', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Записаться' }))

    expect(screen.getByRole('heading', { name: 'Записаться' })).toBeVisible()
    expect(screen.getByText('Флоу записи появится на следующем этапе.')).toBeVisible()
  })

  it('позволяет вернуться на главную со страницы записи', async () => {
    const user = userEvent.setup()
    renderApp('/book')

    await user.click(screen.getByRole('link', { name: 'На главную' }))

    expect(screen.getByRole('heading', { name: 'Календарь звонков' })).toBeVisible()
  })
})
