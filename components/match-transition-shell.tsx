"use client";

import type { ReactNode } from "react";

type MatchTransitionShellProps = {
  children: ReactNode;
};

export function MatchTransitionShell({ children }: MatchTransitionShellProps) {
  return <div className="match-transition-enter">{children}</div>;
}
