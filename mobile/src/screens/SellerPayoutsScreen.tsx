import React from "react";
import { WalletScreen } from "./DesignerEarningsScreen";

// Seller payouts use the same wallet as the web /seller/wallet page:
// balance, escrow hold, transactions and bank withdrawal.
export function SellerPayoutsScreen() {
  return <WalletScreen title="Payouts" tone="cta" />;
}
