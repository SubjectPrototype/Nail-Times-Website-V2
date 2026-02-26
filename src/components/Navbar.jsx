// src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { setIsCartOpen, cartItems, isCartOpen } = useCart();

  return (
    <nav className="fixed top-0 z-[1000] flex h-[70px] w-full items-center justify-between px-[60px] box-border bg-white/75 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="text-[1.4rem] font-semibold text-[#d16c8f]">
        <img
          src={`${process.env.PUBLIC_URL}/flower-icon.png`}
          alt="Logo"
          className="h-10 w-10 object-contain"
        />
      </div>

      <ul className="flex list-none items-center gap-8">
        <li><Link className="text-[1rem] font-bold text-[#555] no-underline transition-colors hover:text-[#d16c8f]" to="/">Home</Link></li>
        <li><Link className="text-[1rem] font-bold text-[#555] no-underline transition-colors hover:text-[#d16c8f]" to="/services">Services</Link></li>

        <li>
          <button
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-black hover:bg-[#bf5c7d] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d16c8f]/25 focus-visible:ring-offset-2"
            aria-label="Open cart"
            onClick={() => setIsCartOpen(!isCartOpen)}
          >
            <svg
              className="block h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartItems.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#e03131] px-1 text-[0.7rem] font-bold text-white">
                {cartItems.length}
              </span>
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}
