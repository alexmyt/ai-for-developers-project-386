import { expect, test } from '@playwright/test'

// Смоук первого среза: гость открывает главную страницу и видит сид-тип
// встречи из API — «Знакомство», 30 минут (спецификация §13.4).
test('гость видит сид-тип встречи на главной странице', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Календарь звонков' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Знакомство' })).toBeVisible()
  await expect(page.getByText('30 минут')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Записаться' })).toBeVisible()
})
