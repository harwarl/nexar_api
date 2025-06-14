import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Key } from 'readline';
import { Model } from 'mongoose';
import { valid } from 'joi';

@Injectable()
export class KeysService {
  constructor(@Inject('KEYS_MODEL') private readonly keysModel: Model<Key>) {}

  // Validate a key
  async validateKey(key: string, isMaster: boolean = false): Promise<boolean> {
    if (!key || key.length !== 64) {
      throw new BadRequestException('Invalid key format');
    }

    let query = {
      key,
      isActive: true,
      ...(isMaster === true && { isMaster: true }),
    };

    const keyRecord = await this.keysModel.findOne(query).exec();

    if (!keyRecord) {
      throw new BadRequestException('Key not found or inactive');
    }
    return true;
  }

  // Validate master key and generate a new key if valid
  async validateMasterKeyAndGenerateNew(masterKey: string): Promise<string> {
    if (!masterKey || masterKey.length !== 64) {
      throw new BadRequestException('Invalid master key format');
    }

    const validated = await this.validateKey(masterKey, true);
    if (!validated) {
      throw new BadRequestException('Master key validation failed');
    }

    return await this._generateKeyAndSave();
  }

  // Generate a new key
  private async _generateKeyAndSave(): Promise<string> {
    const key = this._generateKey();
    const newKey = await this.keysModel.create({
      key: key,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiration
      isActive: true,
      isMaster: false,
    });

    if (newKey) {
      return key;
    }

    throw new BadRequestException('Failed to generate and save key');
  }

  private _generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
