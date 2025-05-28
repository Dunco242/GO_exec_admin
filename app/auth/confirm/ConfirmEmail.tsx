// /app/auth/confirm/page.tsx
import { Suspense } from "react";
import ConfirmEmail from "./ConfirmEmail";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmEmail />
    </Suspense>
  );
}
