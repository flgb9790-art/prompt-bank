import { useEffect, useState } from "react";
import { api, type PinterestStatus } from "../../api";

export function PinterestSettings() {
  const [status, setStatus] = useState<PinterestStatus>();
  const [boards, setBoards] = useState<Array<{id: string; name: string}>>([]);
  const [bookmark, setBookmark] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const next = await api.pinterestStatus(); setStatus(next);
    if (next.connected) {
      const result = await api.pinterestBoards(); setBoards(result.items); setBookmark(result.bookmark);
    }
  }
  useEffect(() => { void load().catch(error => setMessage(error.message)); }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось выполнить действие"); }
    finally { setBusy(false); }
  }
  return <section className="settings-card settings-card--full reading-settings">
    <h2 className="settings-card-title">Публикация в Pinterest</h2>
    <p className="settings-help">Общий аккаунт публикации Prompt Bank. Настройки доступны только администраторам. Каждый пин создаётся после отдельного подтверждения.</p>
    <p className="settings-help" role="status">{!status ? "Проверяем подключение…" : status.connected ? "Pinterest подключён" : status.legacyConfigured ? "Работает прежнее подключение сервера. Подключите аккаунт через Pinterest для демонстрации." : "Pinterest не подключён"}</p>
    {status?.needsReconnect && <p className="settings-help">Срок доступа истёк. Подключите аккаунт заново.</p>}
    {status?.connected && <>
      <label className="settings-help" htmlFor="pinterest-board">Доска назначения</label>
      <select id="pinterest-board" className="form-select mt-3 w-full" value={status.boardId || ""} disabled={busy}
        onChange={event => void run(async () => { setStatus(await api.selectPinterestBoard(event.target.value)); setMessage("Доска сохранена"); })}>
        <option value="" disabled>Выберите доску</option>
        {status.boardId && !boards.some(board => board.id === status.boardId) && <option value={status.boardId}>{status.boardName}</option>}
        {boards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
      </select>
      {!boards.length && <p className="settings-help">Если досок нет, создайте доску в Pinterest и обновите список.</p>}
      <button className="btn-secondary mt-3" disabled={busy} onClick={() => void run(load)}>Обновить доски</button>
      {bookmark && <button className="btn-secondary mt-3" disabled={busy} onClick={() => void run(async () => {
        const result = await api.pinterestBoards(bookmark); setBoards(previous => [...previous, ...result.items]); setBookmark(result.bookmark);
      })}>Загрузить ещё доски</button>}
    </>}
    <div className="mt-4 flex flex-wrap gap-2">
      {!status?.connected && <button className="btn-secondary" disabled={busy} onClick={() => void run(load)}>Проверить подключение</button>}
      <button className="btn-primary" disabled={busy || !status?.configured} onClick={() => void run(async () => {
        const {url} = await api.connectPinterest(); window.location.assign(url);
      })}>{status?.connected ? "Подключить заново" : "Подключить Pinterest"}</button>
      {(status?.connected || status?.legacyConfigured) && <button className="btn-secondary" disabled={busy} onClick={() => {
        if (!window.confirm("Отключить Pinterest от Prompt Bank? Сохранённые токены будут удалены, опубликованные пины останутся.")) return;
        void run(async () => { setStatus(await api.disconnectPinterest()); setBoards([]); setBookmark(null); setMessage("Pinterest отключён. При необходимости отзовите доступ также в настройках Pinterest."); });
      }}>Отключить</button>}
    </div>
    {status && !status.configured && <p className="settings-help">Администратору сервера нужно завершить настройку подключения Pinterest.</p>}
    {message && <p className="settings-help" role="status">{message}</p>}
  </section>;
}
