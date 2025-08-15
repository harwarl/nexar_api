import { Injectable, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AffiliateService } from './affiliate.service';
import { GetTokensQuery } from './dto/getTokensQuery.dto';

@Injectable()
export class Swapv2Service {
  constructor(
    private readonly configService: ConfigService,
    private readonly affiliateService: AffiliateService,
  ) {}

  // Get Popular tokens from the affiliate service
  private async getPopularTokens() {
    const tokens = await this.affiliateService.getPopularTokens();
    return tokens;
  }

  // Get all the tokens
  private async getAllTokens(page: number = 1) {
    return await this.affiliateService.getAllTokens(page);
  }

  async getTokens(getTokensQuery: GetTokensQuery) {
    switch (getTokensQuery.type) {
      case 'popular':
        return await this.getPopularTokens();

      default:
        return await this.getAllTokens(getTokensQuery.page);
    }
  }
}
