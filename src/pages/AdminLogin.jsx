import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const navigate = useNavigate();
  const apiBaseUrl =
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("credentials");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      const response = await fetch(`${apiBaseUrl}/api/admin/login/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Login failed");
      }

      const data = await response.json();
      if (data.requires_2fa === false && data.token) {
        localStorage.setItem("adminToken", data.token);
        navigate("/admin");
        return;
      }

      setStep("otp");
    } catch (error) {
      setErrorMessage(error.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      const response = await fetch(`${apiBaseUrl}/api/admin/login/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Verification failed");
      }

      const data = await response.json();
      localStorage.setItem("adminToken", data.token);
      navigate("/admin");
    } catch (error) {
      setErrorMessage(error.message || "Verification failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-[120px] max-w-[480px] rounded-lg bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <h1 className="text-2xl font-semibold text-[#c7668b]">
        {step === "credentials" ? "Admin Login" : "Enter Verification Code"}
      </h1>
      {step === "credentials" ? (
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleCredentials}>
          <input
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-[#ccc] p-3"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-[#ccc] p-3"
            required
          />
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <button type="submit" className="rounded-md bg-black p-3 text-white">
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      ) : (
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleVerify}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-[#ccc] p-3"
            required
          />
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <button type="submit" className="rounded-md bg-black p-3 text-white">
            {isSubmitting ? "Verifying..." : "Verify Code"}
          </button>
        </form>
      )}
    </div>
  );
}
