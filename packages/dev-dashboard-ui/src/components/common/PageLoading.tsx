import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function PageLoading() {
  return (
    <Card role="status" aria-label="Loading page">
      <CardContent className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
}
