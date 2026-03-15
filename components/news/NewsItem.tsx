import { Badge } from "@/components/ui/badge";
import type { NewsItem as NewsItemType } from "@/types/news";

const sourceColors: Record<string, string> = {
  PMDA: "bg-purple-100 text-purple-800 border-purple-200",
};

export function NewsItemCard({ item }: { item: NewsItemType }) {
  const date = item.published_at.slice(0, 10);

  return (
    <div className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50">
      <Badge variant="outline" className={sourceColors[item.source] || ""}>
        {item.source}
      </Badge>
      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:text-primary hover:underline"
        >
          {item.title}
        </a>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{date}</span>
    </div>
  );
}
