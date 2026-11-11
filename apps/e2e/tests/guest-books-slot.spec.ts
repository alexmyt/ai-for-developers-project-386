import { expect, test } from '@playwright/test'

// Сценарий бронирования из спецификации §13.4: гость открывает главную
// страницу, выбирает тип, свободный слот, вводит имя и email и видит успех.
// Сеть не мокается: работает собранный API и собранный фронтенд.
test('гость бронирует свободный слот и видит подтверждение', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Записаться' }).click()
  await expect(page.getByRole('heading', { name: 'Выберите время' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Дни записи' }).getByRole('button')).toHaveCount(14)

  // Свободные слоты есть не всегда: если старты сегодняшнего дня уже
  // прошли (§4), гость выбирает следующий день окна записи.
  let freeSlot = page.getByRole('button', { name: /Свободно/ }).first()
  if ((await freeSlot.count()) === 0) {
    await page.getByRole('group', { name: 'Дни записи' }).getByRole('button').nth(1).click()
    freeSlot = page.getByRole('button', { name: /Свободно/ }).first()
  }
  await freeSlot.click()

  await page.getByLabel('Имя').fill('Анна')
  await page.getByLabel('Email').fill('anna@example.com')
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  await expect(page.getByText('Бронь подтверждена. До встречи!')).toBeVisible()
})
