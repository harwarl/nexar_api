import { Test, TestingModule } from '@nestjs/testing';
import { Swapv2Controller } from './swapv2.controller';
import { Swapv2Service } from './swapv2.service';

describe('Swapv2Controller', () => {
  let controller: Swapv2Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Swapv2Controller],
      providers: [Swapv2Service],
    }).compile();

    controller = module.get<Swapv2Controller>(Swapv2Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
