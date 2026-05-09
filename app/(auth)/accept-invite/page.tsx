import { Suspense } from "react";
import AcceptInviteClient from "./accept-invite-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-ink-muted">Loading invite…</div>}>
      <AcceptInviteClient />
    </Suspense>
  );
}
