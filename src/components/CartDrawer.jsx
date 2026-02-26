import { useEffect } from "react";
import { useCart } from "../context/CartContext";
import { Link } from "react-router-dom";

export default function CartDrawer() {
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart } = useCart();
  const getItemDurationMinutes = (item) => Number(item.durationMinutes || Number(item.timeValue || 0) * 15 || 0);
  const total = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const totalDurationMinutes = cartItems.reduce((sum, item) => sum + getItemDurationMinutes(item), 0);
  const effectiveDurationMinutes = totalDurationMinutes > 0 ? totalDurationMinutes : 0;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;

    if (isCartOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [isCartOpen]);

  return (
    <>
      {/* Overlay */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-[998] bg-black/40 overscroll-none"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-[70px] z-[1100] flex h-[calc(100dvh-70px)] w-screen max-w-[420px] flex-col bg-white p-4 shadow-[-4px_0_20px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out md:top-[70px] md:h-[calc(100vh-70px)] md:p-6 ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <h2 className="text-xl font-semibold text-[#c7668b]">Your Cart</h2>

        <div className="mt-3 flex-1 overflow-y-auto pr-1 pb-4 overscroll-contain">
          {cartItems.length === 0 && (
            <p className="text-sm text-[#555]">Your cart is empty</p>
          )}

          {cartItems.map((item) => (
            <div key={item.id} className="mb-4 border-b border-[#f0f0f0] pb-3">
              <p className="text-[#333]">{item.name}</p>
              <p className="mt-1 text-sm text-[#777]">
                {item.technician ? `Tech: ${item.technician}` : "Tech: Any"} - {getItemDurationMinutes(item) || "?"} min
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="tabular-nums text-[#333]">${item.price}</span>
                <button
                  className="text-sm font-semibold text-[#c7668b] hover:text-[#a24e6f]"
                  onClick={() => removeFromCart(item.id)}
                >
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-[#f0f0f0] bg-white pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 md:border-t-0 md:bg-transparent md:pb-0 md:pt-0">
          {cartItems.length > 0 && (
            <>
              <div className="mt-2 flex items-center justify-between pt-2">
                <span className="text-[0.95rem] font-semibold text-[#333]">Total</span>
                <span className="text-[1rem] font-bold text-[#333] tabular-nums">${total}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[0.95rem] font-semibold text-[#333]">Total Time</span>
                <span className="text-[1rem] font-bold text-[#333] tabular-nums">{effectiveDurationMinutes} min</span>
              </div>
            </>
          )}

          <Link
            to="/checkout"
            onClick={() => setIsCartOpen(false)}
            className="mt-6 block w-full rounded-md bg-black px-4 py-3 text-center text-white"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </>
  );
}
