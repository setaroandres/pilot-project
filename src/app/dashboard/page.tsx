import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { dashboardFeatures, dashboardHighlights, overviewPageMetadata } from "@/config/constants";

export const metadata = overviewPageMetadata;

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  return (
    <div>
      <PageHeader
        title="Meridian Health AI Data Explorer"
        subtitle="Natural-language analytics for patient outcomes, operations, and finance."
        action={
          <Button asChild>
            <Link href="/dashboard/query">
              <Sparkles className="mr-2 size-4" strokeWidth={1.5} />
              Start Querying
            </Link>
          </Button>
        }
      />

      <div className="space-y-10 px-6 py-8">
        {/* Feature cards */}
        <div>
          <h2 className="text-foreground mb-4 text-sm font-semibold uppercase tracking-wider">
            Features
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dashboardFeatures.map((f) => (
              <Link key={f.href} href={f.href} className="group block">
                <Card className="h-full rounded-xl transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="bg-primary/10 flex size-9 items-center justify-center rounded-lg">
                        <f.icon className="text-primary size-4" strokeWidth={1.5} />
                      </div>
                      {f.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {f.badge}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-3 text-sm font-semibold">
                      {f.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {f.description}
                    </p>
                    <p className="text-primary mt-3 flex items-center gap-1 text-xs font-medium">
                      Open{" "}
                      <ArrowRight
                        className="size-3 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={1.5}
                      />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div>
          <h2 className="text-foreground mb-4 text-sm font-semibold uppercase tracking-wider">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {dashboardHighlights.map((h) => (
              <Card key={h.title} className="rounded-xl">
                <CardContent className="px-5 py-4">
                  <h.icon className="text-primary mb-3 size-5" strokeWidth={1.5} />
                  <p className="text-foreground mb-1 text-sm font-semibold">{h.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{h.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
