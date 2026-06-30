import Link from "next/link";
import { Toaster } from "@upstart13-com/aiden-ui";
import { brand } from "@/config/brand";
import { authValueProps } from "@/config/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel — brand */}
      <div className="bg-foreground text-background relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="bg-dot-grid bg-dot-grid-inverted pointer-events-none absolute inset-0" />

        <Link href="/" className="relative z-10 flex items-baseline gap-1.5">
          <span className="text-sm font-bold tracking-tight">{brand.name}</span>
          <span className="font-mono text-xs tracking-widest opacity-60">
            {brand.tag ?? "[AI]"}
          </span>
        </Link>

        <div className="relative z-10 space-y-10">
          <div className="space-y-2">
            {/* TODO: replace with your product's marketing headline */}
            <p className="font-mono text-xs tracking-widest uppercase opacity-40">
              [Welcome]
            </p>
            <h2 className="text-3xl leading-tight font-bold tracking-tight">
              {brand.tagline ?? "A one-line pitch for your product."}
            </h2>
          </div>

          <ul className="space-y-6">
            {authValueProps.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <div className="border-background/20 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm border">
                  <Icon className="size-4 opacity-70" strokeWidth={1.5} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm leading-relaxed opacity-50">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* TODO: replace with a footer tagline or remove */}
        <p className="relative z-10 font-mono text-xs opacity-30">
          {brand.tagline ?? brand.name}
        </p>
      </div>

      {/* Right panel — form */}
      <div className="bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold tracking-tight">
                {brand.name}
              </span>
              <span className="text-accent font-mono text-xs tracking-widest">
                {brand.tag ?? "[AI]"}
              </span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
    <Toaster richColors />
    </>
  );
}
