import { Module } from '@nestjs/common'

import { UsersModule } from '../users/users.module'
import { UnsubscribeController } from './unsubscribe.controller'

@Module({
  imports: [UsersModule],
  controllers: [UnsubscribeController],
})
export class UnsubscribeModule {}
