import { Test, TestingModule } from '@nestjs/testing';
import { TransferNewService } from './transfer_new.service';

describe('TransferNewService', () => {
  let service: TransferNewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransferNewService],
    }).compile();

    service = module.get<TransferNewService>(TransferNewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
