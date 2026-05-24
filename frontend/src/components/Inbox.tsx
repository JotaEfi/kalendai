import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Inbox as InboxIcon, Bell, Mail, ArrowRight } from 'lucide-react';
import api from '../services/api';

interface Notification {
  id: string;
  userId: string;
  type: 'INFO' | 'CARD_ASSIGNMENT';
  title: string;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  cardId: string | null;
  senderId: string | null;
  createdAt: string;
  read: boolean;
}

interface InboxProps {
  onClose: () => void;
  onNotificationsCountChange: (count: number) => void;
}

export default function Inbox({ onClose, onNotificationsCountChange }: InboxProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data);
      
      // Notify parent about pending unread count
      const unreadPending = res.data.filter((n: Notification) => !n.read || n.status === 'PENDING').length;
      onNotificationsCountChange(unreadPending);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      setProcessingId(id);
      await api.put(`/notifications/${id}/accept`);
      
      // Dispatch custom event to let other pages (like Calendar) reload their list
      window.dispatchEvent(new Event('tasksUpdated'));
      
      alert('Tarefa aceita com sucesso! Ela já foi integrada à sua agenda.');
      fetchNotifications();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao aceitar tarefa.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefuse = async (id: string) => {
    try {
      setProcessingId(id);
      await api.put(`/notifications/${id}/refuse`);
      
      // Dispatch custom event to let other pages reload
      window.dispatchEvent(new Event('tasksUpdated'));
      
      alert('Tarefa recusada. O proprietário original foi notificado.');
      fetchNotifications();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao recusar tarefa.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-[#DFE1E6] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* HEADER DA INBOX */}
      <div className="p-6 border-b border-[#DFE1E6] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-sky-50 text-[#0079bf] rounded-lg flex items-center justify-center">
            <Bell size={18} />
          </div>
          <span className="font-bold text-lg text-gray-800">Minha Caixa de Entrada</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* LISTA DE NOTIFICAÇÕES */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm font-medium">Carregando notificações...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center border border-dashed border-gray-200">
              <InboxIcon className="text-gray-300" size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Sua Inbox está vazia!</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto leading-normal">Quando outros membros atribuírem tarefas a você, elas aparecerão aqui.</p>
            </div>
          </div>
        ) : (
          notifications.map(notif => {
            const isPending = notif.status === 'PENDING';
            const isAssignment = notif.type === 'CARD_ASSIGNMENT';

            return (
              <div 
                key={notif.id} 
                className={`bg-white border rounded-2xl p-4 shadow-sm border-l-4 transition-all ${
                  notif.read ? 'border-gray-200 border-l-gray-300 opacity-75' : 'border-gray-200 border-l-[#0079bf] hover:shadow-md'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5 leading-none">
                      {isAssignment ? <Mail size={14} className="text-[#0079bf]" /> : <AlertCircle size={14} className="text-amber-500" />}
                      {notif.title}
                    </span>
                    <span className="text-[9px] text-gray-400 font-medium">
                      {new Date(notif.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-normal text-left">{notif.message}</p>

                  {/* FLUXO DE AÇÕES PENDENTES PARA ATRIBUIÇÃO */}
                  {isAssignment && isPending ? (
                    <div className="flex gap-2.5 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleRefuse(notif.id)}
                        disabled={processingId !== null}
                        className="flex-1 text-center py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => handleAccept(notif.id)}
                        disabled={processingId !== null}
                        className="flex-1 bg-[#0079bf] hover:bg-[#0079bf]/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50 py-1.5"
                      >
                        <Check size={14} />
                        Aceitar
                      </button>
                    </div>
                  ) : (
                    // OUTRAS NOTIFICAÇÕES (INFO OU CONCLUÍDAS)
                    !notif.read && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-[10px] font-bold text-[#0079bf] hover:underline flex items-center gap-0.5"
                        >
                          Marcar como lida <ArrowRight size={10} />
                        </button>
                      </div>
                    )
                  )}

                  {/* INDICADORES DE ATRIBUIÇÃO JÁ CONCLUÍDA */}
                  {isAssignment && !isPending && (
                    <div className="mt-2 text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <Check size={12} className={notif.status === 'ACCEPTED' ? 'text-emerald-500' : 'text-rose-500'} />
                      Tarefa {notif.status === 'ACCEPTED' ? 'Aceita' : 'Recusada'}
                    </div>
                  )}

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
