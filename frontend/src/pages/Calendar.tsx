import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Minimize2, Maximize2, X, AlertCircle, Pen, FileText, Paperclip, Download, Plus } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import api from '../services/api';
import { SortableKanbanCard, KanbanCardUI } from '../components/SortableKanbanCard';
import { SortableColumn } from '../components/SortableColumn';

type KanbanViewState = 'normal' | 'minimized' | 'maximized';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [flipState, setFlipState] = useState<'idle' | 'out' | 'in'>('idle');
  const [cards, setCards] = useState<any[]>([]);
  const [monthCards, setMonthCards] = useState<any[]>([]);
  const [kanbanView, setKanbanView] = useState<KanbanViewState>('normal');
  const [showSettings, setShowSettings] = useState(false);
  const [disableWeekends, setDisableWeekends] = useState(() => {
    return localStorage.getItem('@KalendAI:disableWeekends') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('@KalendAI:disableWeekends', disableWeekends.toString());
  }, [disableWeekends]);

  const [pendingCards, setPendingCards] = useState<any[]>([]);

  useEffect(() => {
    // Fetch cards for the selected day
    const fetchCards = async () => {
      try {
        const offset = selectedDate.getTimezoneOffset() * 60000;
        const localDate = new Date(selectedDate.getTime() - offset);
        const dateStr = localDate.toISOString().split('T')[0];
        const res = await api.get(`/kanban/${dateStr}`);
        setCards(res.data);
      } catch (err) {
        console.error("Error fetching day cards", err);
      }
    };
    fetchCards();
    
    // Fetch report logic
    const fetchReport = async () => {
       try {
         const offset = selectedDate.getTimezoneOffset() * 60000;
         const localDate = new Date(selectedDate.getTime() - offset);
         const dateStr = localDate.toISOString().split('T')[0];
         
         const res = await api.get(`/kanban/report?date=${dateStr}`);
         if (res.data?.result) {
            setDailyReport(res.data.result);
         } else {
            setDailyReport('');
         }
       } catch (err) {
         console.error(err);
         setDailyReport('');
       }
    };
    fetchReport();
  }, [selectedDate]);

  useEffect(() => {
    const fetchPendingCards = async () => {
      try {
         const res = await api.get('/kanban/pending');
         setPendingCards(res.data);
      } catch (err) {
         console.error("Error fetching pending cards", err);
      }
    };
    fetchPendingCards();
  }, [cards]); // Reload when cards change (e.g. after adding/moving)

  useEffect(() => {
    // Fetch all cards for the current view month
    const fetchMonthCards = async () => {
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // 1-indexed
        const res = await api.get(`/kanban/month/${year}/${month}`);
        setMonthCards(res.data);
      } catch (err) {
        console.error("Error fetching month cards", err);
      }
    };
    fetchMonthCards();
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [newCardColor, setNewCardColor] = useState('');

  const [editingCard, setEditingCard] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editingImages, setEditingImages] = useState<any[]>([]);

  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [assigningCard, setAssigningCard] = useState(false);

  useEffect(() => {
    const fetchGroupMembers = async () => {
      try {
        const res = await api.get('/notifications/group-members');
        setGroupMembers(res.data);
      } catch (err) {
        console.error("Error fetching group members:", err);
      }
    };
    if (editingCard) {
      fetchGroupMembers();
    }
  }, [editingCard]);

  const handleAssignCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId || !editingCard) return;

    try {
      setAssigningCard(true);
      await api.post(`/kanban/${editingCard.id}/assign`, { receiverId: assigneeId });
      alert('Proposta de atribuição enviada com sucesso para a Inbox do destinatário!');
      setAssigneeId('');
      setEditingCard(null);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao propor atribuição.');
    } finally {
      setAssigningCard(false);
    }
  };

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [dailyReport, setDailyReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setDailyReport('Gerando relatório com IA...');
    try {
      const offset = selectedDate.getTimezoneOffset() * 60000;
      const localDate = new Date(selectedDate.getTime() - offset);
      const dateStr = localDate.toISOString().split('T')[0];
      const res = await api.post('/kanban/report', { dateStr });
      setDailyReport(res.data.result || 'Erro ao gerar relatório.');
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 500 && err.response?.data?.error === 'AI_API_KEY not configured') {
         setDailyReport('Erro: a chave de API da IA nao esta configurada no servidor (AI_API_KEY).');
      } else {
         setDailyReport('Falha ao obter relatório da IA.');
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim() || isPastDay) {
      setIsAddingCard(false);
      return;
    }
    try {
      const offset = selectedDate.getTimezoneOffset() * 60000;
      const localDate = new Date(selectedDate.getTime() - offset);
      const res = await api.post('/kanban', {
        title: newCardTitle,
        description: newCardDescription,
        color: newCardColor,
        dayDate: localDate.toISOString().split('T')[0]
      });
      setCards(prev => [...prev, res.data]);
      setMonthCards(prev => [...prev, res.data]);
      
      setNewCardTitle('');
      setNewCardDescription('');
      setNewCardColor('');
      setIsAddingCard(false);
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditModal = (card: any) => {
    // If it's a past day, they can still view it, but we'll disable inputs in the render logic
    setEditingCard(card);
    setEditTitle(card.title);
    setEditDescription(card.description || '');
    setEditColor(card.color || '#0079bf');
    setEditingImages(card.images || []);
  };

  const handleSaveCardEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    try {
      const res = await api.put(`/kanban/${editingCard.id}`, {
        title: editTitle,
        description: editDescription,
        color: editColor
      });
      setCards(cards.map(c => c.id === editingCard.id ? res.data : c));
      
      // Update monthCards so calendar dots change instantly
      setMonthCards(monthCards.map(c => c.id === editingCard.id ? res.data : c));
      
      setEditingCard(null);
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCard) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post(`/kanban/${editingCard.id}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const newImg = res.data;
      setEditingImages(prev => [...prev, newImg]);
      
      const updatedCards = cards.map((c: any) => {
        if (c.id === editingCard.id) {
          const imgs = c.images || [];
          return { ...c, images: [...imgs, newImg] };
        }
        return c;
      });
      setCards(updatedCards);
      setMonthCards(updatedCards);
    } catch (err: any) {
      console.error('Image upload failed', err);
      const errMsg = err.response?.data?.error || 'Erro ao fazer upload do anexo no MinIO.';
      alert(errMsg);
    }
  };

  const handleImageDelete = async (imageId: string) => {
    if (!editingCard) return;
    try {
      await api.delete(`/kanban/${editingCard.id}/images/${imageId}`);
      setEditingImages(prev => prev.filter(img => img.id !== imageId));

      const updatedCards = cards.map((c: any) => {
        if (c.id === editingCard.id) {
          const imgs = c.images || [];
          return { ...c, images: imgs.filter((img: any) => img.id !== imageId) };
        }
        return c;
      });
      setCards(updatedCards);
      setMonthCards(updatedCards);
    } catch (err) {
      console.error('Image deletion failed', err);
      alert('Erro ao excluir a imagem do MinIO.');
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  const isToday = (day: number) => {
    return today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
  };
  
  const isPastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const handleDayClick = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (newDate.getTime() === selectedDate.getTime()) return;

    if (kanbanView !== 'maximized' && flipState === 'idle') {
      setFlipState('out');
      setTimeout(() => {
        setSelectedDate(newDate);
        setFlipState('in');
        setTimeout(() => {
          setFlipState('idle');
        }, 300);
      }, 200);
    } else {
      setSelectedDate(newDate);
    }
  };

  const [activeCard, setActiveCard] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find(c => c.id === active.id);
    setActiveCard(card);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id;
    const overId = over.id;
    
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    setCards(prevCards => {
      const activeIndex = prevCards.findIndex((c) => c.id === activeId);
      if (activeIndex === -1) return prevCards;

      let newCards = [...prevCards];
      
      if (isOverTask) {
        const overIndex = newCards.findIndex((c) => c.id === overId);
        if (newCards[activeIndex].status !== newCards[overIndex].status) {
          newCards[activeIndex] = { ...newCards[activeIndex], status: newCards[overIndex].status };
          return arrayMove(newCards, activeIndex, overIndex);
        }
      }

      if (isOverColumn) {
        const status = overId as string;
        if (newCards[activeIndex].status !== status) {
          newCards[activeIndex] = { ...newCards[activeIndex], status };
          return arrayMove(newCards, activeIndex, newCards.length - 1);
        }
      }

      return newCards;
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const isActiveTask = active.data.current?.type === 'Task';
    if (!isActiveTask) return;

    setCards(prevCards => {
      let newCards = [...prevCards];
      const activeIndex = newCards.findIndex((c) => c.id === activeId);
      
      const isOverTask = over.data.current?.type === 'Task';
      if (isOverTask) {
        const overIndex = newCards.findIndex((c) => c.id === overId);
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex && newCards[activeIndex].status === newCards[overIndex].status) {
          newCards = arrayMove(newCards, activeIndex, overIndex);
        }
      }

      const updates = newCards.map((c, idx) => ({ id: c.id, order: idx, status: c.status }));
      
      setMonthCards(prevMonth => {
         const newMonthCards = [...prevMonth];
         updates.forEach(u => {
           const mapIdx = newMonthCards.findIndex(m => m.id === u.id);
           if (mapIdx !== -1) {
             newMonthCards[mapIdx].status = u.status;
             newMonthCards[mapIdx].order = u.order;
           }
         });
         return newMonthCards;
      });

      api.put('/kanban/reorder/bulk', { updates })
         .then(() => window.dispatchEvent(new Event('tasksUpdated')))
         .catch(console.error);

      return newCards;
    });
  };

  const handleMoveCardStatus = (cardId: string, newStatus: string) => {
    setCards(prevCards => {
      const newCards = [...prevCards];
      const index = newCards.findIndex((c) => c.id === cardId);
      if (index !== -1) {
        newCards[index] = { ...newCards[index], status: newStatus };
        
        // Re-index for save
        const updates = newCards.map((c, idx) => ({ id: c.id, order: idx, status: c.status }));
        
        setMonthCards(prevMonth => {
           const newMonthCards = [...prevMonth];
           updates.forEach(u => {
             const mapIdx = newMonthCards.findIndex(m => m.id === u.id);
             if (mapIdx !== -1) {
               newMonthCards[mapIdx].status = u.status;
               newMonthCards[mapIdx].order = u.order;
             }
           });
           return newMonthCards;
        });

        api.put('/kanban/reorder/bulk', { updates })
           .then(() => window.dispatchEvent(new Event('tasksUpdated')))
           .catch(console.error);
      }
      return newCards;
    });
  };

  const formatDuration = (card: any) => {
    if (!card.completedAt) return null;
    const start = new Date(card.createdAt).getTime();
    const end = new Date(card.completedAt).getTime();
    
    // Fallback if somehow completedAt < start
    if (end < start) return "0m";

    const diff = Math.floor((end - start) / 60000); // minutes
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h ${mins}m`;
  };

  const monthThemes = [
    '#0079BF', '#D29034', '#519839', '#B04632', 
    '#89609E', '#CD5A91', '#4BBF6B', '#00AECC', 
    '#838C91', '#5BA4CF', '#298FCA', '#EB5A46'
  ];
  const currentThemeColor = monthThemes[currentDate.getMonth()];
  
  // Array of 6 pastel backgrounds for weeks
  const weekColors = ['bg-rose-50/75', 'bg-blue-50/75', 'bg-emerald-50/75', 'bg-amber-50/75', 'bg-purple-50/75', 'bg-teal-50/75'];
  const weekTextColors = ['text-rose-600', 'text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-purple-600', 'text-teal-600'];
  const weekBadgeColors = ['bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-teal-500'];

  const getCalendarWidthCls = () => {
    switch (kanbanView) {
      case 'maximized': return 'hidden';
      case 'minimized': return 'w-full xl:w-[600px] flex-1';
      case 'normal': default: return 'w-full xl:w-[380px] shrink-0';
    }
  };

  const getKanbanWidthCls = () => {
    switch (kanbanView) {
      case 'maximized': return 'w-full flex-1';
      case 'minimized': return 'w-full xl:w-[300px] xl:flex-none';
      case 'normal': default: return 'w-full flex-1';
    }
  };

  const calculatePendingDays = (card: any) => {
    const start = new Date(card.originalDayDate || card.createdAt);
    start.setHours(0, 0, 0, 0);
    const now = new Date(today);
    now.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleDeleteCard = async (e: React.MouseEvent | null, cardId: string) => {
    if (e) e.stopPropagation();
    try {
      await api.delete(`/kanban/${cardId}`);
      setCards(prev => prev.filter(c => c.id !== cardId));
      setMonthCards(prev => prev.filter(c => c.id !== cardId));
      window.dispatchEvent(new Event('tasksUpdated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeColor = async (e: React.MouseEvent, cardId: string, color: string) => {
    e.stopPropagation();
    if (isPastDay) return;
    try {
      await api.put(`/kanban/${cardId}`, { color });
      setCards(cards.map(c => c.id === cardId ? { ...c, color } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const paletteColors = [
    '#0079bf', '#eb5a46', '#519839', '#f2d600', '#c377e0',
    '#ff9f1a', '#00c2e0', '#e91e63', '#2196f3', '#00bcd4', 
    '#4caf50', '#8bc34a', '#cddc39', '#ffc107', '#ff5722',
    '#795548', '#607d8b', '#9c27b0', '#673ab7', '#3f51b5'
  ];

  const handlePasteAttachment = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!editingCard) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const file = item.getAsFile();
        if (file) {
           e.preventDefault();
           const formData = new FormData();
           formData.append('image', file);

           try {
             const res = await api.post(`/kanban/${editingCard.id}/images`, formData, {
               headers: {
                 'Content-Type': 'multipart/form-data'
               }
             });
             
             const newImg = res.data;
             setEditingImages(prev => [...prev, newImg]);
             
             const updatedCards = cards.map((c: any) => {
               if (c.id === editingCard.id) {
                 const imgs = c.images || [];
                 return { ...c, images: [...imgs, newImg] };
               }
               return c;
             });
             setCards(updatedCards);
             setMonthCards(updatedCards);
           } catch (err: any) {
             console.error('Clipboard paste upload failed', err);
             const errMsg = err.response?.data?.error || 'Erro ao fazer upload do anexo colado.';
             alert(errMsg);
           }
        }
    }
  };

  const selectedFirstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
  const selectedWeekIndex = Math.floor((selectedFirstDay + selectedDate.getDate() - 1) / 7);
  const selectedWeekTextColor = weekTextColors[selectedWeekIndex % weekTextColors.length];
  const selectedWeekBadgeColor = weekBadgeColors[selectedWeekIndex % weekBadgeColors.length];

  return (
    <div className="flex relative min-h-full xl:h-full p-4 md:p-8 gap-4 md:gap-8 xl:overflow-hidden flex-col xl:flex-row-reverse">
      {/* KANBAN AND CALENDAR LAYOUT (Kanban is physically 2nd in DOM but first via row-reverse) */}
      
      <div className={`${getCalendarWidthCls()} xl:h-full xl:overflow-y-auto min-h-0 flex flex-col gap-4 transition-all duration-500 ease-in-out [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
        {/* SIDE MAIN CALENDAR */}
        <div className="flex flex-col bg-white p-6 rounded-xl shadow-sm border border-[#DFE1E6] shrink-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-xl font-bold flex items-center gap-3" style={{ color: currentThemeColor }}>
              {currentDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
            </h2>
            <div className="flex gap-1 items-center bg-gray-50 border rounded-lg p-1">
              <button onClick={() => setShowSettings(!showSettings)} className="p-1 hover:bg-white rounded-md text-gray-500 transition-colors shadow-sm cursor-pointer relative z-10"><Settings size={16}/></button>
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <button 
                title="Mês Anterior" 
                onClick={handlePrevMonth} 
                className="p-1 hover:bg-white rounded-md text-gray-600 transition-colors shadow-sm cursor-pointer relative z-10">
                <ChevronLeft size={16} />
              </button>
              <button 
                title="Mês Atual" 
                onClick={() => setCurrentDate(new Date())} 
                className="w-2 h-2 rounded-full mx-1 transition-colors hover:scale-150 cursor-pointer relative z-10"
                style={{ backgroundColor: currentThemeColor }}
              />
              <button 
                title="Próximo Mês" 
                onClick={handleNextMonth} 
                className="p-1 hover:bg-white rounded-md text-gray-600 transition-colors shadow-sm cursor-pointer relative z-10">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

        {showSettings && (
          <div className="mb-6 p-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-gray-800 text-[10px]">Configuração</h4>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1 px-2 border border-gray-200 rounded shrink-0 hover:bg-gray-50 transition-colors">
              <input 
                type="checkbox" 
                className="w-3 h-3 text-[#0079bf] rounded border-gray-300 focus:ring-[#0079bf]"
                checked={disableWeekends}
                onChange={(e) => setDisableWeekends(e.target.checked)}
              />
              <span className="text-[10px] font-medium text-gray-700">Desabilitar finais de semana</span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-7 gap-px text-center font-bold uppercase text-[10px] mb-2 tracking-wider" style={{ color: currentThemeColor }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d[0]}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1 flex-1 min-h-[220px]">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-gray-50 rounded border border-transparent min-h-[40px]"></div>
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dayOfWeek = (firstDayOfMonth + i) % 7;
            const weekIndex = Math.floor((firstDayOfMonth + i) / 7);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isLocked = disableWeekends && isWeekend;

            const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === currentDate.getMonth() && selectedDate.getFullYear() === currentDate.getFullYear();
            
            // Collect day-specific cards
            const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const isPastLine = currentDayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            const offset = currentDayDate.getTimezoneOffset() * 60000;
            const localDate = new Date(currentDayDate.getTime() - offset);
            const dateStr = localDate.toISOString().split('T')[0];
            const dayCards = monthCards.filter(c => c.dayDate.startsWith(dateStr)).sort((a, b) => (a.order || 0) - (b.order || 0));

            const doneCards = dayCards.filter(c => c.status === 'DONE');
            const otherCards = dayCards.filter(c => c.status !== 'DONE');

            return (
              <div 
                key={`day-${i}`} 
                onClick={() => !isLocked && handleDayClick(day)}
                className={`flex flex-col rounded border p-1 sm:p-1 transition-colors relative min-h-[44px] ${isLocked ? 'cursor-not-allowed opacity-30 bg-gray-50' : 'cursor-pointer'} ${!isToday(day) && !isSelected && !isLocked ? weekColors[weekIndex % weekColors.length] : ''} ${isToday(day) ? 'ring-1 ring-indigo-500 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)] bg-white' : isSelected ? 'bg-indigo-50 border-indigo-200 pointer-events-none' : 'border-transparent hover:!bg-white/50'}`}
              >
                <div className="flex justify-between items-start leading-none mb-0.5">
                  <span className={`text-[10px] font-bold ${isToday(day) ? 'text-indigo-600' : 'text-gray-600'}`}>{day}</span>
                </div>
                {!isLocked && (
                  <div className="flex flex-col flex-1">
                    {/* Active Cards */}
                    <div className="flex gap-0.5 flex-wrap content-start">
                      {otherCards.slice(0, otherCards.length > 6 ? 5 : 6).map((card: any) => (
                        <div key={card.id} className="relative group/dot cursor-pointer py-0.5" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(card); }}>
                          <div
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 shrink-0 rounded-full group-hover/dot:scale-150 transition-transform ring-1 ring-black/10"
                            style={{ backgroundColor: card.color || '#0079bf' }}
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/dot:flex flex-col w-[max-content] max-w-[150px] p-2 bg-gray-900 border border-gray-700 text-white text-xs rounded shadow-xl z-50 pointer-events-none opacity-100">
                            <p className="font-bold line-clamp-2">{card.title}</p>
                            {card.description && <p className="text-gray-300 mt-1 line-clamp-3 text-[10px] whitespace-pre-wrap">{card.description}</p>}
                          </div>
                        </div>
                      ))}
                      {otherCards.length > 6 && (
                        <div className="flex items-center justify-center w-2 h-2 shrink-0 rounded-full ring-1 ring-gray-300 bg-white text-[6px] font-bold text-gray-500 py-0.5 mt-0.5 cursor-default group relative">
                          {otherCards.length - 5}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col w-[max-content] max-w-[150px] p-1.5 bg-gray-900 border border-gray-700 text-white text-xs rounded shadow-xl z-[9999] pointer-events-none opacity-100">
                             Mais {otherCards.length - 5}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Dead Zone for completed cards */}
                    {doneCards.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap content-start mt-auto pt-1 mt-1 border-t border-gray-200/50 bg-black/5 dark:bg-white/5 -mx-1 px-1 pb-1 rounded-b">
                        {doneCards.slice(0, doneCards.length > 6 ? 5 : 6).map((card: any) => (
                          <div key={card.id} className="relative group/dot cursor-pointer py-0.5" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(card); }}>
                            <div 
                              className="w-1.5 h-1.5 sm:w-2 sm:h-2 shrink-0 rounded-full group-hover/dot:scale-150 transition-transform ring-1 ring-black/20 opacity-30" 
                              style={{ backgroundColor: card.color || '#0079bf' }} 
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/dot:flex flex-col w-[max-content] max-w-[150px] p-2 bg-gray-900 border border-gray-700 text-white text-xs rounded shadow-xl z-[9999] pointer-events-none opacity-100">
                              <p className="font-bold line-clamp-2 text-white">{card.title}</p>
                              {card.description && <p className="text-gray-200 mt-1 line-clamp-3 text-[10px] whitespace-pre-wrap">{card.description}</p>}
                            </div>
                          </div>
                        ))}
                        {doneCards.length > 6 && (
                          <div className="flex items-center justify-center w-2 h-2 shrink-0 rounded-full ring-1 ring-gray-300 bg-white text-[6px] font-bold text-gray-500 py-0.5 mt-0.5 opacity-50 cursor-default group relative">
                            {doneCards.length - 5}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col w-[max-content] max-w-[150px] p-1.5 bg-gray-900 border border-gray-700 text-white text-xs rounded shadow-xl z-[9999] pointer-events-none opacity-100">
                               Mais {doneCards.length - 5}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>

        {/* REPORT SECTION */}
        <div className={`flex flex-col bg-white rounded-xl shadow-sm border border-[#DFE1E6] overflow-hidden transition-all duration-300 ${isReportOpen ? 'p-5 min-h-[250px] flex-1' : 'p-3 hover:bg-gray-50 cursor-pointer shrink-0'}`}>
          {!isReportOpen ? (
            <div onClick={() => setIsReportOpen(true)} className="flex items-center justify-between w-full">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                 <FileText size={16} className="text-[#70b500]"/>
                 Relatório Diário
              </h3>
              <p className="text-[10px] text-gray-400">Clique para expandir o relatório</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 shrink-0">
                 <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <FileText size={16} className="text-[#70b500]"/>
                    Relatório Diário
                 </h3>
                 <div className="flex gap-1">
                     <button 
                        onClick={() => setIsReportOpen(false)}
                        title="Minimizar"
                        className="bg-white border text-gray-500 py-1.5 px-2 rounded text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm flex items-center"
                     >
                        <Minimize2 size={12}/>
                     </button>
                     <button 
                        onClick={() => navigator.clipboard.writeText(dailyReport)}
                        title="Copiar"
                        className="bg-white border text-gray-500 py-1.5 px-2 rounded text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm"
                     >
                        Copiar
                     </button>
                     <button 
                        onClick={handleGenerateReport} 
                        disabled={isGeneratingReport}
                        title="Gerar Relatório com IA" 
                        className="bg-[#70b500] text-white py-1.5 px-3 rounded text-xs font-bold hover:bg-[#5a9200] transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                     >
                        {isGeneratingReport ? (
                          <>
                             <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                             &nbsp;Gerando...
                          </>
                        ) : (
                          <>
                             <svg fill="currentColor" viewBox="0 0 24 24" className="w-3 h-3"><path d="M11.996 22a.5.5 0 01-.482-.363c-.147-.518-.28-1.026-.457-1.517-.552-1.52-1.31-2.903-2.316-4.148-1.002-1.242-2.22-2.274-3.585-3.08-1.514-.897-3.14-1.464-4.838-1.74a4.436 4.436 0 01-2.146-.665.5.5 0 01-.22-.38.483.483 0 01.218-.386 4.384 4.384 0 012.164-.694c2.818-.46 5.405-1.764 7.575-3.843 1.134-1.085 2.05-2.348 2.686-3.842a12.19 12.19 0 00.916-3.033A.5.5 0 0111.996 2a.5.5 0 01.488.318A12.35 12.35 0 0013.4 5.341c.642 1.488 1.56 2.744 2.695 3.823A11.024 11.024 0 0023.633 13a.49.49 0 01.22.383.498.498 0 01-.21.383 4.329 4.329 0 01-1.792.653c-.567.098-1.13.238-1.685.407-3.415 1.04-6.177 3.32-7.854 6.425a12.01 12.01 0 00-1.84 4.423.518.518 0 01-.476.326z"></path></svg>
                             &nbsp;Gerar
                          </>
                        )}
                     </button>
                 </div>
              </div>
              <p className="text-[10px] text-gray-400 mb-2 leading-tight">Analisa as tarefas de hoje informando status e controle diário.</p>
              <textarea 
                 value={dailyReport}
                 onChange={(e) => setDailyReport(e.target.value)}
                 className="flex-1 w-full border border-gray-200 rounded-lg p-3 text-xs text-gray-700 focus:ring-2 focus:ring-[#70b500] focus:border-transparent outline-none resize-none bg-gray-50/50"
                 placeholder="O relatório gerado pelo agente aparecerá aqui. Você pode editá-lo à vontade..."
              />
            </>
          )}
        </div>

      </div>

      {/* KANBAN MINI VIEW */}
      <div className={`${getKanbanWidthCls()} bg-white rounded-xl shadow-sm border border-[#DFE1E6] p-4 md:p-6 flex flex-col gap-4 overflow-hidden transition-all duration-500 ease-in-out ${flipState === 'out' ? 'calendar-flip-out' : ''} ${flipState === 'in' ? 'calendar-flip-in' : ''}`}>
        <div className="flex items-center justify-between shrink-0">
          <h3 className="font-bold flex items-center gap-2">
            {kanbanView !== 'minimized' && <span className={`text-xl font-black tracking-tight ${selectedWeekTextColor}`}>Quadro do dia:</span>}
            <span className={`p-1.5 ${selectedWeekBadgeColor} text-white rounded text-sm font-bold shadow-sm leading-none`}>
              {selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).toUpperCase()}
            </span>
          </h3>
          <div className="flex items-center gap-1">
            {kanbanView === 'normal' && (
              <>
                <button title="Minimizar" onClick={() => setKanbanView('minimized')} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"><Minimize2 size={16}/></button>
                <button title="Maximizar" onClick={() => setKanbanView('maximized')} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"><Maximize2 size={16}/></button>
              </>
            )}
            {kanbanView === 'maximized' && (
              <button title="Restaurar" onClick={() => setKanbanView('normal')} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"><Minimize2 size={16}/></button>
            )}
            {kanbanView === 'minimized' && (
              <button title="Restaurar" onClick={() => setKanbanView('normal')} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"><Maximize2 size={16}/></button>
            )}
          </div>
        </div>

        {kanbanView === 'minimized' ? (
          <div className="flex flex-col gap-3 h-full justify-start items-stretch opacity-80">
            <div className="bg-gray-50 flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200">
              <span className="text-xs font-bold text-gray-500">Abertos</span>
              <span className="font-bold">{cards.filter(c => c.status === 'OPEN').length}</span>
            </div>
            <div className="bg-gray-50 flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200">
              <span className="text-xs font-bold text-[#0079bf]">Em Prg</span>
              <span className="font-bold text-[#0079bf]">{cards.filter(c => c.status === 'IN_PROGRESS').length}</span>
            </div>
            <div className="bg-green-50 flex items-center justify-between px-3 py-2 rounded-lg border border-green-200">
              <span className="text-xs font-bold text-green-600">Feitos</span>
              <span className="font-bold text-green-600">{cards.filter(c => c.status === 'DONE').length}</span>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <div className="flex gap-3 overflow-x-auto flex-1 h-full pb-2">
              <SortableColumn 
                id="OPEN" 
                title="Aberto" 
                cards={cards.filter(c => c.status === 'OPEN')} 
                isPastDay={isPastDay} 
                handleOpenEditModal={handleOpenEditModal} 
                formatDuration={formatDuration}
                handleMoveCardStatus={handleMoveCardStatus}
                headerAction={
                  !isPastDay && (
                    <button
                      onClick={() => setIsAddingCard(true)}
                      className="w-5 h-5 rounded-full hover:bg-gray-300 text-gray-500 flex items-center justify-center transition-colors group relative"
                    >
                      <Plus size={14} />
                      <span className="absolute hidden group-hover:block w-max bg-gray-800 text-white text-[10px] px-2 py-1 rounded top-full mt-1 right-0 z-50 font-normal">
                        + Criar Task
                      </span>
                    </button>
                  )
                }
              >
                {!isPastDay && isAddingCard && (
                    <form onSubmit={handleCreateCard} className="bg-white rounded p-3 shadow-sm border border-[#0079bf] flex flex-col gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Título do card..."
                        className="w-full text-sm font-bold outline-none bg-transparent"
                        value={newCardTitle}
                        onChange={e => setNewCardTitle(e.target.value)}
                      />
                      <textarea
                        placeholder="Descrição opcional..."
                        className="w-full text-xs outline-none bg-transparent resize-none text-gray-500"
                        rows={2}
                        value={newCardDescription}
                        onChange={e => setNewCardDescription(e.target.value)}
                      />
                      <div className="flex justify-between items-center mt-1">
                        <div className="flex gap-1.5 flex-wrap">
                           {['#0079bf', '#eb5a46', '#51e898', '#ff9f1a', '#f2d600', '#c377e0'].map(c => (
                             <button 
                               key={c} type="button" 
                               onClick={(e) => { e.preventDefault(); setNewCardColor(c); }}
                               className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${newCardColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                               style={{ backgroundColor: c }}
                             />
                           ))}
                        </div>
                        <div className="flex gap-2">
                           <button type="button" onClick={() => { setIsAddingCard(false); setNewCardTitle(''); setNewCardDescription(''); setNewCardColor(''); }} className="text-gray-400 hover:text-gray-600">
                             <X size={16}/>
                           </button>
                           <button type="submit" disabled={!newCardTitle.trim()} className="bg-[#0079bf] text-white px-2 py-1 rounded text-xs font-bold hover:bg-[#026aa7] disabled:opacity-50">
                             Adicionar
                           </button>
                        </div>
                      </div>
                    </form>
                )}
              </SortableColumn>
              
              <SortableColumn 
                id="IN_PROGRESS" 
                title="Progresso" 
                cards={cards.filter(c => c.status === 'IN_PROGRESS')} 
                isPastDay={isPastDay} 
                handleOpenEditModal={handleOpenEditModal} 
                formatDuration={formatDuration}
                handleMoveCardStatus={handleMoveCardStatus}
              />
              
              <SortableColumn 
                id="DONE" 
                title="Concluído" 
                cards={cards.filter(c => c.status === 'DONE')} 
                isPastDay={isPastDay} 
                handleOpenEditModal={handleOpenEditModal} 
                formatDuration={formatDuration}
                handleMoveCardStatus={handleMoveCardStatus}
              />
            </div>
            
            <DragOverlay dropAnimation={null}>
              {activeCard ? (
                <div className="rotate-2 scale-105 opacity-90 dragging-card">
                  <KanbanCardUI 
                    card={activeCard} 
                    isPastDay={isPastDay} 
                    handleOpenEditModal={() => {}} 
                    formatDuration={formatDuration} 
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center" style={{ borderLeft: `8px solid ${editColor}` }}>
              <h3 className="font-bold text-lg text-gray-800">Editar Tarefa</h3>
              <button onClick={() => setEditingCard(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveCardEdits} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Título</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full border rounded-lg p-2 text-gray-800 font-medium focus:ring-2 focus:ring-[#0079bf] focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Descrição</label>
                <textarea 
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  onPaste={handlePasteAttachment}
                  className="w-full border rounded-lg p-2 text-gray-700 min-h-[120px] focus:ring-2 focus:ring-[#0079bf] focus:border-transparent outline-none resize-y"
                  placeholder="Adicione detalhes mais específicos aqui... (Ctrl+V para colar imagens)"
                />
              </div>

              {/* Seção de evidencias em imagem no MinIO */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Evidencias em imagem (S3/MinIO)</label>
                  {!isPastDay && (
                    <label className="text-xs font-bold text-[#0079bf] cursor-pointer hover:underline flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors">
                      <Paperclip size={12} />
                      Anexar imagem
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden" 
                        onChange={handleImageUpload} 
                      />
                    </label>
                  )}
                </div>

                {editingImages.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum anexo ou imagem armazenada para esta tarefa.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {editingImages.map((img) => {
                      const isImg = img.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(img.objectKey);
                      return (
                        <div key={img.id} className="relative group/s3img w-full h-16 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                          {isImg ? (
                            <img 
                              src={img.url} 
                              alt="MinIO anexo" 
                              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                              onClick={() => {
                                const win = window.open();
                                win?.document.write(`
                                  <title>Visualizar Imagem MinIO</title>
                                  <body style="margin:0;display:flex;justify-content:center;align-items:center;background:#0f0f0f;font-family:sans-serif;">
                                    <img src="${img.url}" style="max-width:100%;max-height:100%;object-fit:contain;box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);" />
                                  </body>
                                `);
                              }}
                            />
                          ) : (
                            <a 
                              href={img.url} 
                              download 
                              className="w-full h-full flex flex-col items-center justify-center bg-gray-50 border rounded-lg hover:bg-gray-100 transition-colors p-2 text-center group cursor-pointer"
                              title="Clique para baixar o arquivo"
                              onClick={(e) => {
                                if (img.mimeType === 'application/pdf' || img.objectKey.endsWith('.pdf')) {
                                  e.preventDefault();
                                  window.open(img.url);
                                }
                              }}
                            >
                              <FileText size={20} className="text-gray-400 group-hover:text-[#0079bf] transition-colors" />
                              <span className="text-[8px] font-bold text-gray-500 mt-1 uppercase truncate max-w-full">
                                {img.objectKey.split('.').pop() || 'Doc'}
                              </span>
                            </a>
                          )}
                          {!isPastDay && (
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleImageDelete(img.id); }}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white p-1 rounded transition-colors backdrop-blur-xs shadow-md opacity-0 group-hover/s3img:opacity-100 z-10"
                              title="Excluir do S3"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {editingCard && (
                <div className="flex flex-col gap-1 bg-gray-50 border border-gray-100 p-3 rounded-lg mt-2 font-mono text-xs text-gray-500">
                  <div className="flex justify-between">
                     <span className="font-bold">Criado em:</span>
                     <span>{new Date(editingCard.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  {editingCard.completedAt && (
                     <div className="flex justify-between text-green-600">
                       <span className="font-bold">Concluído em:</span>
                       <span>{new Date(editingCard.completedAt).toLocaleString('pt-BR')}</span>
                     </div>
                  )}
                  {editingCard.completedAt && (
                     <div className="flex justify-between text-indigo-600">
                       <span className="font-bold">Tempo em Aberto:</span>
                       <span>{formatDuration(editingCard)}</span>
                     </div>
                  )}
                  <div className="flex justify-between">
                     <span className="font-bold">Dia de Referência:</span>
                     <span>{new Date(editingCard.dayDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}

              {editingCard && !isPastDay && (
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mover Tarefa</label>
                   <div className="flex gap-2">
                     {['OPEN', 'IN_PROGRESS', 'DONE'].filter(s => s !== editingCard.status).map(status => (
                       <button
                         key={status}
                         type="button"
                         onClick={async () => {
                           await handleMoveCardStatus(editingCard.id, status);
                           setEditingCard(null);
                         }}
                         className="px-3 py-2 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors uppercase cursor-pointer"
                       >
                         → {status === 'OPEN' ? 'A Fazer' : status === 'IN_PROGRESS' ? 'Em Progresso' : 'Concluído'}
                       </button>
                     ))}
                   </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cor do Card</label>
                <div className="flex flex-wrap gap-2">
                  {paletteColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${editColor === color ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* SEÇÃO DE ATRIBUIÇÃO COMPARTILHADA (GRUPOS) */}
              {!isPastDay && groupMembers.length > 0 && (
                <div className="border-t pt-4">
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Atribuir a Membro do Grupo</label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={assigneeId}
                      onChange={e => setAssigneeId(e.target.value)}
                      className="flex-1 border rounded-lg p-2 text-xs text-gray-700 bg-gray-50/50 focus:ring-2 focus:ring-[#0079bf] outline-none"
                    >
                      <option value="">Selecione um membro do grupo...</option>
                      {groupMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignCard}
                      disabled={assigningCard || !assigneeId}
                      className="bg-[#0079bf] hover:bg-[#005c91] text-white text-xs font-bold py-2 px-3 rounded-lg shadow-sm transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {assigningCard ? 'Enviando...' : 'Atribuir'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight">Ao atribuir, a tarefa será enviada para a Caixa de Entrada do membro. Ela sairá da sua agenda caso ele aceite.</p>
                </div>
              )}

              <div className="flex justify-between items-center mt-4">
                <button 
                  type="button" 
                  onClick={() => { 
                    handleDeleteCard(null, editingCard.id); 
                    setEditingCard(null); 
                  }} 
                  className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                >
                  <X size={16} /> Excluir Tarefa
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingCard(null)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-[#0079bf] hover:bg-[#005c91] rounded-lg transition-colors shadow-sm">Salvar Alterações</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
