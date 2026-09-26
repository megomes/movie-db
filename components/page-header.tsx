export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[24px] font-semibold leading-tight">{title}</h1>
        {right}
      </div>
      {subtitle && <p className="mt-1 text-sm text-text-2">{subtitle}</p>}
    </header>
  );
}
