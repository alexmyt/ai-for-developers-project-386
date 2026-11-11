// Сид типа встречи из спецификации §1 (docs/spec/calendar.md): «Знакомство», 30 минут.
// Реальные данные придут из API через SDK (#2, #3), пока контракт и SDK не готовы.
export const seedMeetingType = {
  title: 'Знакомство',
  durationMinutes: 30,
  description: null,
} as const
