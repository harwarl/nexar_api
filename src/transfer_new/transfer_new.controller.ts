import { Controller } from '@nestjs/common';
import { TransferNewService } from './transfer_new.service';

@Controller('transfer-new')
export class TransferNewController {
  constructor(private readonly transferNewService: TransferNewService) {}
}
