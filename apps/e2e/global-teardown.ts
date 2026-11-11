import { execSync } from 'node:child_process'

// Playwright убивает клиент docker run, но сам контейнер может остаться
// висеть с занятым портом. Снимаем его принудительно после прогона —
// в том числе после упавших тестов.
export default function (): void {
  try {
    execSync('docker rm --force call-calendar-e2e', { stdio: 'ignore' })
  } catch {
    // Контейнера уже нет — убирать нечего.
  }
}
