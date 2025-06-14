import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Key } from 'readline';
import { Model } from 'mongoose';
import { valid } from 'joi';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeysService {
  private NO_OF_MONTHS = 5;
  constructor(private readonly configService: ConfigService) {}

  // Validate a key
  async _validateKey(): Promise<Boolean> {
    return true;
  }

  // Generate a new key
  async generateAPIKey(): Promise<string> {
    // generate a new key
    const key = this._generateAPIKey();
    // save the key to the database
    // const newKey = await this.keysModel.create({
    //   key: key,
    //   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiration
    //   isActive: true,
    //   isMaster: false,
    // });

    // Check if the key was saved successfully
    // if (!newKey) {
    //   throw new BadRequestException('Failed to save the new key');
    // }

    // Return the generated key
    return key;
  }

  private async _coupleKey() {}

  private async _decoupleKey() {}

  // Generate a random key
  private _generateAPIKey(): string {
    // Get identifier
    const identifier = this._generateIdentifier();

    // Create a data that combines identifier with the expiry date
    const data = `${identifier}:${this._getExpiry()}`;

    // create a signature with hmac
    const signature = crypto
      .createHmac('sha256', this.configService.get('MASTER_KEY'))
      .update(data)
      .digest('hex');

    console.log({ signature });

    const key = Buffer.from(`${data}:${signature}`).toString('base64url');
    return key;
  }

  async validateAndVerifyAPIKey(apiKey: string) {
    try {
      const decoded = Buffer.from(apiKey, 'base64url').toString();
      const [identifier, expiryStr, signature] = decoded.split(':');
      const expiry = parseInt(expiryStr);

      if (Date.now() > expiry) throw new BadRequestException('Expired API Key');

      const data = `${identifier}:${expiry}`;
      const expectedSig = crypto
        .createHmac('sha256', this.configService.get('MASTER_KEY'))
        .update(data)
        .digest('hex');

      const isValid = signature === expectedSig;

      return {
        valid: isValid,
        identifier,
        expiresAt: expiry,
        reason: isValid ? 'ok' : 'invalid_signature',
      };
    } catch (error) {
      console.log({ error });
      return { valid: false, reason: 'malformed_token' };
    }
  }

  private _generateIdentifier(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private _getExpiry() {
    let expiry = new Date();
    return expiry.setMonth(expiry.getMonth() + this.NO_OF_MONTHS);
  }
}
