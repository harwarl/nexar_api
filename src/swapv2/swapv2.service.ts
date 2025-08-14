import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AffiliateService } from './affiliate.service';

@Injectable()
export class Swapv2Service {
  constructor(
    private readonly configService: ConfigService,
    private readonly affiliateService: AffiliateService,
  ) {}

  // Get all tokens from the affiliate service
  async getTokens() {
    const tokens = await this.affiliateService.getAllTokens();

    console.log({ tokens });

    return tokens;
  }
}
