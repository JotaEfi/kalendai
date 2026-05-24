import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Calendar as CalendarIcon, LayoutDashboard, FileText, User, LogOut, Settings, PanelLeftClose, PanelLeft, Check, Moon, Sun, Shield, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Inbox from './Inbox';

export default function Layout() {
  const location = useLocation();
  const { user, logout, login } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingCards, setPendingCards] = useState<any[]>([]);
  
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('@KalendAI:darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
    localStorage.setItem('@KalendAI:darkMode', darkMode.toString());
  }, [darkMode]);

  // For Profile Edit
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth > 400) newWidth = 400;
      if (newWidth < 80) newWidth = 80;
      setSidebarWidth(newWidth);
      if (newWidth > 120 && !sidebarOpen) {
          setSidebarOpen(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
       if (isResizing) {
           setIsResizing(false);
           if (e.clientX < 150) {
               setSidebarOpen(false);
               setSidebarWidth(256); // reset for when it opens again
           }
       }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarOpen]);

  useEffect(() => {
     // Fetch pending cards globally for Quick View
     const fetchPendingCards = async () => {
        try {
           const res = await api.get('/kanban/pending');
           setPendingCards(res.data);
        } catch (err) {
           console.error("Error fetching pending cards", err);
        }
     };

     // Fetch notifications count
     const fetchNotificationsCount = async () => {
        try {
           const res = await api.get('/notifications');
           const unreadPending = res.data.filter((n: any) => !n.read || n.status === 'PENDING').length;
           setUnreadNotificationsCount(unreadPending);
        } catch (err) {
           console.error("Error fetching notifications count", err);
        }
     };

     if (user) {
         fetchPendingCards();
         fetchNotificationsCount();
         window.addEventListener('tasksUpdated', fetchPendingCards);
         window.addEventListener('tasksUpdated', fetchNotificationsCount);
     }
     
     return () => {
         window.removeEventListener('tasksUpdated', fetchPendingCards);
         window.removeEventListener('tasksUpdated', fetchNotificationsCount);
     };
  }, [user, location.pathname]); // simplistic polling when changing pages

  const calculatePendingDays = (card: any) => {
    const start = new Date(card.originalDayDate || card.createdAt);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(now.getTime() - start.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDurationSide = (card: any) => {
    if (!card.completedAt) return '';
    const start = new Date(card.originalDayDate ? card.originalDayDate : card.createdAt);
    start.setHours(12,0,0,0); // Assume it started mid-day of origin if no exact
    const end = new Date(card.completedAt);
    let diff = end.getTime() - start.getTime();
    if (diff < 0) diff = 0;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}m`;
  };

  const pendingToday = pendingCards.filter(c => calculatePendingDays(c) === 0);
  const pendingOverdue = pendingCards.filter(c => calculatePendingDays(c) > 0).sort((a,b) => calculatePendingDays(b) - calculatePendingDays(a));

  const navItems = [
    { name: 'Agenda', path: '/calendar', icon: CalendarIcon },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ...(user?.role === 'ADMIN' ? [{ name: 'Painel Admin', path: '/admin', icon: Shield }] : []),
  ];

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put(`/auth/profile`, { name: editName, email: editEmail });
      // Update local storage so reload catches the new user data
      localStorage.setItem('@KalendAI:user', JSON.stringify(res.data));
      alert('Perfil atualizado com sucesso!');
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar perfil.');
    }
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-[#F4F5F7] text-[#172B4D] font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* SIDEBAR */}
      <aside 
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : '80px' }}
        className={`bg-white border-r border-[#DFE1E6] flex flex-col relative shrink-0 z-30 overflow-hidden ${isResizing ? '' : 'transition-[width] duration-300'}`}
      >
        <div className={`p-6 flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} gap-3 shrink-0`}>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <div className="w-10 h-10 bg-[#0079bf] rounded-xl flex shrink-0 items-center justify-center text-white shadow-sm border border-[#0079bf]/20">
              <CalendarIcon size={24} />
            </div>
            {sidebarOpen && <span className="font-bold text-xl tracking-tight leading-none text-gray-800">Kalend<span className="text-[#0079bf]">AI</span></span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col">
          <nav className="px-4 py-2 space-y-1 shrink-0">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center ${sidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-lg cursor-pointer transition-colors ${
                  location.pathname.startsWith(item.path) ? 'bg-[#0079bf] text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={item.name}
              >
                <item.icon size={20} className="shrink-0" />
                {sidebarOpen && <span className="font-medium whitespace-nowrap">{item.name}</span>}
              </Link>
            ))}
          </nav>

          {/* VISÃO RÁPIDA */}
          <div className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100 p-4' : 'opacity-0 h-0 p-0 overflow-hidden'} bg-gray-50 border-t border-[#DFE1E6] flex flex-col gap-4 shrink-0`}>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest sticky top-0 bg-gray-50 backdrop-blur-sm z-10 py-1">Visão Rápida</h4>
          
          <div>
            <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Hoje</h5>
            <div className="space-y-2">
              {pendingToday.length === 0 && <p className="text-xs text-gray-400 italic">Sem tarefas hoje.</p>}
              {pendingToday.map(card => (
                 <div key={`side-${card.id}`} className="bg-white rounded p-2 text-gray-800 shadow-sm border border-gray-200 border-l-4 relative overflow-hidden flex flex-col gap-1 hover:border-gray-300 transition-colors cursor-default" style={{borderLeftColor: card.color}}>
                   <p className="text-xs font-medium truncate w-full" title={card.title}>{card.title}</p>
                   <div className="flex flex-col gap-0.5 text-[9px] text-gray-500 bg-gray-50 rounded p-1">
                     <span>Criado: {new Date(card.createdAt).toLocaleDateString('pt-BR')}</span>
                     {card.status === 'DONE' && card.completedAt && (
                       <>
                         <span className="text-green-600">Concluído: {new Date(card.completedAt).toLocaleDateString('pt-BR')}</span>
                         <span className="text-indigo-600">Tempo: {formatDurationSide(card)}</span>
                       </>
                     )}
                   </div>
                 </div>
              ))}
            </div>
          </div>

          <div>
             <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">No Caminho</h5>
             <div className="space-y-2">
              {pendingOverdue.length === 0 && <p className="text-xs text-gray-400 italic">Tudo em dia.</p>}
              {pendingOverdue.map(card => (
                 <div key={`side-overdue-${card.id}`} className="bg-white rounded p-2 text-gray-800 shadow-sm border border-red-200 border-l-4 relative overflow-hidden flex flex-col gap-1 hover:border-red-300 cursor-default" style={{borderLeftColor: card.color}}>
                   <div className="flex justify-between items-center gap-1 w-full">
                     <p className="text-xs font-medium truncate flex-1" title={card.title}>{card.title}</p>
                     <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-1 min-w-[max-content]">{calculatePendingDays(card)}d</span>
                   </div>
                   <div className="flex flex-col gap-0.5 text-[9px] text-gray-500 bg-gray-50 rounded p-1">
                     <span>Criado: {new Date(card.createdAt).toLocaleDateString('pt-BR')}</span>
                   </div>
                 </div>
              ))}
            </div>
          </div>
        </div>
        </div>

        <div className={`p-4 text-center border-t border-[#DFE1E6] flex flex-col gap-2 items-center relative shrink-0`}>
           <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#0079bf] transition-colors flex w-full ${sidebarOpen ? 'justify-start gap-3' : 'justify-center'} items-center`}>
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
              {sidebarOpen && <span className="text-sm font-medium">Recolher Menu</span>}
           </button>
        </div>

        {/* DRAG HANDLE */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#0079bf]/20 transition-colors z-50 flex items-center justify-center opacity-0 hover:opacity-100"
          onMouseDown={(e) => {
             e.preventDefault();
             setIsResizing(true);
          }}
        >
          <div className="h-8 w-1 bg-[#DFE1E6] rounded-full" />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-[#DFE1E6] flex items-center justify-between px-8 shadow-sm z-20 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold">
              {location.pathname.includes('calendar') ? 'Agenda Kanban' : location.pathname.includes('admin') ? 'Painel Administrativo' : 'Dashboard Resumo'}
            </h2>
          </div>
          <div className="flex items-center gap-4 relative">
            
            {/* INBOX BUTTON */}
            <button 
              onClick={() => setInboxOpen(!inboxOpen)}
              className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-[#0079bf] hover:bg-gray-100/50 flex items-center justify-center relative cursor-pointer transition-all shadow-sm shrink-0"
              title="Caixa de Entrada"
            >
              <Bell size={18} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <span className="font-bold text-gray-700 text-sm hidden sm:block">{user?.name}</span>
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full bg-indigo-500 border-2 hover:border-indigo-200 border-white shadow-sm flex items-center justify-center text-white font-bold cursor-pointer transition-colors relative z-50 shrink-0"
            >
              <User size={20} />
            </button>

            {/* PROFILE MENU DROPDOWN */}
            {showProfileMenu && (
              <div className="absolute right-0 top-12 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 flex flex-col overflow-hidden z-50">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col gap-1">
                  <span className="font-bold text-gray-800 text-sm">{user?.name}</span>
                  <span className="text-xs text-gray-500 truncate">{user?.email}</span>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase mt-1 tracking-wider">{user?.role}</span>
                </div>
                <div className="p-2 flex flex-col">
                  {isEditingProfile ? (
                    <form onSubmit={handleUpdateProfile} className="p-2 flex flex-col gap-3">
                       <div>
                         <label className="text-[10px] font-bold text-gray-500 uppercase">Nome</label>
                         <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full text-sm border rounded p-1.5 focus:outline-none focus:border-indigo-500" required />
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-gray-500 uppercase">Email</label>
                         <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full text-sm border rounded p-1.5 focus:outline-none focus:border-indigo-500" required />
                       </div>
                       <div className="flex gap-2">
                         <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 px-2 py-1.5 text-xs font-bold text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors">Cancelar</button>
                         <button type="submit" className="flex-1 px-2 py-1.5 text-xs font-bold text-white bg-indigo-500 rounded hover:bg-indigo-600 transition-colors flex items-center justify-center gap-1"><Check size={14}/> Salvar</button>
                       </div>
                    </form>
                  ) : (
                    <>
                      <button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors text-left">
                        <Settings size={16} className="text-gray-400" /> Editar Perfil
                      </button>
                      <button onClick={() => setDarkMode(!darkMode)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors text-left mt-1">
                        {darkMode ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-indigo-400" />} 
                        {darkMode ? 'Modo Claro' : 'Modo Escuro'}
                      </button>
                      <button onClick={logout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors text-left mt-1">
                        <LogOut size={16} className="text-red-400" /> Sair da Conta
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Backdrop for closing menu */}
            {showProfileMenu && (
              <div className="fixed inset-0 z-40" onClick={() => {setShowProfileMenu(false); setIsEditingProfile(false);}}></div>
            )}

          </div>
        </header>
        
        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto bg-gray-50/50">
          <Outlet />
        </div>
      </main>

      {/* INBOX PANEL */}
      {inboxOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setInboxOpen(false)}></div>
          <Inbox onClose={() => setInboxOpen(false)} onNotificationsCountChange={setUnreadNotificationsCount} />
        </>
      )}
    </div>
  );
}
