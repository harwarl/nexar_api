import { Module } from '@nestjs/common';
import { Swapv2Service } from './swapv2.service';
import { Swapv2Controller } from './swapv2.controller';

@Module({
  controllers: [Swapv2Controller],
  providers: [Swapv2Service],
})
export class Swapv2Module {}
