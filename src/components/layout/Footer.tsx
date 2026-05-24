"use client";

import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-12">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold text-gray-900">UpClo</h3>
            <p className="mt-2 text-sm text-gray-600">
              Fashion marketplace for materials, ready-to-wear, and designer content.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Quick Links</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                  Shop
                </Link>
              </li>
              <li>
                <Link href="/feed" className="text-sm text-gray-600 hover:text-gray-900">
                  Feed
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-sm text-gray-600 hover:text-gray-900">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* For Sellers */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">For Sellers</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/seller" className="text-sm text-gray-600 hover:text-gray-900">
                  Seller Dashboard
                </Link>
              </li>
              <li>
                <Link href="/designer" className="text-sm text-gray-600 hover:text-gray-900">
                  Designer Studio
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Legal</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-and-conditions"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <p className="text-center text-sm text-gray-600">
            © {currentYear} UpClo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
