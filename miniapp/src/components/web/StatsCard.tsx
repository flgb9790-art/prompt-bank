import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  value: number;
  iconBg: string;
};

export function StatsCard({ icon, label, value, iconBg }: Props) {
  return (
    <div className="glass-card flex min-h-[92px] items-center gap-4 p-5">
      <div className={`grid h-12 w-12 place-items-center rounded-xl ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-[28px] font-bold leading-8">{value}</p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}
