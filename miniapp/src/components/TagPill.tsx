type Props = {
  name: string;
  onClick?: (name: string) => void;
  active?: boolean;
  variant?: "default" | "accent";
};

export function TagPill({ name, onClick, active = false, variant = "default" }: Props) {
  const className = [
    "tag-pill",
    variant === "accent" ? "tag-pill-accent" : "",
    onClick ? "tag-pill-btn" : "",
    active ? "tag-pill-btn-active" : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onClick(name);
        }}
      >
        {name}
      </button>
    );
  }

  return <span className={className}>{name}</span>;
}
