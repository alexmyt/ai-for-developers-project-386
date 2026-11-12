import { expect, test, type Page } from '@playwright/test'

// Полный сквозной сценарий билета #26 (спецификация §13.4): владелец создаёт
// тип встречи, гость бронирует свободный слот, второй гость получает
// конфликт, владелец видит бронь в «Предстоящих событиях». Сеть не мокается:
// работает один сервер, отдающий и /api, и SPA-статику (ADR-0002).

// Id типа уникален для запуска: сервер хранит состояние в памяти (ADR-0003)
// и может использоваться повторно, поэтому новый запуск не должен упираться
// в 409 meeting_type_exists от прошлого.
const meetingTypeId = `consult-${Date.now()}`

/**
 * Открывает страницу записи нового типа и выбирает первый свободный слот
 * первого дня, где он есть (прошедшие старты скрыты, §4). Возвращает метку
 * времени слота, чтобы второй гость мог выбрать тот же слот.
 */
async function chooseFirstFreeSlot(page: Page): Promise<string> {
  await page.goto(`/book?type=${meetingTypeId}`)
  const days = page.getByRole('group', { name: 'Дни записи' })
  await expect(days.getByRole('button').first()).toBeVisible()
  const dayButtons = days.getByRole('button')
  const dayCount = await dayButtons.count()
  for (let index = 0; index < dayCount; index += 1) {
    await dayButtons.nth(index).click()
    const freeSlot = page.getByRole('button', { name: /Свободно/ }).first()
    if ((await freeSlot.count()) > 0) {
      const slotLabel = (await freeSlot.locator('span').first().innerText()).trim()
      await freeSlot.click()
      // Двухшаговый выбор: «Продолжить» открывает форму имени и email (§11).
      await page.getByRole('button', { name: 'Продолжить' }).click()
      return slotLabel
    }
  }
  throw new Error('В окне записи нет свободных слотов')
}

test('владелец создаёт тип, гость бронирует слот, второй видит конфликт, владелец видит бронь', async ({
  browser,
}) => {
  // 1. Владелец создаёт тип встречи (§6.1, §11).
  const ownerPage = await browser.newContext().then((context) => context.newPage())
  await ownerPage.goto('/admin')
  await ownerPage.getByLabel('Идентификатор').fill(meetingTypeId)
  await ownerPage.getByLabel('Название').fill('Консультация')
  await ownerPage.getByLabel('Описание').fill('Разбор проекта и план обучения')
  await ownerPage.getByLabel('Длительность').selectOption('60')
  await ownerPage.getByRole('button', { name: 'Создать тип встречи' }).click()

  // После сохранения владелец попадает на главную: новый тип виден рядом
  // с сид-типом «Знакомство».
  const consultationCard = ownerPage.locator('section', { hasText: 'Консультация' })
  await expect(consultationCard).toBeVisible()
  await expect(consultationCard).toContainText('60 минут')

  // 2–3. Оба гостя открывают календарь нового типа, пока слот свободен.
  const guestPage = await browser.newContext().then((context) => context.newPage())
  const rivalPage = await browser.newContext().then((context) => context.newPage())

  const bookedSlotLabel = await chooseFirstFreeSlot(guestPage)
  const rivalSlotLabel = await chooseFirstFreeSlot(rivalPage)
  expect(rivalSlotLabel).toBe(bookedSlotLabel)

  // Первый гость подтверждает бронь.
  await guestPage.getByLabel('Имя').fill('Вера')
  await guestPage.getByLabel('Email').fill('vera@example.com')
  await guestPage.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(guestPage.getByText('Бронь подтверждена. До встречи!')).toBeVisible()

  // Второй гость отправляет форму с устаревшим календарём — конфликт.
  await rivalPage.getByLabel('Имя').fill('Глеб')
  await rivalPage.getByLabel('Email').fill('gleb@example.com')
  await rivalPage.getByRole('button', { name: 'Подтвердить запись' }).click()

  // Понятное сообщение о занятости, форма закрыта — гость у выбора слота.
  await expect(rivalPage.getByRole('alert')).toHaveText(/только что заняли/)
  await expect(rivalPage.getByLabel('Имя')).toHaveCount(0)

  // 4. Владелец открывает раздел по прямой ссылке: сервер отдаёт index.html
  // (SPA-переписывание), маршрутизатор показывает «Предстоящие события».
  await ownerPage.goto('/admin/bookings')
  await expect(ownerPage.getByRole('heading', { name: 'Предстоящие события' })).toBeVisible()

  const row = ownerPage.locator('li', { hasText: 'Вера' })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('vera@example.com')
  await expect(row).toContainText('Консультация')
  await expect(row).toContainText(bookedSlotLabel)
})
