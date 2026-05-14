"use client";

import { createContext, useContext } from "react";
import { type CurrencyContext, DEFAULT_USD_CTX } from "@/lib/currency";

// React context fed by the server-resolved CurrencyContext from layout.tsx.
// Every Price component pulls from here, which means SSR and client hydration
// always see the same value (the layout server-renders the same context the
// client provider receives as a prop).

const Ctx = createContext<CurrencyContext>(DEFAULT_USD_CTX);

export function CurrencyProvider({
  ctx,
  children,
}: {
  ctx: CurrencyContext;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyContext {
  return useContext(Ctx);
}
