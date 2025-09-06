import { Connection } from 'mongoose';
import { QuoteSchema } from './quote.schema';

export const QuoteProvider = [
  {
    provide: 'QUOTE_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Quotes', QuoteSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
