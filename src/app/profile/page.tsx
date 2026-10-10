import { Suspense } from "react";
import { CareerProfileForm } from "@/components/profile/CareerProfileForm";

export default function ProfilePage() {
  return (
    <Suspense>
      <CareerProfileForm />
    </Suspense>
  );
}
