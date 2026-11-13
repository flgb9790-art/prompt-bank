import { Bookmark, Copy, Plus, Search, Settings2, Sparkles } from "lucide-react";
import { BrandLogo } from "../BrandLogo";
type Route = "/" | "/favorites" | "/copied" | "/settings" | "/studio";
type Props = { currentPath: string; onNavigate: (path: Route) => void; isAuthenticated?: boolean; canCreate?: boolean; onCreatePrompt: () => void; onLoginTelegram: () => void; onFocusSearch: () => void };
export function Topbar({currentPath,onNavigate,isAuthenticated,canCreate,onCreatePrompt,onLoginTelegram,onFocusSearch}: Props) {
  return <div className="studio-topbar">
    <BrandLogo size={30} onClick={()=>onNavigate("/")} />
    <nav className="studio-navigation" aria-label="Основная навигация">
      <button aria-current={currentPath === "/" ? "page" : undefined} onClick={()=>onNavigate("/")}><span className="nav-dot"/>Библиотека</button>
      <button aria-current={currentPath === "/favorites" ? "page" : undefined} onClick={()=>onNavigate("/favorites")}><Bookmark size={16}/>Избранное</button>
      <button aria-current={currentPath === "/copied" ? "page" : undefined} onClick={()=>onNavigate("/copied")}><Copy size={16}/>Скопированное</button>
      {canCreate&&<button aria-current={currentPath === "/studio" ? "page" : undefined} onClick={()=>onNavigate("/studio")}><Sparkles size={16}/>Студия идей</button>}
    </nav>
    <div className="studio-header-actions">
      <button className="studio-icon" title="Поиск · Ctrl/⌘ K" aria-label="Найти промпт" onClick={onFocusSearch}><Search size={18}/></button>
      {canCreate && <button className="btn-primary studio-add" onClick={onCreatePrompt}><Plus size={16}/>Добавить</button>}
      <button className={`studio-icon ${currentPath === "/settings" ? "selected" : ""}`} aria-label="Настройки" onClick={()=>onNavigate("/settings")}><Settings2 size={18}/></button>
      {!isAuthenticated && <button className="btn-secondary" onClick={onLoginTelegram}>Войти</button>}
    </div>
  </div>;
}
