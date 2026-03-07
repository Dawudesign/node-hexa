import { Module } from '@nestjs/common';
import { USER_REPOSITORY_PORT } from './domain/ports/user.repository.port';
import { InMemoryUserRepository } from './infrastructure/persistence/in-memory-user.repository';
import { CreateUserUseCase } from './application/use-cases/create-user.usecase';
import { UserController } from './infrastructure/http/user.controller';

@Module({
  controllers: [UserController],
  providers: [
    { provide: USER_REPOSITORY_PORT, useClass: InMemoryUserRepository },
    CreateUserUseCase,
  ],
})
export class IamModule {}
