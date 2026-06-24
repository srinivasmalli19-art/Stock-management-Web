import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data) => {
    setLoginError(null);
    setLoading(true);
    try {
      await login(data.email, data.password);
    } catch (err) {
      const msg = err?.response?.data?.message || "Invalid credentials";
      toast.error(msg);
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 px-4">
      <div className="w-full max-w-[420px] fade-up">

        {/* Card */}
        <div className="bg-white rounded-4xl shadow-card-lg border border-border/60 px-8 py-10">

          {/* Logo + branding */}
          <div className="text-center mb-9">
            <div className="relative inline-flex mb-5">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl flex items-center justify-center shadow-lift">
                <i className="ti ti-tool text-white text-4xl" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
                <i className="ti ti-check text-white text-[10px] font-black" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-text tracking-tight">LogiTask</h1>
            <p className="text-sm text-muted mt-1.5 font-medium">Field Operations Management</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <i className="ti ti-mail absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-[16px] pointer-events-none" />
                <input
                  {...register("email", { onChange: () => setLoginError(null) })}
                  type="email"
                  className="input pl-10"
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-xs text-danger mt-1.5 font-medium">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-1.5">
                Password
              </label>
              <div className="relative">
                <i className="ti ti-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-[16px] pointer-events-none" />
                <input
                  {...register("password", { onChange: () => setLoginError(null) })}
                  type={showPassword ? "text" : "password"}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-accent cursor-pointer transition-colors"
                  tabIndex={-1}
                >
                  <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-[16px]`} />
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger mt-1.5 font-medium">{errors.password.message}</p>}
            </div>

            {loginError && (
              <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 text-center font-medium">
                <i className="ti ti-alert-circle mr-1.5" />
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-2xl font-bold text-[15px] hover:from-indigo-700 hover:to-indigo-800 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 cursor-pointer shadow-lift hover:shadow-card-lg mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <i className="ti ti-arrow-right text-[16px]" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted/60 mt-5 font-medium">
          Secured by LogiTask · Field Operations Platform
        </p>
      </div>
    </div>
  );
}
