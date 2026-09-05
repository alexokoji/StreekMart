"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    // No top margin — the footer butts directly against the last page band
    // so the surface stays continuous from header to base.
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-ink-700 dark:bg-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Logo size={32} />
            <p className="mt-2 text-sm text-gray-600 dark:text-ink-300">
              Fashion marketplace for materials, ready-to-wear, and designer content.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Links</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 dark:text-ink-300 dark:hover:text-white">
                  Shop
                </Link>
              </li>
              <li>
                <Link href="/feed" className="text-sm text-gray-600 hover:text-gray-900 dark:text-ink-300 dark:hover:text-white">
                  Feed
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-sm text-gray-600 hover:text-gray-900 dark:text-ink-300 dark:hover:text-white">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* For Sellers */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">For Sellers</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/seller" className="text-sm text-gray-600 hover:text-gray-900 dark:text-ink-300 dark:hover:text-white">
                  Seller Dashboard
                </Link>
              </li>
              <li>
                <Link href="/designer" className="text-sm text-gray-600 hover:text-gray-900 dark:text-ink-300 dark:hover:text-white">
                  Designer Studio
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Legal</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-ink-300 dark:hover:text-white"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-and-conditions"
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-ink-300 dark:hover:text-white"
                >
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-gray-200 pt-8 dark:border-ink-700">
          <p className="text-center text-sm text-gray-600 dark:text-ink-300">
            © {currentYear} StreekMart. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
