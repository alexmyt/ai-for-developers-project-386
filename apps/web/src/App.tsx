import { BrowserRouter, Route, Routes } from 'react-router'
import { AdminBookingsPage } from './pages/admin-bookings-page'
import { AdminPage } from './pages/admin-page'
import { BookPage } from './pages/book-page'
import { MainPage } from './pages/main-page'

// Отдельно от BrowserRouter — чтобы тесты могли обернуть маршруты в MemoryRouter.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/book" element={<BookPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/bookings" element={<AdminBookingsPage />} />
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
