type Props = {
  message?: string;
};

export function BrandSplash({ message = "Загрузка..." }: Props) {
  return (
    <div className="brand-splash" role="status" aria-live="polite" aria-busy="true">
      <div className="brand-splash-logo-wrap">
        <div className="brand-splash-glow" aria-hidden />
        <img src="/brand-logo.svg" alt="" className="brand-splash-logo" draggable={false} width={120} height={125} />
      </div>
      <p className="brand-splash-text">{message}</p>
      <div className="brand-splash-progress-track" aria-hidden>
        <div className="brand-splash-progress-bar" />
      </div>
    </div>
  );
}
