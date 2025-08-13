import { Controller, Get } from '@nestjs/common';
import { Swapv2Service } from './swapv2.service';

@Controller({ path: 'swap', version: '2' })
export class Swapv2Controller {
  constructor(private readonly swapv2Service: Swapv2Service) {}

  @Get('tokens')
  async getTokens() {
    return this.swapv2Service.getTokens();
  }
}
