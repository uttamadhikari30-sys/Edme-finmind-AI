"use client";

import { createContext, useContext } from "react";

type OrgContext = {
  orgId: string;
  orgName: string;
  role: string;
  userName: string;
};

const Ctx = createContext<OrgContext | null>(null);

export function OrgProvider({ value, children }: { value: OrgContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrg() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrg must be used inside OrgProvider");
  return v;
}
