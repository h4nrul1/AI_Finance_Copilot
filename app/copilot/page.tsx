import { Suspense } from "react";
import { CopilotClient } from "@/components/copilot/copilot-client";

export default function CopilotPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl text-sm text-muted">Loading copilot...</div>}>
      <CopilotClient />
    </Suspense>
  );
}
