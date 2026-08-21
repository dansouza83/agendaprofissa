import { SafeLink as Link } from "./safe-link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function Breadcrumbs({ items, className = "" }: { items: BreadcrumbItem[]; className?: string }) {
  return <nav aria-label="Trilha de navegação" className={`breadcrumbs ${className}`}>
    <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold sm:text-sm">
      {items.map((item, index) => {
        const current = index === items.length - 1;
        return <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
          {index > 0 && <span aria-hidden="true" className="breadcrumb-separator text-[#92a09b]">›</span>}
          {current
            ? <span aria-current="page" className="max-w-[min(68vw,28rem)] truncate text-[#52645e]">{item.label}</span>
            : item.href
              ? <Link href={item.href} className="rounded-md text-[#2f7d70] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7d70]">{item.label}</Link>
              : <button type="button" onClick={item.onClick} className="rounded-md text-[#2f7d70] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7d70]">{item.label}</button>}
        </li>;
      })}
    </ol>
  </nav>;
}
