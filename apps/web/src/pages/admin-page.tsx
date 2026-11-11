import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createMeetingType } from '@repo/sdk'
import type { CreateMeetingTypeRequest } from '@repo/sdk'

// Длительность кратна шагу сетки: варианты от 30 до 240 минут (спецификация §6).
const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240]

// Экран владельца: создание типа встречи (спецификация §11).
export function AdminPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [idError, setIdError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const description = formData.get('description')
    const body: CreateMeetingTypeRequest = {
      id: String(formData.get('id') ?? ''),
      title: String(formData.get('title') ?? ''),
      description:
        typeof description === 'string' && description.trim() !== '' ? description : null,
      durationMinutes: Number(formData.get('durationMinutes')),
    }

    setIsSubmitting(true)
    setIdError(null)
    setFormError(null)

    try {
      const { error } = await createMeetingType({ body })

      if (error) {
        if (error.code === 'meeting_type_exists') {
          // Дубль id касается только этого поля (спецификация §11).
          setIdError(error.message)
        } else {
          setFormError(error.message)
        }
        return
      }

      // Тип уже сохранён в API: гостевая страница загружает список типов
      // при переходе, поэтому новый тип виден сразу, без перезагрузки.
      navigate('/')
    } catch {
      setFormError('Не удалось создать тип встречи. Попробуйте ещё раз.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-50 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Создание типа встречи</h1>
        <p className="mt-2 text-slate-600">
          Тип встречи задаёт размер слота и подпись на гостевой странице.
        </p>
      </header>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="meeting-type-id" className="font-medium text-slate-900">
            Идентификатор
          </label>
          <input
            id="meeting-type-id"
            name="id"
            type="text"
            maxLength={50}
            aria-describedby={idError ? 'meeting-type-id-error' : undefined}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />
          {idError && (
            <p id="meeting-type-id-error" role="alert" className="text-sm text-red-700">
              {idError}
            </p>
          )}
          <p className="text-sm text-slate-500">
            Латинские буквы, цифры и дефисы — например, intro. После создания не меняется.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="meeting-type-title" className="font-medium text-slate-900">
            Название
          </label>
          <input
            id="meeting-type-title"
            name="title"
            type="text"
            maxLength={100}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="meeting-type-description" className="font-medium text-slate-900">
            Описание
          </label>
          <textarea
            id="meeting-type-description"
            name="description"
            rows={3}
            maxLength={500}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="meeting-type-duration" className="font-medium text-slate-900">
            Длительность
          </label>
          <select
            id="meeting-type-duration"
            name="durationMinutes"
            defaultValue={30}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} минут
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          Создать тип встречи
        </button>
        <Link
          to="/"
          className="text-center font-medium text-slate-900 underline hover:no-underline"
        >
          На главную
        </Link>
        <Link
          to="/admin/bookings"
          className="text-center font-medium text-slate-900 underline hover:no-underline"
        >
          Предстоящие события
        </Link>
      </form>
    </main>
  )
}
