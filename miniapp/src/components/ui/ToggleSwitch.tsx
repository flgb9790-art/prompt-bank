type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function ToggleSwitch({ checked, onChange, label, description, disabled = false }: Props) {
  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-copy">
        <p className="settings-toggle-label">{label}</p>
        {description ? <p className="settings-toggle-description">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`settings-switch ${checked ? "active" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-switch-thumb" />
      </button>
    </div>
  );
}
