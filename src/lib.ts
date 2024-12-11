import { mode } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { http, parseSignature, createWalletClient } from "viem";
import type { Address, Hex } from "viem";
import type { TradeArgs, GaslessQuoteResponse } from "./types";

export enum SignatureType {
  Illegal = 0,
  Invalid = 1,
  EIP712 = 2,
  EthSign = 3,
}

/**
 * Validate environment variables at the start
 */
const { PRIVATE_KEY, ZEROEX_API_KEY } = process.env;
if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY is required.");
}
if (!ZEROEX_API_KEY) {
  throw new Error("ZEROEX_API_KEY is required.");
}

/**
 * Initialize the account and wallet client once.
 */
const account = privateKeyToAccount(PRIVATE_KEY as Hex);
const walletClient = createWalletClient({
  account,
  chain: mode,
  transport: http("https://mainnet.mode.network"),
});

/**
 * Fetch a quote from 0x Gasless API.
 */
async function getQuote({
  sellToken,
  buyToken,
  sellAmount,
  taker,
}: {
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  taker: Address;
}): Promise<GaslessQuoteResponse> {
  if (!process.env.ZEROEX_API_KEY) {
    throw new Error("ZEROEX_API_KEY is required.");
  }
  const modeQuoteUrl = new URL("https://api.0x.org/gasless/quote");
  modeQuoteUrl.searchParams.set("chainId", "34443");
  modeQuoteUrl.searchParams.set("sellToken", sellToken);
  modeQuoteUrl.searchParams.set("buyToken", buyToken);
  modeQuoteUrl.searchParams.set("sellAmount", sellAmount);
  modeQuoteUrl.searchParams.set("taker", taker);

  const response = await fetch(modeQuoteUrl.toString(), {
    headers: { "0x-api-key": process.env.ZEROEX_API_KEY, "0x-version": "v2" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch quote: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as GaslessQuoteResponse;
  return data;
}

/**
 * Helper to parse a signature and return an object adhering to expected signature format.
 */
function getParsedSignature(signature: Hex) {
  const { v, r, s } = parseSignature(signature);
  return {
    v: Number(v),
    r,
    s,
    signatureType: SignatureType.EIP712,
  };
}

/**
 * Submits the trade to 0x Gasless API
 */
async function submitTrade(
  approvalPayload: Record<string, unknown>,
  tradePayload: Record<string, unknown>
) {
  if (!process.env.ZEROEX_API_KEY) {
    throw new Error("ZEROEX_API_KEY is required.");
  }
  const response = await fetch("https://api.0x.org/gasless/submit", {
    method: "POST",
    headers: {
      "0x-api-key": process.env.ZEROEX_API_KEY,
      "0x-version": "v2",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chainId: 34443,
      approval: approvalPayload,
      trade: tradePayload,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`${response.status}: ${response.statusText}`);
    console.log(`Error response data: `, data);
    throw new Error(`Failed to submit trade: ${response.statusText}`);
  }

  console.log(`${response.status}: ${response.statusText}`);
  console.log(`tradeHash: `, data);
  return data;
}

/**
 * Polls the 0x API to check the status of the trade until it's confirmed.
 */
function pollTradeStatus(tradeHash: string) {
  const intervalId = setInterval(async () => {
    if (!process.env.ZEROEX_API_KEY) {
      throw new Error("ZEROEX_API_KEY is required.");
    }
    const statusUrl = `https://api.0x.org/gasless/status/${tradeHash}?chainId=34443`;
    const r = await fetch(statusUrl, {
      headers: {
        "0x-api-key": process.env.ZEROEX_API_KEY,
        "0x-version": "v2",
      },
    });

    const d = await r.json();
    if (r.ok) {
      if (d.status === "confirmed") {
        console.log("Trade successful!");
        clearInterval(intervalId);
        process.exit(0);
      }
    } else {
      console.error(`${r.status}: ${r.statusText}`);
    }
  }, 5000);
}

/**
 * Main trade function.
 */
export async function trade({
  sellToken,
  buyToken,
  sellAmount,
  taker,
}: TradeArgs) {
  // Fetch quote from 0x
  const quote = (await getQuote({
    sellToken,
    buyToken,
    sellAmount,
    taker,
  })) as any; // If possible, update typing based on actual 0x response structure.

  const { approval, trade } = quote;

  // Generate approval signature
  const approvalSig = await walletClient.signTypedData(approval.eip712);
  const approvalPayload = {
    ...approval,
    signature: getParsedSignature(approvalSig),
  };

  // Generate trade signature
  const tradeSig = await walletClient.signTypedData(trade.eip712);
  const tradePayload = {
    ...trade,
    signature: getParsedSignature(tradeSig),
  };

  // Submit the trade
  const submitData = await submitTrade(approvalPayload, tradePayload);

  // Poll for trade status
  pollTradeStatus(submitData.tradeHash);
}
