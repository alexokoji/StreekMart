"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Tiny context that shares the buyer's currently-selected shipping total
// and any applied promo-code discount between CheckoutForm, the promo
// input, and the sidebar summary so the Total line stays correct.
type Ctx = {
  shippingKoboTotal: number;
  setShippingKoboTotal: (v: number) => void;
  promoCode: string | null;
  promoDiscountCents: number;
  setPromo: (args: { code: string; discountCents: number } | null) => void;
};

const CheckoutTotalsContext = createContext<Ctx>({
  shippingKoboTotal: 0,
  setShippingKoboTotal: () => {},
  promoCode: null,
  promoDiscountCents: 0,
  setPromo: () => {},
});

export function CheckoutTotalsProvider({ children }: { children: ReactNode }) {
  const [shippingKoboTotal, setShippingKoboTotal] = useState(0);
  const [promo, setPromoState] = useState<{ code: string; discountCents: number } | null>(null);
  return (
    <CheckoutTotalsContext.Provider
      value={{
        shippingKoboTotal,
        setShippingKoboTotal,
        promoCode: promo?.code ?? null,
        promoDiscountCents: promo?.discountCents ?? 0,
        setPromo: (v) => setPromoState(v),
      }}
    >
      {children}
    </CheckoutTotalsContext.Provider>
  );
}

export function useCheckoutTotals(): Ctx {
  return useContext(CheckoutTotalsContext);
}