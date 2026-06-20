// Cart count cache.
//
// Single source of truth for "how many items are in my cart right now"
// so every cart icon in the app (BottomNav tab, BackHeader actions,
// ProductDetail) renders the same badge without each screen hitting
// /api/cart independently.
//
// - Fetches once on AuthContext.user change and re-fetches on every
//   call to bumpCart() (used by add-to-cart / remove flows).
// - Falls back to 0 silently on auth/network errors so the badge
//   never breaks the icon rendering.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

type CartCtx = {
  itemCount: number;
  bumpCart: () => Promise<void>;
};

const Ctx = createContext<CartCtx>({ itemCount: 0, bumpCart: async () => {} });

type CartResp = {
  items?: Array<unknown>;
  itemCount?: number;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [itemCount, setItemCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setItemCount(0);
      return;
    }
    try {
      const r = await api.get<CartResp>("/api/cart");
      // Prefer the server's itemCount (distinct line items, matches
      // /api/cart's badge convention); fall back to items.length so
      // older builds still hydrate the badge.
      const count =
        typeof r.itemCount === "number"
          ? r.itemCount
          : Array.isArray(r.items)
            ? r.items.length
            : 0;
      setItemCount(count);
    } catch {
      setItemCount(0);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ itemCount, bumpCart: refresh }}>{children}</Ctx.Provider>
  );
}

export function useCart(): CartCtx {
  return useContext(Ctx);
}
