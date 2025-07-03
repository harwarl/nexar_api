import { Connection } from 'mongoose';
import { TransferSchema } from './transfer.schema';

export const transferProviders = [
  {
    provide: 'TRANSFER_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Transfer', TransferSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
