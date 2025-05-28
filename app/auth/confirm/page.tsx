import { Suspense } from "react";
import ConfirmEmail from "./ConfirmEmail";

export const dynamic = "force-dynamic"; // Prevents static generation

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmEmail />
    </Suspense>
  );
}
