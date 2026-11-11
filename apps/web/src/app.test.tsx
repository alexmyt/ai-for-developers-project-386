import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './App'

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('Главная страница', () => {
  it('показывает заголовок и карточку типа встречи из сида', () => {
    renderApp('/')

    expect(screen.getByRole('heading', { name: 'Календарь звонков' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Знакомство' })).toBeVisible()
    expect(screen.getByText('30 минут')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute('href', '/book')
  })

  it('ведёт на заглушку страницы записи по кнопке «Записаться»', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Записаться' }))

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
