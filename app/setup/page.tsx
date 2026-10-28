import { Suspense } from "react";
import { SetupFlow } from "@/components/onboarding/setup-flow";

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted">Loading setup...</div>}>
      <SetupFlow />
    </Suspense>
  );
}
