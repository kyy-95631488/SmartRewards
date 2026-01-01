"use client";

import { LogOut, LayoutDashboard, Users, Medal, Gift, FileText, ChevronRight, X } from "lucide-react";
import { TabType } from "../panel/types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: TabType) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  handleLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen, handleLogout }: SidebarProps) {
  return (
    <aside 
      className={`bg-white border-r border-slate-200 flex flex-col fixed h-full z-[50] transition-all duration-300 ease-in-out
          ${isSidebarOpen 
              ? "translate-x-0 w-[280px]" 
              : "-translate-x-full lg:translate-x-0 lg:w-20"
          }
      `}
    >
      <div className="h-20 flex items-center justify-center border-b border-slate-100 px-4 relative">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200 shrink-0">
          P
        </div>
        <span className={`ml-3 font-bold text-lg text-slate-700 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 lg:hidden"}`}>
          Panel Admin
        </span>
        
        <button 
           onClick={() => setIsSidebarOpen(false)}
           className="lg:hidden absolute right-4 text-slate-400 hover:text-slate-600 p-2"
        >
            <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <SidebarItem 
          active={activeTab === "dashboard"} 
          onClick={() => { setActiveTab("dashboard"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          icon={<LayoutDashboard size={20} />} 
          label="Dashboard" 
          expanded={isSidebarOpen}
        />
        <SidebarItem 
          active={activeTab === "doorprize"} 
          onClick={() => { setActiveTab("doorprize"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          icon={<Users size={20} />} 
          label="Doorprize Peserta" 
          expanded={isSidebarOpen}
        />
        <SidebarItem 
          active={activeTab === "award-nominees"} 
          onClick={() => { setActiveTab("award-nominees"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          icon={<Users size={20} />} 
          label="Award Nominees" 
          expanded={isSidebarOpen}
        />
        <SidebarItem 
          active={activeTab === "awards"} 
          onClick={() => { setActiveTab("awards"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          icon={<Medal size={20} />} 
          label="Awards" 
          expanded={isSidebarOpen}
        />
        <SidebarItem 
          active={activeTab === "prizes"} 
          onClick={() => { setActiveTab("prizes"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          icon={<Gift size={20} />} 
          label="Stok Doorprize" 
          expanded={isSidebarOpen}
        />
        
        <div className="pt-4 mt-4 border-t border-slate-100">
            <SidebarItem 
              active={activeTab === "recap"} 
              onClick={() => { setActiveTab("recap"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              icon={<FileText size={20} />} 
              label="Rekap & Download" 
              expanded={isSidebarOpen}
            />
        </div>
      </nav>

      <div className="p-4 border-t border-slate-100 pb-8 lg:pb-4">
        <button 
          onClick={handleLogout}
          className={`w-full flex items-center ${isSidebarOpen ? "justify-start px-4" : "justify-center px-0"} gap-3 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium`}
          title="Logout"
        >
          <LogOut size={20} />
          <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 lg:hidden"}`}>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ active, onClick, icon, label, expanded }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, expanded: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center ${expanded ? "justify-start px-4" : "lg:justify-center lg:px-0 justify-start px-4"} gap-3 py-3 rounded-xl transition-all duration-200 group relative ${
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
          : "text-slate-500 hover:bg-white hover:text-blue-600"
      }`}
      title={(!expanded && typeof window !== "undefined" && window.innerWidth >= 1024) ? label : ""}
    >
      <span className={`${active ? "text-white" : "text-slate-400 group-hover:text-blue-600"} shrink-0`}>{icon}</span>
      <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 
          ${expanded ? "opacity-100 w-auto" : "lg:opacity-0 lg:w-0 opacity-100 w-auto"}
        `}>{label}</span>
      
      {active && expanded && <ChevronRight size={16} className="ml-auto opacity-50 shrink-0" />}
      
      {!expanded && (
        <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            {label}
        </div>
      )}
    </button>
  );
}