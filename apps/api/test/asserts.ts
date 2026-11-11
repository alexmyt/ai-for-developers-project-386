/** Элемент массива с проверкой: тест падает с понятной ошибкой, а не с undefined. */
export function at<T>(items: T[], index: number): T {
  const item = items.at(index)
  if (item === undefined) {
    throw new Error(`В массиве нет элемента с индексом ${index}`)
  }
  return item
}

/** Сужает возможно-отсутствующее значение или роняет тест с понятной ошибкой. */
export function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(`Ожидали ${description}, получили undefined`)
  }
  return value
}
