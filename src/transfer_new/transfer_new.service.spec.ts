import { Test, TestingModule } from '@nestjs/testing';
import { TransferNewService } from './transfer_new.service';
import { AcrossService } from './across.service';
import { getModelToken } from '@nestjs/mongoose';

describe('TransferNewService', () => {
  let service: TransferNewService;
  let acrossService: Partial<AcrossService>;

  beforeEach(async () => {
    // Define the across service in here
    acrossService = {
      getQuote: jest.fn().mockResolvedValue({
        deposit: {},
        isAmountTooLow: false,
        fees: {},
      }),
      calculateFee: jest.fn().mockReturnValue({
        error: null,
        value: 100n,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferNewService,
        { provide: AcrossService, useValue: acrossService },
        { provide: getModelToken('TRANSACTION_MODEL'), useValue: {} },
      ],
    }).compile();

    service = module.get<TransferNewService>(TransferNewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
