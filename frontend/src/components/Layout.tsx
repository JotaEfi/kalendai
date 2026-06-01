import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Calendar as CalendarIcon, LayoutDashboard, FileText, User, LogOut, Settings, PanelLeftClose, PanelLeft, Check, Moon, Sun, Shield, Bell, ListTodo, Activity, Play, Pause, Trash2 } from 'lucide-react';
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

  const [activeQuickTab, setActiveQuickTab] = useState<'tasks' | 'activity' | 'alerts'>('tasks');
  const [todayCards, setTodayCards] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('@KalendAI:darkMode') === 'true';
  });

  const getSaoPauloTodayStr = () => {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(new Date());
    } catch (e) {
      const d = new Date();
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
    }
  };

  const getCardDateStr = (card: any) => {
    const dateVal = card.dayDate || card.createdAt;
    if (!dateVal) return '';
    if (card.dayDate) {
      return card.dayDate.split('T')[0];
    }
    try {
      const parsedDate = new Date(dateVal);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(parsedDate);
    } catch (e) {
      return typeof dateVal === 'string' ? dateVal.split('T')[0] : '';
    }
  };

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
      
      if (newWidth < 160) {
        // Dragging below 160px collapses the sidebar
        setSidebarOpen(false);
      } else {
        // Dragging above 160px expands and resizes the sidebar
        setSidebarOpen(true);
        // Clamp expanded width between 200px and 400px
        const clampedWidth = Math.min(Math.max(newWidth, 200), 400);
        setSidebarWidth(clampedWidth);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isResizing) {
        setIsResizing(false);
        const finalWidth = e.clientX;
        if (finalWidth < 160) {
          setSidebarOpen(false);
          // Keep a healthy default width for the next time they open it
          setSidebarWidth(256);
        } else {
          setSidebarOpen(true);
          const clampedWidth = Math.min(Math.max(finalWidth, 200), 400);
          setSidebarWidth(clampedWidth);
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
  }, [isResizing]);

  const fetchPendingCards = async () => {
    try {
       const res = await api.get('/kanban/pending');
       setPendingCards(res.data);
    } catch (err) {
       console.error("Error fetching pending cards", err);
    }
  };

  const fetchNotificationsCount = async () => {
    try {
       const res = await api.get('/notifications');
       const unreadPending = res.data.filter((n: any) => !n.read || n.status === 'PENDING').length;
       setUnreadNotificationsCount(unreadPending);
    } catch (err) {
       console.error("Error fetching notifications count", err);
    }
  };

  const fetchTodayCards = async () => {
    try {
      const dateStr = getSaoPauloTodayStr();
      const res = await api.get(`/kanban/${dateStr}`);
      setTodayCards(res.data);
    } catch (err) {
      console.error("Error fetching today cards", err);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await api.get('/notifications');
      setActivities(res.data);
    } catch (err) {
      console.error("Error fetching activities", err);
    }
  };

  useEffect(() => {
     if (user) {
         fetchPendingCards();
         fetchNotificationsCount();
         fetchTodayCards();
         fetchActivities();
         window.addEventListener('tasksUpdated', fetchPendingCards);
         window.addEventListener('tasksUpdated', fetchNotificationsCount);
         window.addEventListener('tasksUpdated', fetchTodayCards);
         window.addEventListener('tasksUpdated', fetchActivities);
     }
     
     return () => {
         window.removeEventListener('tasksUpdated', fetchPendingCards);
         window.removeEventListener('tasksUpdated', fetchNotificationsCount);
         window.removeEventListener('tasksUpdated', fetchTodayCards);
         window.removeEventListener('tasksUpdated', fetchActivities);
     };
  }, [user, location.pathname]);

  const handleToggleComplete = async (card: any) => {
    try {
      const newStatus = card.status === 'DONE' ? 'OPEN' : 'DONE';
      await api.put(`/kanban/${card.id}`, { status: newStatus });
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err) {
      console.error("Error toggling task completion", err);
    }
  };

  const handleToggleProgress = async (card: any) => {
    try {
      const newStatus = card.status === 'IN_PROGRESS' ? 'OPEN' : 'IN_PROGRESS';
      await api.put(`/kanban/${card.id}`, { status: newStatus });
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err) {
      console.error("Error toggling task progress", err);
    }
  };

  const handleQuickDelete = async (cardId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
      await api.delete(`/kanban/${cardId}`);
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err) {
      console.error("Error deleting task quickly", err);
    }
  };

  const handleAcceptNotification = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/accept`);
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao aceitar tarefa.');
    }
  };

  const handleRefuseNotification = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/refuse`);
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao recusar tarefa.');
    }
  }; // simplistic polling when changing pages

  const calculatePendingDays = (card: any) => {
    const cardDateStr = getCardDateStr(card);
    if (!cardDateStr) return 0;
    const todayStr = getSaoPauloTodayStr();
    
    // Parse in local midnight safely
    const cardDate = new Date(cardDateStr + 'T00:00:00');
    const todayDate = new Date(todayStr + 'T00:00:00');
    
    const diffTime = todayDate.getTime() - cardDate.getTime();
    if (diffTime <= 0) return 0;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDurationSide = (card: any) => {
    if (!card.completedAt) return '';
    const startStr = getCardDateStr(card);
    if (!startStr) return '';
    const start = new Date(startStr + 'T12:00:00');
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

  const calculateDaysUntil = (card: any) => {
    const cardDateStr = getCardDateStr(card);
    if (!cardDateStr) return 0;
    const todayStr = getSaoPauloTodayStr();
    const cardDate = new Date(cardDateStr + 'T00:00:00');
    const todayDate = new Date(todayStr + 'T00:00:00');
    const diffTime = cardDate.getTime() - todayDate.getTime();
    if (diffTime <= 0) return 0;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const pendingToday = pendingCards.filter(c => getCardDateStr(c) === getSaoPauloTodayStr());
  const pendingOverdue = pendingCards.filter(c => getCardDateStr(c) < getSaoPauloTodayStr()).sort((a,b) => calculatePendingDays(b) - calculatePendingDays(a));
  const pendingUpcoming = pendingCards.filter(c => getCardDateStr(c) > getSaoPauloTodayStr()).sort((a,b) => getCardDateStr(a).localeCompare(getCardDateStr(b)));

  // Combine real notifications with dynamic card activities for a lively feed
  const combinedActivities = [
    ...activities.map((act: any) => ({
      id: act.id,
      title: act.title,
      message: act.message,
      createdAt: act.createdAt,
      type: act.type || 'NOTIFICATION'
    })),
    ...todayCards.flatMap((card: any) => {
      const items = [];
      if (card.createdAt) {
        items.push({
          id: `create-${card.id}`,
          title: 'Tarefa Criada',
          message: `Você adicionou a tarefa "${card.title}" à sua agenda.`,
          createdAt: card.createdAt,
          type: 'CREATE'
        });
      }
      if (card.status === 'DONE') {
        items.push({
          id: `done-${card.id}`,
          title: 'Tarefa Concluída',
          message: `Você concluiu a tarefa "${card.title}". 🎉`,
          createdAt: card.completedAt || card.createdAt,
          type: 'DONE'
        });
      } else if (card.status === 'IN_PROGRESS') {
        items.push({
          id: `progress-${card.id}`,
          title: 'Tarefa em Progresso',
          message: `Você iniciou o trabalho na tarefa "${card.title}". ⚡`,
          createdAt: card.createdAt,
          type: 'IN_PROGRESS'
        });
      }
      return items;
    }),
    ...pendingCards
      .filter((c: any) => !todayCards.some((tc: any) => tc.id === c.id))
      .flatMap((card: any) => {
        const items = [];
        if (card.createdAt) {
          items.push({
            id: `create-${card.id}`,
            title: 'Tarefa Criada',
            message: `Você adicionou a tarefa "${card.title}" à sua agenda.`,
            createdAt: card.createdAt,
            type: 'CREATE'
          });
        }
        if (card.status === 'IN_PROGRESS') {
          items.push({
            id: `progress-${card.id}`,
            title: 'Tarefa em Progresso',
            message: `Você iniciou o trabalho na tarefa "${card.title}". ⚡`,
            createdAt: card.createdAt,
            type: 'IN_PROGRESS'
          });
        }
        return items;
      })
  ]
  .filter((value, index, self) => self.findIndex(t => t.id === value.id) === index)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 15);

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
          <div className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100 p-4' : 'opacity-0 h-0 p-0 overflow-hidden'} bg-gray-50 border-t border-[#DFE1E6] flex flex-col gap-4 shrink-0 overflow-y-auto max-h-[50vh]`}>
            <div className="flex items-center justify-between sticky top-0 bg-gray-50 backdrop-blur-sm z-10 py-1 border-b border-gray-200">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Visão Rápida</h4>
            </div>

            {/* Progresso de Hoje Widget */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                <span>Progresso de Hoje</span>
                <span className="text-[#0079bf] font-extrabold">{todayCards.filter(c => c.status === 'DONE').length}/{todayCards.length} Feitas ({todayCards.length > 0 ? Math.round((todayCards.filter(c => c.status === 'DONE').length / todayCards.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner border border-gray-200/50">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${todayCards.length > 0 ? Math.round((todayCards.filter(c => c.status === 'DONE').length / todayCards.length) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Abas de Navegação Compacta */}
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 shrink-0">
              <button 
                type="button"
                onClick={() => setActiveQuickTab('tasks')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 text-[9px] font-bold rounded-md transition-colors cursor-pointer ${activeQuickTab === 'tasks' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ListTodo size={10} />
                Tasks
              </button>
              <button 
                type="button"
                onClick={() => setActiveQuickTab('activity')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 text-[9px] font-bold rounded-md transition-colors cursor-pointer ${activeQuickTab === 'activity' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Activity size={10} />
                Atividades
              </button>
              <button 
                type="button"
                onClick={() => setActiveQuickTab('alerts')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 text-[9px] font-bold rounded-md transition-colors cursor-pointer relative ${activeQuickTab === 'alerts' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Bell size={10} />
                Alertas
                {activities.filter(n => n.status === 'PENDING' && n.type === 'CARD_ASSIGNMENT').length > 0 && (
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full absolute top-1 right-2 animate-pulse" />
                )}
              </button>
            </div>

            {/* Conteúdo Relacionado à Aba Selecionada */}
            {activeQuickTab === 'tasks' && (
              <div className="space-y-4">
                {/* Seção: Atrasadas (apenas se houver) */}
                {pendingOverdue.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-bold text-rose-500 uppercase mb-2 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      Atrasadas
                    </h5>
                    <div className="space-y-2">
                      {pendingOverdue.map(card => (
                         <div 
                           key={`side-overdue-${card.id}`} 
                           className="bg-white rounded-xl p-3 text-gray-800 shadow-sm border border-red-200 border-l-4 relative overflow-hidden flex flex-col gap-2 hover:border-red-300 hover:shadow-md transition-all group/card cursor-default" 
                           style={{borderLeftColor: card.color}}
                         >
                           <div className="flex justify-between items-start gap-1 w-full">
                             <p className="text-xs font-semibold text-gray-700 truncate flex-1 leading-tight" title={card.title}>{card.title}</p>
                             
                             {/* Quick Action buttons on Hover */}
                             <div className="opacity-0 group-hover/card:opacity-100 flex items-center gap-1 shrink-0 ml-1 transition-opacity">
                               <button
                                 type="button"
                                 onClick={() => handleToggleComplete(card)}
                                 className="p-0.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                                 title="Concluir"
                               >
                                 <Check size={10} />
                               </button>
                               <button
                                 type="button"
                                 onClick={() => handleToggleProgress(card)}
                                 className={`p-0.5 rounded transition-colors cursor-pointer ${card.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'text-gray-400 hover:text-[#0079bf] hover:bg-blue-50'}`}
                                 title={card.status === 'IN_PROGRESS' ? 'Pausar' : 'Iniciar'}
                               >
                                 {card.status === 'IN_PROGRESS' ? <Pause size={10} /> : <Play size={10} />}
                               </button>
                               <button
                                 type="button"
                                 onClick={() => handleQuickDelete(card.id)}
                                 className="p-0.5 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                                 title="Excluir"
                               >
                                 <Trash2 size={10} />
                               </button>
                             </div>
                             <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 rounded px-1 min-w-[max-content]">{calculatePendingDays(card)}d</span>
                           </div>
                           <div className="flex flex-col gap-0.5 text-[8px] text-gray-400 bg-gray-50/70 rounded p-1.5 font-semibold">
                             <span>Venceu em: {new Date(card.dayDate).toLocaleDateString('pt-BR')}</span>
                             {card.status === 'IN_PROGRESS' && (
                               <span className="text-[#0079bf] font-bold">● Em progresso</span>
                             )}
                           </div>
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seção: Hoje */}
                <div>
                  <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Hoje
                  </h5>
                  <div className="space-y-2">
                    {pendingToday.length === 0 && <p className="text-[10px] text-gray-400 italic">Sem tarefas pendentes hoje.</p>}
                    {pendingToday.map(card => (
                       <div 
                         key={`side-${card.id}`} 
                         className="bg-white rounded-xl p-3 text-gray-800 shadow-sm border border-gray-200 border-l-4 relative overflow-hidden flex flex-col gap-2 hover:border-gray-300 hover:shadow-md transition-all group/card cursor-default" 
                         style={{borderLeftColor: card.color}}
                       >
                         <div className="flex items-start justify-between gap-1 w-full">
                           <p className="text-xs font-semibold text-gray-700 truncate flex-1 leading-tight" title={card.title}>{card.title}</p>
                           
                           {/* Quick Action buttons on Hover */}
                           <div className="opacity-0 group-hover/card:opacity-100 flex items-center gap-1 shrink-0 ml-1 transition-opacity">
                             <button
                               type="button"
                               onClick={() => handleToggleComplete(card)}
                               className="p-0.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                               title="Concluir"
                             >
                               <Check size={10} />
                             </button>
                             <button
                               type="button"
                               onClick={() => handleToggleProgress(card)}
                               className={`p-0.5 rounded transition-colors cursor-pointer ${card.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'text-gray-400 hover:text-[#0079bf] hover:bg-blue-50'}`}
                               title={card.status === 'IN_PROGRESS' ? 'Pausar' : 'Iniciar'}
                             >
                               {card.status === 'IN_PROGRESS' ? <Pause size={10} /> : <Play size={10} />}
                             </button>
                             <button
                               type="button"
                               onClick={() => handleQuickDelete(card.id)}
                               className="p-0.5 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                               title="Excluir"
                             >
                               <Trash2 size={10} />
                             </button>
                           </div>
                         </div>
                         <div className="flex flex-col gap-0.5 text-[8px] text-gray-400 bg-gray-50/70 rounded p-1.5 font-semibold">
                           <span>Criado: {new Date(card.createdAt).toLocaleDateString('pt-BR')}</span>
                           {card.status === 'IN_PROGRESS' && (
                             <span className="text-[#0079bf] font-bold">● Em progresso</span>
                           )}
                         </div>
                       </div>
                    ))}
                  </div>
                </div>

                {/* Seção: No Caminho (Futuras) */}
                <div>
                  <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    No Caminho (Futuras)
                  </h5>
                  <div className="space-y-2">
                    {pendingUpcoming.length === 0 && <p className="text-[10px] text-gray-400 italic">Sem tarefas agendadas para os próximos dias.</p>}
                    {pendingUpcoming.map(card => {
                      const daysLeft = calculateDaysUntil(card);
                      return (
                       <div 
                         key={`side-upcoming-${card.id}`} 
                         className="bg-white rounded-xl p-3 text-gray-800 shadow-sm border border-gray-200 border-l-4 relative overflow-hidden flex flex-col gap-2 hover:border-gray-300 hover:shadow-md transition-all group/card cursor-default" 
                         style={{borderLeftColor: card.color}}
                       >
                         <div className="flex justify-between items-start gap-1 w-full">
                           <p className="text-xs font-semibold text-gray-700 truncate flex-1 leading-tight" title={card.title}>{card.title}</p>
                           
                           {/* Quick Action buttons on Hover */}
                           <div className="opacity-0 group-hover/card:opacity-100 flex items-center gap-1 shrink-0 ml-1 transition-opacity">
                             <button
                               type="button"
                               onClick={() => handleToggleComplete(card)}
                               className="p-0.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                               title="Concluir"
                             >
                               <Check size={10} />
                             </button>
                             <button
                               type="button"
                               onClick={() => handleToggleProgress(card)}
                               className={`p-0.5 rounded transition-colors cursor-pointer ${card.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'text-gray-400 hover:text-[#0079bf] hover:bg-blue-50'}`}
                               title={card.status === 'IN_PROGRESS' ? 'Pausar' : 'Iniciar'}
                             >
                               {card.status === 'IN_PROGRESS' ? <Pause size={10} /> : <Play size={10} />}
                             </button>
                             <button
                               type="button"
                               onClick={() => handleQuickDelete(card.id)}
                               className="p-0.5 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                               title="Excluir"
                             >
                               <Trash2 size={10} />
                             </button>
                           </div>
                           <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 rounded px-1 min-w-[max-content]">
                             {daysLeft === 1 ? 'Amanhã' : `Em ${daysLeft}d`}
                           </span>
                         </div>
                         <div className="flex flex-col gap-0.5 text-[8px] text-gray-400 bg-gray-50/70 rounded p-1.5 font-semibold">
                           <span>Agendado para: {new Date(card.dayDate).toLocaleDateString('pt-BR')}</span>
                           {card.status === 'IN_PROGRESS' && (
                             <span className="text-[#0079bf] font-bold">● Em progresso</span>
                           )}
                         </div>
                       </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeQuickTab === 'activity' && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {combinedActivities.length === 0 && <p className="text-[10px] text-gray-400 italic text-center py-4">Nenhuma atividade recente.</p>}
                {combinedActivities.map((act: any) => {
                  let borderLeftColor = 'border-l-indigo-500';
                  if (act.type === 'DONE') borderLeftColor = 'border-l-emerald-500';
                  if (act.type === 'IN_PROGRESS') borderLeftColor = 'border-l-amber-500';
                  if (act.type === 'CREATE') borderLeftColor = 'border-l-blue-500';

                  return (
                    <div key={act.id} className={`bg-white p-2.5 rounded-lg border border-gray-200 border-l-4 ${borderLeftColor} shadow-sm flex flex-col gap-1`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] font-bold text-gray-700 leading-tight">{act.title}</span>
                        <span className="text-[8px] font-semibold text-gray-400 whitespace-nowrap">
                          {new Date(act.createdAt).toLocaleDateString('pt-BR')} {new Date(act.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-400 leading-normal">{act.message}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {activeQuickTab === 'alerts' && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {activities.filter(n => n.status === 'PENDING' && n.type === 'CARD_ASSIGNMENT').length === 0 && (
                  <div className="text-center py-6 px-3 flex flex-col items-center gap-2">
                    <p className="text-[10px] text-gray-400 italic leading-relaxed">Sem alertas ou delegações pendentes.</p>
                    <p className="text-[8px] text-gray-450 max-w-[180px] leading-normal text-center">Quando outro colaborador do seu grupo compartilhar um cartão com você, ele aparecerá aqui para você aceitar ou recusar!</p>
                  </div>
                )}
                {activities.filter(n => n.status === 'PENDING' && n.type === 'CARD_ASSIGNMENT').map((alertItem: any) => (
                  <div key={alertItem.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-gray-800 leading-tight">{alertItem.title}</span>
                      <p className="text-[9px] text-gray-400 leading-normal mt-0.5">{alertItem.message}</p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => handleAcceptNotification(alertItem.id)}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[9px] rounded-lg transition-colors cursor-pointer text-center"
                      >
                        Aceitar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRefuseNotification(alertItem.id)}
                        className="flex-1 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg transition-colors cursor-pointer text-center"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
