import { Body, Controller, Post } from '@nestjs/common';
import {
  CreateUserUseCase,
  CreateUserDto,
} from '../../application/use-cases/create-user.usecase';

@Controller('users')
export class UserController {
  constructor(private readonly createUser: CreateUserUseCase) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.createUser.execute(dto);
  }
}
