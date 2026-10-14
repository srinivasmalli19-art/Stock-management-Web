import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** Keycloak redirects here after "Sign in with SLC Account". */
export default function SsoCallbackPage() {
  const { completeSsoLogin } = useAuth();
  const [message, setMessage] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React StrictMode runs effects twice; the code is single-use.
    started.current = true;
    completeSsoLogin().catch((err) => {
      setMessage(err?.response?.data?.message || "SLC sign-in could not be completed. Please try again.");
    });
  }, [completeSsoLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[420px] bg-white rounded-4xl shadow-card-lg border border-border/60 px-8 py-10 text-center">
        {!message ? (
          <>
            <span className="inline-block w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-muted mt-4 font-medium">Signing you in with your SLC Account…</p>
          </>
        ) : (
          <>
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium" role="alert">
              {message}
            </div>
            <Link to="/login" className="inline-block mt-5 text-sm font-bold text-indigo-600 hover:text-indigo-800">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
