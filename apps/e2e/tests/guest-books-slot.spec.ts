import { expect, test } from '@playwright/test'

// Сценарий бронирования из спецификации §13.4: гость открывает главную
// страницу, выбирает тип, свободный слот, вводит имя и email и видит успех.
// Затем владелец открывает раздел «Предстоящие события» и видит эту бронь.
// Сеть не мокается: работает собранный API и собранный фронтенд.
test('гость бронирует свободный слот, а владелец видит бронь в разделе', async ({ page }) => {
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
  // Двухшаговый выбор: слот, затем «Продолжить» открывает форму (§11).
  await page.getByRole('button', { name: 'Продолжить' }).click()
  const slotTime = (await freeSlot.textContent())?.match(/\d{2}:\d{2}–\d{2}:\d{2}/)?.[0] ?? ''

  await page.getByLabel('Имя').fill('Анна')
  await page.getByLabel('Email').fill('anna@example.com')
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  await expect(page.getByText('Бронь подтверждена. До встречи!')).toBeVisible()

  // Владелец открывает раздел через навигацию: главная → экран владельца
  // → «Предстоящие события» (спецификация §11).
  await page.getByRole('link', { name: 'На главную' }).click()
  await page.getByRole('link', { name: 'Экран владельца' }).click()
  await page.getByRole('link', { name: 'Предстоящие события' }).click()

  await expect(page.getByRole('heading', { name: 'Предстоящие события' })).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: 'Анна' })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('anna@example.com')
  await expect(row).toContainText('Знакомство')
  await expect(row).toContainText(slotTime)
})
