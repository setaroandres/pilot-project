import { redirect } from "next/navigation";
import { PageHeader } from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogTable } from "@/components/catalog/catalog-table";

export const metadata = { title: "Catalog | AI Data Explorer" };

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/catalog");

  const entries = await prisma.catalogEntry.findMany({
    orderBy: [{ tableName: "asc" }, { columnName: "asc" }],
    select: {
      id:            true,
      domain:        true,
      tableName:     true,
      columnName:    true,
      businessLabel: true,
      definition:    true,
      caveats:       true,
      isOverride:    true,
    },
  });

  const domains = [...new Set(entries.map((e) => e.domain))].sort();

  return (
    <div>
      <PageHeader
        title="Data Catalog"
        subtitle="Definitions and lineage for every column exposed to the AI query engine."
      />
      <div className="px-6 py-8">
        <CatalogTable entries={entries} domains={domains} />
      </div>
    </div>
  );
}
