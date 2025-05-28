import { Interface, JsonRpcProvider, WebSocketProvider } from 'ethers';
import ERC20_ABI from '../src/abi/ERC20_abi.json';
import 'dotenv/config';

export const provider = new JsonRpcProvider(process.env.ETH_RPC!);
// export const wssProvider = new WebSocketProvider(process.env.ETH_WSS_RPC!);
export const ERC20_Interface = new Interface(ERC20_ABI);
export const ABI = ERC20_ABI;
