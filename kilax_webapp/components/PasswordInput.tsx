"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
}

/**
 * Password input with a tap-to-reveal eye icon.
 * Matches the dark-card styling used across auth forms.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  disabled = false,
  required = false,
  minLength,
  autoComplete = "current-password",
  className = "",
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative w-full">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`w-full rounded bg-[#22283a] border border-gray-700 px-4 py-3 pr-11 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${className}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(v => !v)}
        disabled={disabled}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors disabled:opacity-40 focus:outline-none"
      >
        {show
          ? <EyeOff className="w-5 h-5" />
          : <Eye    className="w-5 h-5" />}
      </button>
    </div>
  );
}
