import { Connection } from 'mongoose';
import { KeysSchema } from './keys.schema';

export const transactionsProviders = [
  {
    provide: 'KEYS_MODEL',
    useFactory: (connection: Connection) => connection.model('Key', KeysSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
