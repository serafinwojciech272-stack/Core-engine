import type { SkillMode } from "./types";

export type BrokerEnvironment = "DEMO" | "SHADOW" | "LIVE";

export type AccountSnapshot = {
  brokerAccountId: string;
  environment: BrokerEnvironment;
  currency: string;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  asOf: string;
};

export type OrderRequest = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  orderType: "MARKET" | "LIMIT" | "STOP";
  stopLoss?: number;
  takeProfit?: number;
  clientOrderId: string;
};

export type OrderResult = {
  brokerOrderId: string;
  status: "ACCEPTED" | "REJECTED" | "FILLED" | "PARTIAL" | "CANCELLED";
  filledQuantity: number;
  averagePrice?: number;
  brokerTimestamp: string;
};

export interface BrokerAdapter {
  readonly id: string;
  readonly environment: BrokerEnvironment;
  getAccountSnapshot(): Promise<AccountSnapshot>;
  submitOrder(request: OrderRequest): Promise<OrderResult>;
  cancelOrder(clientOrderId: string): Promise<OrderResult>;
  getOpenPositions(): Promise<unknown[]>;
}

export function assertBrokerMode(expected: BrokerEnvironment, mode: SkillMode): void {
  if (expected === "LIVE" && mode !== "LIVE") throw new Error("BROKER_MODE_MISMATCH");
  if (expected !== "LIVE" && mode === "LIVE") throw new Error("LIVE_REQUIRES_LIVE_BROKER_ADAPTER");
}