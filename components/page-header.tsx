export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="px-4 pb-6 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-6 lg:px-10 lg:pt-28">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">{title}</h1>
        {right}
      </div>
      {subtitle && <p className="mt-2 text-[15px] text-text-2">{subtitle}</p>}
    </header>
  );
}
