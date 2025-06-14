import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { KeysService } from 'src/keys/keys.service';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  constructor(private readonly keyService: KeysService) {}

  async use(req: any, res: any, next: (error?: Error | any) => void) {
    if (req.originalUrl === '/api/v1/keys/generate' && req.method === 'POST') {
      return next();
    }

    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        throw new UnauthorizedException('Missing Api Key');
      }

      const result = await this.keyService.validateAndVerifyAPIKey(apiKey);

      if (!result.valid) {
        throw new UnauthorizedException(`Invalid API key: ${result.reason}`);
      }

      // Attach API key data to the request
      req['apiKeyPayload'] = result;

      next();
    } catch (error) {
      next(error);
    }
  }
}
