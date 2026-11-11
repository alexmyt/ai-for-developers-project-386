import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import { Mutex } from 'async-mutex'
import { randomUUID } from 'node:crypto'
import { moscowDateString } from '../availability/moscow-time'
import { Clock } from '../clock/clock'
import { MeetingTypesService } from '../meeting-types/meeting-types.service'
import type { Booking } from './booking'
import { toBookingJson, type BookingJson } from './booking-json'
import { intervalsIntersect, isStartInWindow, isStartOnGrid } from './booking.domain'
import { validateCreateBookingRequest } from './booking-validation'

// Хранилище броней в памяти процесса (ADR-0003). Проверка пересечений
// и вставка выполняются внутри критической секции мьютекса по дате слота:
// разные дни не блокируют друг друга.
@Injectable()
export class BookingsService {
  private readonly items: Booking[] = []

  private readonly dateMutexes = new Map<string, Mutex>()

  constructor(
    private readonly clock: Clock,
    private readonly meetingTypesService: MeetingTypesService,
  ) {}

  /** Все брони: пересечения считаются по всем типам встреч сразу (§5). */
  list(): Booking[] {
    return this.items
  }

  /**
   * Бронь свободного слота (спецификация §8). Проверки идут в фиксированном
   * порядке: форма и поля → существование типа → окно записи → сетка →
   * пересечения. Полуоткрытые интервалы делают касание границами допустимым.
   */
  async create(request: unknown): Promise<BookingJson> {
    const input = validateCreateBookingRequest(request)

    const meetingType = this.meetingTypesService.get(input.meetingTypeId)
    if (!meetingType) {
      throw new NotFoundException({
        code: 'meeting_type_not_found',
        message: `Тип встречи «${input.meetingTypeId}» не найден`,
      })
    }

    const now = this.clock.now()
    if (!isStartInWindow({ start: input.start, now })) {
      throw new HttpException(
        {
          code: 'slot_out_of_window',
          message: 'Старт уже наступил или находится за пределами окна записи на 14 дней',
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    if (!isStartOnGrid({ start: input.start, durationMinutes: meetingType.durationMinutes })) {
      throw new HttpException(
        {
          code: 'slot_out_of_grid',
          message:
            'Старт должен быть на сетке 09:00–18:00 по Москве с шагом 30 минут, и встреча должна заканчиваться до 18:00',
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    // end вычисляет сервер из длительности типа: клиент не может подделать
    // интервал (спецификация §8, ADR-0003).
    const end = new Date(input.start.getTime() + meetingType.durationMinutes * 60_000)

    return this.inDateMutex(moscowDateString(input.start), () => {
      const conflict = this.items.find((booking) =>
        intervalsIntersect({ start: input.start, end }, booking),
      )
      if (conflict) {
        throw new HttpException(
          {
            code: 'slot_taken',
            message: 'Это время только что заняли. Выберите другой слот',
          },
          HttpStatus.CONFLICT,
        )
      }

      const booking: Booking = {
        id: randomUUID(),
        meetingTypeId: meetingType.id,
        meetingTypeTitle: meetingType.title,
        start: input.start,
        end,
        guestName: input.name,
        guestEmail: input.email,
        createdAt: now,
      }
      this.items.push(booking)
      return toBookingJson(booking)
    })
  }

  /** Мьютекс на календарный день по Москве: на каждый день — свой (ADR-0003). */
  private inDateMutex<T>(date: string, action: () => T): Promise<T> {
    let mutex = this.dateMutexes.get(date)
    if (!mutex) {
      mutex = new Mutex()
      this.dateMutexes.set(date, mutex)
    }
    // Колбэк синхронный: между проверкой пересечений и вставкой нет
    // await, поэтому конкуренты не вклиниваются (ADR-0003).
    return mutex.runExclusive(action)
  }
}
