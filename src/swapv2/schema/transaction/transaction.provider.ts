import { Connection } from 'mongoose';
import { TransactionSchemaV2 } from './transaction.schema';

export const TransactionProvidersV2 = [
  {
    provide: 'TRANSACTION_MODEL_V2',
    useFactory: (connection: Connection) =>
      connection.model('TransactionV2', TransactionSchemaV2),
    inject: ['DATABASE_CONNECTION'],
  },
];
