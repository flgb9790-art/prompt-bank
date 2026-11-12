import { Bookmark, Copy, Grid2X2, Plus, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "../BrandLogo";
type RouteKey = "/" | "/prompts" | "/favorites" | "/recent" | "/tags" | "/categories" | "/settings" | "/copied" | "/viewed";
type Props = {currentPath: RouteKey; search: string; onSearchChange: (value:string)=>void; onNavigate:(path:RouteKey)=>void; canCreate?:boolean; onCreatePrompt:()=>void; headerRight:ReactNode; children:ReactNode};
const tabs = [
  {path:"/",label:"Библиотека",icon:Grid2X2}, {path:"/favorites",label:"Избранное",icon:Bookmark},
  {path:"/copied",label:"Скопированное",icon:Copy}, {path:"/settings",label:"Настройки",icon:Settings2}
] as const;
export function MobileWebShell({currentPath,onNavigate,canCreate,onCreatePrompt,headerRight,children}:Props) {
  return <div className="mobile-web-shell studio-mobile">
    <header className="mobile-web-header"><BrandLogo size={28} onClick={()=>onNavigate("/")}/><div className="studio-header-actions">{canCreate && <button className="studio-icon" aria-label="Добавить промпт" onClick={onCreatePrompt}><Plus size={19}/></button>}{headerRight}</div></header>
    <main className="prompt-scroll-root studio-mobile-main">{children}</main>
    <nav className="bottom-nav" aria-label="Основная навигация"><div className="bottom-nav-inner">{tabs.map(({path,label,icon:Icon})=><button key={path} type="button" aria-current={currentPath===path?"page":undefined} className={`bottom-nav-item ${currentPath===path?"active":""}`} onClick={()=>onNavigate(path)}><Icon size={20} strokeWidth={1.6}/>{label}</button>)}</div></nav>
  </div>;
}
