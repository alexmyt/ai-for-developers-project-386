import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest запущен без globals, поэтому авто-cleanup Testing Library не включается сам.
afterEach(cleanup)
