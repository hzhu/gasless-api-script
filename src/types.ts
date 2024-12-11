import type { Address } from "viem";
import type { TypedData, TypedDataDomain } from "abitype";

export interface EIP712TypedData {
  types: TypedData;
  domain: TypedDataDomain;
  message: {
    [key: string]: unknown;
  };
  primaryType: string;
}

export interface TradeArgs {
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  taker: Address;
}

/**
 * Type definition for 0x Gasless Quote response (simplified).
 * Adjust fields as necessary based on the actual API response.
 */
export interface GaslessQuoteResponse {
  transaction: {
    to: Address;
    data: string;
    gas: string;
    gasPrice: string;
    value: string;
  };
  permit2: {
    eip712: Record<string, unknown>;
  };
}
