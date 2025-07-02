import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { erc20Abi, Transaction } from 'viem';
import { AcrossService } from './across.service';
import { Contract, HDNodeWallet, JsonRpcProvider, Wallet } from 'ethers';
import { SUPPORTED_TOKENS, TOKEN_ADDRESS } from 'utils/constants';

@Injectable()
export class TransferNewService {
  private BACKEND_WALLET: `0x${string}`;
  constructor(
    @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
    private readonly acrossService: AcrossService,
  ) {}

  /*------------------------------ Private Functions ------------------------------*/
  // This removes and sends the platform 1% fee to the backend wallet, sends ETH or any other ERC 20 related token to the backend wallet
  async remove_fee(
    token: SUPPORTED_TOKENS,
    amount: number,
    fromWallet: HDNodeWallet,
    provider: JsonRpcProvider,
    network: 'ETH' | 'BASE' = 'ETH',
  ) {
    // CALCULATE 1%
    const feeAmount = BigInt(Math.floor(amount * 0.01 * 1e18));
    let tokenAddress: `0x${string}` | undefined = undefined;

    // If not ETH, get the token address for the network
    if (token !== SUPPORTED_TOKENS.WETH && token !== SUPPORTED_TOKENS.USDC) {
      throw new Error('Unsupported token for fee removal');
    }
    if (token !== SUPPORTED_TOKENS.WETH && token !== SUPPORTED_TOKENS.USDC) {
      throw new Error('Unsupported token for fee removal');
    }
    if (token === SUPPORTED_TOKENS.WETH || token === SUPPORTED_TOKENS.USDC) {
      tokenAddress = TOKEN_ADDRESS[token][network] as `0x${string}`;
    }

    // For ETH, tokenAddress remains undefined
    return await this.transfer(
      feeAmount,
      this.BACKEND_WALLET,
      fromWallet,
      provider,
      token === SUPPORTED_TOKENS.WETH || token === SUPPORTED_TOKENS.USDC
        ? tokenAddress
        : undefined,
    );
  }
  // The universal Transfer function for both ETH AND WETH AND other ERC20 tokens
  private async transfer(
    amount: bigint,
    recipientAddress: `0x${string}`,
    wallet: HDNodeWallet,
    provider: JsonRpcProvider,
    tokenAddress?: `0x${string}`,
  ): Promise<`0x{string}`> {
    const signer = wallet.connect(provider);
    if (!tokenAddress) {
      // Transfer Native ETH
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: amount,
      });
      await tx.wait();
      return tx.hash as `0x{string}`;
    } else {
      // ERC 20 transfer (WETH) or any ERC20
      const erc20Contract = new Contract(tokenAddress, erc20Abi, signer);
      const tx = await erc20Contract.transfer(recipientAddress, amount);
      await tx.wait();
      return tx.hash as `0x{string}`;
    }
  }

  // Generate Wallets Need for the private transactions
  private async generateWallets(): Promise<{
    walletA: HDNodeWallet;
    walletB: HDNodeWallet;
  }> {
    return {
      walletA: Wallet.createRandom(),
      walletB: Wallet.createRandom(),
    };
  }
}
