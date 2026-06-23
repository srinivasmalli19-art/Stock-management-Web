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
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[400px] fade-up">
        <div className="bg-white rounded-2xl shadow-card-lg px-8 py-10">

          {/* Logo + branding */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
              <i className="ti ti-tool text-white text-3xl" />
            </div>
            <h1 className="text-2xl font-bold text-text tracking-tight">LogiTask</h1>
            <p className="text-[13px] text-muted mt-1">We deliver the best.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label className="label">Email Address</label>
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
              {errors.email && <p className="text-xs text-danger mt-1.5">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer transition-colors"
                  tabIndex={-1}
                >
                  <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-[16px]`} />
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger mt-1.5">{errors.password.message}</p>}
            </div>

            {loginError && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-semibold text-[15px] hover:bg-indigo-800 active:bg-indigo-900 transition-all duration-200 disabled:opacity-60 cursor-pointer shadow-md hover:shadow-lg mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <i className="ti ti-arrow-right text-[16px]" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
