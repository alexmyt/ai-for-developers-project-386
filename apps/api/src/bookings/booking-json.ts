// JSON-форма брони для HTTP-ответа: моменты — в ISO 8601 с Z без
// миллисекунд, как в примерах спецификации §8 (docs/spec/calendar.md).
import { isoInstant } from '../availability/moscow-time'
import type { Booking } from './booking'

/** Бронь в ответе API: форма из спецификации §8. */
export interface BookingJson {
  id: string
  meetingTypeId: string
  meetingTypeTitle: string
  start: string
  end: string
  guestName: string
  guestEmail: string
  createdAt: string
}

/** Переводит хранимую бронь в JSON-форму ответа. */
export function toBookingJson(booking: Booking): BookingJson {
  return {
    id: booking.id,
    meetingTypeId: booking.meetingTypeId,
    meetingTypeTitle: booking.meetingTypeTitle,
    start: isoInstant(booking.start),
    end: isoInstant(booking.end),
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    createdAt: isoInstant(booking.createdAt),
  }
}
