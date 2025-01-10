import { Test, TestingModule } from '@nestjs/testing';
import { SwapService } from './swap.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { BASE_URL } from '../../utils/constants';

describe('SwapService', () => {
  let swapService: SwapService;
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    swapService = module.get<SwapService>(SwapService);
    configService = module.get<ConfigService>(ConfigService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(swapService).toBeDefined();
  });

  describe('getTokens', () => {
    it('should fetch tokens from the API', async () => {
      const mockBaseUrl = 'http://mock-base-url';
      const mockTokensPath = '/mock-tokens-path';
      const mockResponse: AxiosResponse<any> = {
        data: ['token1', 'token2'],
        headers: new AxiosHeaders({ url: 'http://localhost:3000/mockUrl' }),
        config: {
          url: 'http://localhost:3000/mockUrl',
          headers: new AxiosHeaders({ 'User-Agent': 'custom-user-agent' }),
        },
        status: 200,
        statusText: 'OK',
      };

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'BASE_URL') return mockBaseUrl;
        return null;
      });

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      expect(configService.get).toHaveBeenCalledWith('BASE_URL');
      expect(httpService.get).toHaveBeenLastCalledWith(
        `${mockBaseUrl}${mockTokensPath}`,
      );
    });
  });
});
