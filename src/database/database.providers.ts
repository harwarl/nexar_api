import { ConfigService } from '@nestjs/config';
import * as mongoose from 'mongoose';

export const databaseProviders = [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: async (
      configService: ConfigService,
    ): Promise<typeof mongoose> => {
      try {
        const uri = configService.get<string>('MONGO_URI');
        if (!uri) {
          throw new Error(
            'MONGO_URI is not defined in the environment variables',
          );
        }
        return await mongoose.connect(uri);
      } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
      }
    },
    inject: [ConfigService],
  },
];
