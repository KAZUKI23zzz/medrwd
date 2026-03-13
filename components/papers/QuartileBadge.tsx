import { Badge } from "@/components/ui/badge";

const quartileColors: Record<string, string> = {
  Q1: "bg-green-100 text-green-800 border-green-200",
  Q2: "bg-blue-100 text-blue-800 border-blue-200",
  Q3: "bg-orange-100 text-orange-800 border-orange-200",
  Q4: "bg-red-100 text-red-800 border-red-200",
};

export function QuartileBadge({ quartile }: { quartile: string }) {
  return (
    <Badge variant="outline" className={quartileColors[quartile] || ""}>
      {quartile}
    </Badge>
  );
}
