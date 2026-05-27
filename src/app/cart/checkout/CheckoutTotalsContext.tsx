"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Tiny context that shares the buyer's currently-selected shipping total
// (in NGN-kobo) between CheckoutForm and the sidebar summary so the
// Summary's Total line can include shipping. State lives at the provider
// level so the form (which owns the courier selection) writes and the
// aside (which displays the running total) reads.
type Ctx = {
  shippingKoboTotal: number;
  setShippingKoboTotal: (v: number) => void;
};

const CheckoutTotalsContext = createContext<Ctx>({
  shippingKoboTotal: 0,
  setShippingKoboTotal: () => {},
});

export function CheckoutTotalsProvider({ children }: { children: ReactNode }) {
  const [shippingKoboTotal, setShippingKoboTotal] = useState(0);
  return (
    <CheckoutTotalsContext.Provider value={{ shippingKoboTotal, setShippingKoboTotal }}>
      {children}
    </CheckoutTotalsContext.Provider>
  );
}

export function useCheckoutTotals(): Ctx {
  return useContext(CheckoutTotalsContext);
}
