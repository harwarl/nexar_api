import { JsonRpcProvider } from 'ethers';
import 'dotenv/config';

export const provider = new JsonRpcProvider(process.env.ETH_RPC!);
