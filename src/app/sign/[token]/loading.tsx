import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>

      {/* Document preview area */}
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Skeleton className="w-full h-[50vh] rounded-xl" />

        {/* Signature box */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="w-full h-40 rounded-lg border-2 border-dashed" />
          <div className="flex justify-end">
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
        </div>

        <Skeleton className="h-3 w-96 mx-auto" />
      </div>
    </div>
  );
}
