"use client";
import { Button } from "@/components/ui/button";
export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <div className="page-width py-12" role="alert">
      <h1 className="text-2xl font-medium">Store management is unavailable</h1>
      <p className="my-4">
        Refresh to verify your access and load current information.
      </p>
      <Button onClick={retry}>Retry store management</Button>
    </div>
  );
}
