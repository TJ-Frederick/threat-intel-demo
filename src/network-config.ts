import { type X402Config } from './x402';

export type NetworkKey = 'mainnet' | 'testnet';

export interface PublicNetworkConfig {
  key: NetworkKey;
  label: string;
  chainName: string;
  chainId: number;
  network: string;
  rpcUrl: string;
  explorerBaseUrl: string;
  facilitatorUrl: string;
  paymentAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenVersion: string;
  tokenDecimals: number;
  permit2Address: string;
  x402Permit2Proxy: string;
  batchContractAddress: string;
  amountPerRequest: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface WorkerNetworkConfig extends PublicNetworkConfig {
  facilitatorApiKey?: string;
}

export interface Env {
  PAYMENT_ADDRESS?: string;
  PAYMENT_ADDRESS_MAINNET?: string;
  PAYMENT_ADDRESS_TESTNET?: string;
  FACILITATOR_API_KEY?: string;
  FACILITATOR_API_KEY_MAINNET?: string;
  FACILITATOR_API_KEY_TESTNET?: string;
  RPC_URL_MAINNET?: string;
  RPC_URL_TESTNET?: string;
  SBC_TOKEN_ADDRESS?: string;
  SBC_TOKEN_ADDRESS_MAINNET?: string;
  SBC_TOKEN_ADDRESS_TESTNET?: string;
  X402_PERMIT2_PROXY?: string;
  X402_PERMIT2_PROXY_MAINNET?: string;
  X402_PERMIT2_PROXY_TESTNET?: string;
  BATCH_CONTRACT_ADDRESS?: string;
  BATCH_CONTRACT_ADDRESS_MAINNET?: string;
  BATCH_CONTRACT_ADDRESS_TESTNET?: string;
}

export const DEFAULT_NETWORK_KEY: NetworkKey = 'mainnet';

const DEFAULT_PAYMENT_ADDRESS = '0xDA60059faBf3e71338c27C505CED519f55d605DD';
const DEFAULT_SBC_TOKEN = '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb';
const DEFAULT_PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const DEFAULT_X402_PROXY = '0x402085c248EeA27D92E8b30b2C58ed07f9E20001';
const DEFAULT_BATCH_CONTRACT = '0x71e14b65a8305a9a95a675abccb993f929b53885';

function getEnvValue(env: Env, ...keys: Array<keyof Env>): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function getNetworkKeyFromUrl(url: URL): NetworkKey {
  const value = url.searchParams.get('network');
  return value === 'testnet' ? 'testnet' : DEFAULT_NETWORK_KEY;
}

export function getPublicNetworkConfigs(env: Env): Record<NetworkKey, PublicNetworkConfig> {
  const mainnetPaymentAddress =
    getEnvValue(env, 'PAYMENT_ADDRESS_MAINNET', 'PAYMENT_ADDRESS') ?? DEFAULT_PAYMENT_ADDRESS;
  const testnetPaymentAddress =
    getEnvValue(env, 'PAYMENT_ADDRESS_TESTNET', 'PAYMENT_ADDRESS') ?? mainnetPaymentAddress;

  const mainnetTokenAddress =
    getEnvValue(env, 'SBC_TOKEN_ADDRESS_MAINNET', 'SBC_TOKEN_ADDRESS') ?? DEFAULT_SBC_TOKEN;
  const testnetTokenAddress =
    getEnvValue(env, 'SBC_TOKEN_ADDRESS_TESTNET', 'SBC_TOKEN_ADDRESS') ?? mainnetTokenAddress;

  const mainnetProxy =
    getEnvValue(env, 'X402_PERMIT2_PROXY_MAINNET', 'X402_PERMIT2_PROXY') ?? DEFAULT_X402_PROXY;
  const testnetProxy =
    getEnvValue(env, 'X402_PERMIT2_PROXY_TESTNET', 'X402_PERMIT2_PROXY') ?? mainnetProxy;

  const mainnetBatch =
    getEnvValue(env, 'BATCH_CONTRACT_ADDRESS_MAINNET', 'BATCH_CONTRACT_ADDRESS') ??
    DEFAULT_BATCH_CONTRACT;
  const testnetBatch =
    getEnvValue(env, 'BATCH_CONTRACT_ADDRESS_TESTNET', 'BATCH_CONTRACT_ADDRESS') ??
    '0x969ccd1a4dd08bdb490745b6a10a8a9365d05fd8';

  return {
    mainnet: {
      key: 'mainnet',
      label: 'Radius Mainnet',
      chainName: 'Radius Mainnet',
      chainId: 723487,
      network: 'eip155:723487',
      rpcUrl:
        getEnvValue(env, 'RPC_URL_MAINNET') ??
        'https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2',
      explorerBaseUrl: 'https://network.radiustech.xyz',
      facilitatorUrl: 'https://facilitator.radiustech.xyz',
      paymentAddress: mainnetPaymentAddress,
      tokenAddress: mainnetTokenAddress,
      tokenName: 'Stable Coin',
      tokenVersion: '1',
      tokenDecimals: 6,
      permit2Address: DEFAULT_PERMIT2,
      x402Permit2Proxy: mainnetProxy,
      batchContractAddress: mainnetBatch,
      amountPerRequest: '100',
      nativeCurrency: { name: 'RUSD', symbol: 'RUSD', decimals: 18 },
    },
    testnet: {
      key: 'testnet',
      label: 'Radius Testnet',
      chainName: 'Radius Testnet',
      chainId: 72344,
      network: 'eip155:72344',
      rpcUrl: getEnvValue(env, 'RPC_URL_TESTNET') ?? 'https://rpc.testnet.radiustech.xyz',
      explorerBaseUrl: 'https://testnet.radiustech.xyz',
      facilitatorUrl: 'https://facilitator.testnet.radiustech.xyz',
      paymentAddress: testnetPaymentAddress,
      tokenAddress: testnetTokenAddress,
      tokenName: 'Stable Coin',
      tokenVersion: '1',
      tokenDecimals: 6,
      permit2Address: DEFAULT_PERMIT2,
      x402Permit2Proxy: testnetProxy,
      batchContractAddress: testnetBatch,
      amountPerRequest: '100',
      nativeCurrency: { name: 'RUSD', symbol: 'RUSD', decimals: 18 },
    },
  };
}

export function getWorkerNetworkConfigs(env: Env): Record<NetworkKey, WorkerNetworkConfig> {
  const publicConfigs = getPublicNetworkConfigs(env);

  return {
    mainnet: {
      ...publicConfigs.mainnet,
      facilitatorApiKey: getEnvValue(env, 'FACILITATOR_API_KEY_MAINNET', 'FACILITATOR_API_KEY'),
    },
    testnet: {
      ...publicConfigs.testnet,
      facilitatorApiKey: getEnvValue(env, 'FACILITATOR_API_KEY_TESTNET', 'FACILITATOR_API_KEY'),
    },
  };
}

export function toX402Config(config: WorkerNetworkConfig): X402Config {
  return {
    asset: config.tokenAddress,
    network: config.network,
    payTo: config.paymentAddress,
    facilitatorUrl: config.facilitatorUrl,
    facilitatorApiKey: config.facilitatorApiKey,
    amount: config.amountPerRequest,
    tokenName: config.tokenName,
    tokenVersion: config.tokenVersion,
  };
}
