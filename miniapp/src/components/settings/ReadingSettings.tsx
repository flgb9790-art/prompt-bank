import { useState } from "react";
import { Type } from "lucide-react";
import { readReadingSize, saveReadingSize, type ReadingSize } from "../../utils/readingPreferences";

export function ReadingSettings() {
  const [size, setSize] = useState(readReadingSize);
  return <section className="settings-card settings-card--full reading-settings">
    <h2 className="settings-card-title"><Type size={18} aria-hidden /> Чтение промптов</h2>
    <p className="settings-help">Размер текста в открытом промпте. Настройка сохраняется на этом устройстве и доступна без входа.</p>
    <div className="reading-size-options" role="group" aria-label="Размер текста промпта">
      {([['compact', 'Компактный'], ['default', 'Обычный'], ['large', 'Крупный']] as Array<[ReadingSize, string]>).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={size === value} onClick={() => { setSize(value); saveReadingSize(value); }}>{label}</button>)}
    </div>
    <p className="reading-size-preview">Хорошая идея начинается с понятного промпта.</p>
  </section>;
}
