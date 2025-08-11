import { Test, TestingModule } from '@nestjs/testing';
import { Swapv2Service } from './swapv2.service';

describe('Swapv2Service', () => {
  let service: Swapv2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Swapv2Service],
    }).compile();

    service = module.get<Swapv2Service>(Swapv2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
