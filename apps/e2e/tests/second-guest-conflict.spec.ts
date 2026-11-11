import { expect, test, type Page } from '@playwright/test'

// Сценарий конфликта из спецификации §13.4: второй гость пытается занять
// уже занятое время. Оба гостя открывают календарь, пока слот свободен;
// первый успевает забронировать, второй отправляет форму с устаревшим
// календарём и получает 409 slot_taken. Сеть не мокается: работают
// собранные API и фронтенд.

/**
 * Открывает страницу записи и выбирает первый свободный слот первого дня,
 * где он есть (прошедшие старты скрыты, §4). Возвращает метку времени
 * слота, чтобы другой гость мог выбрать тот же слот.
 */
async function chooseFirstFreeSlot(page: Page): Promise<string> {
  await page.goto('/book?type=intro')
  const days = page.getByRole('group', { name: 'Дни записи' })
  await expect(days.getByRole('button').first()).toBeVisible()
  const dayButtons = days.getByRole('button')
  const dayCount = await dayButtons.count()
  for (let index = 0; index < dayCount; index += 1) {
    await dayButtons.nth(index).click()
    const freeSlot = page.getByRole('button', { name: /Свободно/ }).first()
    if ((await freeSlot.count()) > 0) {
      const timeLabel = (await freeSlot.locator('span').first().innerText()).trim()
      await freeSlot.click()
      return timeLabel
    }
  }
  throw new Error('В окне записи нет свободных слотов')
}

test('второй гость видит конфликт и возвращается к выбору слота', async ({ browser }) => {
  const firstPage = await browser.newContext().then((context) => context.newPage())
  const secondPage = await browser.newContext().then((context) => context.newPage())

  // Оба гостя выбирают один и тот же слот: календари ещё не устарели.
  const conflictSlotTime = await chooseFirstFreeSlot(firstPage)
  const secondSlotTime = await chooseFirstFreeSlot(secondPage)
  expect(secondSlotTime).toBe(conflictSlotTime)

  // Первый гость подтверждает бронь.
  await firstPage.getByLabel('Имя').fill('Анна')
  await firstPage.getByLabel('Email').fill('anna@example.com')
  await firstPage.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(firstPage.getByText('Бронь подтверждена. До встречи!')).toBeVisible()

  // Второй гость отправляет форму, не зная о брони первого, — конфликт.
  await secondPage.getByLabel('Имя').fill('Борис')
  await secondPage.getByLabel('Email').fill('boris@example.com')
  await secondPage.getByRole('button', { name: 'Подтвердить запись' }).click()

  // Понятное сообщение о занятости, форма закрыта — гость у выбора слота.
  await expect(secondPage.getByRole('alert')).toHaveText(/только что заняли/)
  await expect(secondPage.getByLabel('Имя')).toHaveCount(0)

  // Календарь обновился: конфликтный слот показан занятым.
  const conflictRow = secondPage.locator('li', { hasText: conflictSlotTime })
  await expect(conflictRow).toContainText('Занято')
})
