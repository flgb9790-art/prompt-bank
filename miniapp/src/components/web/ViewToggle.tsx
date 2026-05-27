import { ViewModeSwitcher } from "./ViewModeSwitcher";
import type { ViewMode } from "../../utils/viewMode";

type Props = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
};

/** @deprecated Use ViewModeSwitcher */
export function ViewToggle({ value, onChange, className }: Props) {
  return <ViewModeSwitcher value={value} onChange={onChange} className={className} />;
}

export { ViewModeSwitcher };
