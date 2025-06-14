import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { KeysService } from './keys.service';

@Controller({ path: 'keys', version: '1' })
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  // Generate new key
  @Post('generate')
  async generateNewKey() {
    return this.keysService.generateAPIKey();
  }

  // Validate the API Key
  @Get('validate')
  async validateAPIKey(@Query('apikey') apikey: string) {
    return this.keysService.validateAndVerifyAPIKey(apikey);
  }
}
