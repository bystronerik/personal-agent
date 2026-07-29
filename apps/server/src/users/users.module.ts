import { Module } from '@nestjs/common'

import { Auth0ProfileService } from './auth0-profile.service'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [UsersController],
  providers: [Auth0ProfileService, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
