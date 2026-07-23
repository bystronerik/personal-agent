import { Global, Module } from '@nestjs/common'

import { type ApiConfig, loadApiConfig } from './env'

export const API_CONFIG = Symbol('API_CONFIG')

@Global()
@Module({
  providers: [
    { provide: API_CONFIG, useFactory: (): ApiConfig => loadApiConfig() },
  ],
  exports: [API_CONFIG],
})
export class ConfigModule {}
