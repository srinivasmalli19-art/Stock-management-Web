const variants = {
  primary: "bg-accent text-white border-accent hover:bg-blue-700",
  success: "bg-success text-white border-success hover:bg-green-700",
  danger: "bg-danger text-white border-danger hover:bg-red-700",
  warn: "bg-warn text-white border-warn hover:bg-amber-700",
  purple: "bg-purple-600 text-white border-purple-600 hover:bg-purple-700",
  default: "bg-white text-text border-border2 hover:bg-bg",
  ghost: "bg-transparent border-transparent text-muted hover:bg-bg hover:text-text",
};

const sizes = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export default function Button({
  variant = "default",
  size = "md",
  children,
  className = "",
  disabled,
  onClick,
  type = "button",
  fullWidth = false,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 rounded border font-medium transition-all duration-150 cursor-pointer
        disabled:opacity-45 disabled:cursor-not-allowed
        ${variants[variant] || variants.default}
        ${sizes[size]}
        ${fullWidth ? "w-full justify-center" : ""}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
