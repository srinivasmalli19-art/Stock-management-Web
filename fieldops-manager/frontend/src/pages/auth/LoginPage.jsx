import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { inputClass } from "../../components/common/FormField";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
      <div className="bg-white rounded-xl p-8 sm:p-10 w-full max-w-[380px] mx-4 shadow-2xl">
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-accent2 rounded-[14px] flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-bolt text-accent text-3xl" />
          </div>
          <h1 className="text-[22px] font-bold text-[#1e293b]">FieldOps Manager</h1>
          <p className="text-[13px] text-slate-500 mt-1">Consumer Durables Installation Suite</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Email Address
            </label>
            <input
              {...register("email", { onChange: () => setLoginError(null) })}
              type="email"
              className={inputClass}
              placeholder="your.name@company.com"
              autoComplete="email"
            />
            {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Password
            </label>
            <div className="relative">
              <input
                {...register("password", { onChange: () => setLoginError(null) })}
                type={showPassword ? "text" : "password"}
                className={`${inputClass} pr-10`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer"
              >
                <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} />
              </button>
            </div>
            {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white py-2.5 rounded font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <i className="ti ti-login" />
            )}
            Sign In
          </button>

          {loginError && (
            <div className="mt-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700 text-center">
              {loginError}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
