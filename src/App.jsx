import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Services from "./pages/Services";
import Checkout from "./pages/Checkout";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMessages from "./pages/AdminMessages";
import Navbar from "./components/Navbar";
import CartDrawer from "./components/CartDrawer";
import floralBg from "./assets/floral-bg.jpg";

function ScrollControl() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (location.pathname === "/") {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
  }, [location]);

  return null;
}

function App() {
  const AdminRoute = ({ children }) => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      return <AdminLogin />;
    }
    return children;
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-auto text-[#333] font-['Arial',_sans-serif]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-no-repeat bg-right-top"
        style={{ backgroundImage: `url(${floralBg})` }}
      />
      <ScrollControl />
      <Navbar />
      <CartDrawer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/checkout/admin/login" element={<Navigate to="/admin/login" replace />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/messages"
          element={
            <AdminRoute>
              <AdminMessages />
            </AdminRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
