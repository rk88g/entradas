"use client";

import { signOutAction } from "@/app/auth/actions";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="button-soft">
        Cerrar sesión
      </button>
    </form>
  );
}
