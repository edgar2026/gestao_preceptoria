import React from "react";
import logoHorizontal from "../assets/branding/logo-horizontal-clara.png";
import logoAdmin from "../assets/branding/logo-horizontal-clara-admin.png";

export default function Logo({ variant = "completa", className = "" }) {
  const cls = variant === "compacta"
    ? `logo-img logo-compacta ${className}`
    : `logo-img logo-completa ${className}`;
  return (
    <img
      src={variant === "compacta" ? logoHorizontal : logoAdmin}
      alt="Medicina UNINASSAU"
      className={cls}
      draggable={false}
    />
  );
}
