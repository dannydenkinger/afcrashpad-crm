import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header bar */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-5 w-48" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      {/* Main content: signer panel + PDF editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Signer panel sidebar */}
        <div className="w-64 border-r p-4 space-y-4 hidden md:block">
          <Skeleton className="h-5 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-8 w-full rounded" />
          <div className="pt-4 space-y-2">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded" />
            ))}
          </div>
        </div>

        {/* PDF preview area */}
        <div className="flex-1 p-6 flex items-center justify-center bg-gray-50">
          <Skeleton className="w-full max-w-3xl h-[70vh] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
