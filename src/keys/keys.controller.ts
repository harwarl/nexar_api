import { Controller, Get, Post, Req } from '@nestjs/common';
import { KeysService } from './keys.service';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
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
  async validateAPIKey(@Req() req: any) {
    return req['apiKeyPayload'];
  }
}
