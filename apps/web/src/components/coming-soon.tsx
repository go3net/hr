import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ module, blurb }: { module: string; blurb: string }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">{module}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
            <Sparkles className="size-5 text-primary" strokeWidth={1.75} />
          </span>
          <div className="max-w-md">
            <p className="text-[15px] font-semibold">{module} is on the way</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{blurb}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
