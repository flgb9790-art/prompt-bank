type Props = {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  className?: string;
  onClick?: () => void;
};

export function BrandLogo({ size = 40, showText = true, textClassName, className = "", onClick }: Props) {
  const height = Math.round(size * 1.04);
  const content = (
    <>
      <img
        src="/brand-logo.svg"
        alt=""
        className="brand-logo-image"
        width={size}
        height={height}
        draggable={false}
      />
      {showText ? <span className={textClassName ?? "brand-logo-text"}>Prompt Bank</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`brand-logo ${className}`.trim()}>
        {content}
      </button>
    );
  }

  return <div className={`brand-logo ${className}`.trim()}>{content}</div>;
}
