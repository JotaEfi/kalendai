import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pen, Paperclip, X } from 'lucide-react';

export function KanbanCardUI({ card, isPastDay, handleOpenEditModal, formatDuration, dragRef, style, attributes, listeners, isDragging, handleMoveCardStatus }: any) {
  const isDone = card.status === 'DONE';
  const isOpen = card.status === 'OPEN';
  const isProgress = card.status === 'IN_PROGRESS';
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  let hasAttachments = false;
  try {
     hasAttachments = card.attachments && JSON.parse(card.attachments).length > 0;
  } catch(e) {}

  return (
    <div className="relative group">
      <div
        ref={dragRef}
        style={{ borderColor: card.color, ...style }}
        {...attributes}
        {...listeners}
        onClick={() => handleOpenEditModal(card)}
        className={`flex flex-col gap-1.5 bg-white rounded p-3 shadow-sm border-l-4 relative transition-all duration-200 ${!isPastDay ? 'cursor-grab hover:bg-gray-50' : ''} ${isDone ? 'opacity-80' : ''} ${isDragging ? 'opacity-30' : ''}`}
      >
        <div className="flex justify-between items-start gap-2">
          <p className={`text-sm font-bold leading-tight ${isDone ? 'line-through text-gray-500' : 'text-gray-800'}`}>{card.title}</p>
          {!isPastDay && (
            <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(card); }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#0079bf] transition-opacity shrink-0 relative z-10">
              <Pen size={14} />
            </button>
          )}
        </div>
        
        {card.description && (
          <p className={`text-xs line-clamp-3 leading-relaxed ${isDone ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{card.description}</p>
        )}

        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {hasAttachments && (
             <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold bg-gray-50 w-[max-content] px-1.5 py-0.5 rounded" title="Possui anexo">
               <Paperclip size={12} /> Anexos
             </div>
          )}
          {isDone && formatDuration(card) && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold bg-gray-50 w-[max-content] px-1.5 py-0.5 rounded">
              <span>{formatDuration(card)}</span>
            </div>
          )}
          {card.isRolledOver && !isDone && (
            <div className="text-[10px] text-red-600 font-bold bg-amber-100 w-[max-content] px-1.5 py-0.5 rounded shadow-sm border border-amber-200">
              Rolado {Math.max(1, Math.floor((new Date(card.dayDate).getTime() - new Date(card.originalDayDate || card.dayDate).getTime()) / (1000 * 60 * 60 * 24)))}x
            </div>
          )}
        </div>

        {/* MinIO S3 Image Thumbnails */}
        {card.images && card.images.length > 0 && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {card.images.map((img: any) => (
              <div 
                key={img.id} 
                className="relative cursor-pointer group/thumb hover:scale-105 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxUrl(img.url);
                }}
              >
                <img 
                  src={img.url} 
                  alt="Task upload" 
                  className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-xs"
                />
              </div>
            ))}
          </div>
        )}

      </div>

      {/* LIGHTBOX COMPONENT POPUP */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[999] flex items-center justify-center p-4 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxUrl(null);
          }}
        >
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <img 
              src={lightboxUrl} 
              alt="Imagens Kanban" 
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-zoom-in" 
            />
            <button 
              className="absolute -top-12 right-0 text-white hover:text-slate-300 font-bold text-xs bg-black/50 hover:bg-black/70 px-4 py-2 rounded-xl border border-white/10 transition-all flex items-center gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxUrl(null);
              }}
            >
              Fechar <X size={14} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export function SortableKanbanCard({ card, isPastDay, handleOpenEditModal, formatDuration, handleMoveCardStatus }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'Task',
      card,
    },
    disabled: isPastDay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <KanbanCardUI 
      card={card} 
      isPastDay={isPastDay} 
      handleOpenEditModal={handleOpenEditModal} 
      formatDuration={formatDuration} 
      dragRef={setNodeRef} 
      style={style} 
      attributes={attributes} 
      listeners={listeners} 
      isDragging={isDragging}
      handleMoveCardStatus={handleMoveCardStatus}
    />
  );
}
