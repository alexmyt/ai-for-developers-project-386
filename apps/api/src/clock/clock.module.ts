import { Global, Module } from '@nestjs/common'
import { Clock } from './clock'

// Глобальный модуль: время нужно всем сервисам состояния (ADR-0003).
@Global()
@Module({
  providers: [Clock],
  exports: [Clock],
})
export class ClockModule {}
