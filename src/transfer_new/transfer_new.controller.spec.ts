import { Test, TestingModule } from '@nestjs/testing';
import { TransferNewController } from './transfer_new.controller';
import { TransferNewService } from './transfer_new.service';

describe('TransferNewController', () => {
  let controller: TransferNewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransferNewController],
      providers: [TransferNewService],
    }).compile();

    controller = module.get<TransferNewController>(TransferNewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
