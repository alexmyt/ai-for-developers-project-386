import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMeetingType, listMeetingTypes, type MeetingType } from '@repo/sdk'
import { AppRoutes } from './App'

// Сеть подменяется на уровне SDK, а не через моки fetch (спецификация §13.3).
vi.mock('@repo/sdk', () => ({
  createMeetingType: vi.fn(),
  listMeetingTypes: vi.fn(),
}))

// Сид-тип из спецификации §6: «Знакомство», 30 минут, без описания.
const introType: MeetingType = {
  id: 'intro',
  title: 'Знакомство',
  description: null,
  durationMinutes: 30,
}

// Создаваемый владельцем тип: поля формы из спецификации §11.
const reviewType: MeetingType = {
  id: 'review',
  title: 'Обзор проекта',
  description: 'Разбираем вашу задачу и план на встречу',
  durationMinutes: 60,
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

async function fillForm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('Идентификатор'), reviewType.id)
  await user.type(screen.getByLabelText('Название'), reviewType.title)
  await user.type(screen.getByLabelText('Описание'), reviewType.description ?? '')
  await user.selectOptions(
    screen.getByLabelText('Длительность'),
    String(reviewType.durationMinutes),
  )
}

beforeEach(() => {
  mockMeetingTypes([introType])
})

describe('Экран владельца', () => {
  it('показывает форму создания типа встречи', () => {
    renderApp('/admin')

    expect(screen.getByRole('heading', { name: 'Создание типа встречи' })).toBeVisible()
    expect(screen.getByLabelText('Идентификатор')).toBeVisible()
    expect(screen.getByLabelText('Название')).toBeVisible()
    expect(screen.getByLabelText('Описание')).toBeVisible()
    expect(screen.getByLabelText('Длительность')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Создать тип встречи' })).toBeVisible()
  })

  it('создаёт тип встречи через SDK и показывает его гостю без перезагрузки', async () => {
    const user = userEvent.setup()
    mockMeetingTypes([introType, reviewType])
    vi.mocked(createMeetingType).mockResolvedValue({ data: reviewType, error: undefined })
    renderApp('/admin')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }))

    // Владелец попадает на гостевую страницу, где уже виден новый тип:
    // переход по маршруту, список типов загружается заново.
    expect(await screen.findByRole('heading', { name: 'Обзор проекта' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Знакомство' })).toBeVisible()
    expect(createMeetingType).toHaveBeenCalledWith({
      body: {
        id: reviewType.id,
        title: reviewType.title,
        description: reviewType.description,
        durationMinutes: reviewType.durationMinutes,
      },
    })
  })

  it('показывает ошибку meeting_type_exists у поля id', async () => {
    const user = userEvent.setup()
    vi.mocked(createMeetingType).mockResolvedValue({
      data: undefined,
      error: { code: 'meeting_type_exists', message: 'Тип встречи с id «intro» уже создан' },
    })
    renderApp('/admin')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }))

    // Ошибка связана с полем id: читается как описание этого поля.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Тип встречи с id «intro» уже создан',
    )
    expect(screen.getByLabelText('Идентификатор')).toHaveAccessibleDescription(
      'Тип встречи с id «intro» уже создан',
    )
  })

  it('показывает сообщение об ошибке валидации от сервера', async () => {
    const user = userEvent.setup()
    vi.mocked(createMeetingType).mockResolvedValue({
      data: undefined,
      error: { code: 'validation_error', message: 'Поле id должно быть строкой' },
    })
    renderApp('/admin')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Поле id должно быть строкой')
  })

  it('блокирует кнопку отправки, пока тип создаётся', async () => {
    const user = userEvent.setup()
    let resolveCreate: (() => void) | undefined
    vi.mocked(createMeetingType).mockReturnValue(
      new Promise<{ data: MeetingType; error: undefined }>((resolve) => {
        resolveCreate = () => resolve({ data: reviewType, error: undefined })
      }),
    )
    renderApp('/admin')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }))

    const button = screen.getByRole('button', { name: 'Создать тип встречи' })
    expect(button).toBeDisabled()

    resolveCreate?.()
    await waitFor(() => expect(button).toBeEnabled())
  })

  it('показывает сообщение, если создать тип не удалось из-за сети', async () => {
    const user = userEvent.setup()
    vi.mocked(createMeetingType).mockRejectedValue(new Error('сеть недоступна'))
    renderApp('/admin')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }))

    expect(await screen.findByRole('alert')).toBeVisible()
  })

  it('ведёт на главную страницу по ссылке «На главную»', async () => {
    const user = userEvent.setup()
    renderApp('/admin')

    await user.click(screen.getByRole('link', { name: 'На главную' }))

    expect(screen.getByRole('heading', { name: 'Календарь звонков' })).toBeVisible()
  })

  it('ведёт на экран владельца по ссылке с главной страницы', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Экран владельца' }))

    expect(screen.getByRole('heading', { name: 'Создание типа встречи' })).toBeVisible()
  })
})
