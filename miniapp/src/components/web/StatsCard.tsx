import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  value: number;
  iconBg: string;
};

export function StatsCard({ icon, label, value, iconBg }: Props) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconBg}`}>{icon}</div>
      <div>
        <p className="stat-value">{value}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  );
}
