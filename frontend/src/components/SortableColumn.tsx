import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableKanbanCard } from './SortableKanbanCard';

export function SortableColumn({ id, title, cards, isPastDay, handleOpenEditModal, formatDuration, handleMoveCardStatus, children, headerAction }: any) {
  const { setNodeRef } = useDroppable({
    id,
    data: {
      type: 'Column',
    },
  });

  return (
    <div 
      className="flex-1 bg-[#F4F5F7] hover:bg-[#EBECF0] transition-colors rounded-lg flex flex-col min-w-[200px] xl:min-w-[140px] h-full overflow-hidden group/col relative"
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between p-3 pb-2 bg-[#F4F5F7] group-hover/col:bg-[#EBECF0] transition-colors z-10 w-full shrink-0 rounded-t-lg">
        <h4 className="text-[11px] font-bold text-gray-600 uppercase px-1 leading-none">{title}</h4>
        {headerAction && (
          <div className="shrink-0 ml-2 relative z-20">
            {headerAction}
          </div>
        )}
      </div>
      
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-2 custom-scrollbar">
        <SortableContext items={cards.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card: any) => (
            <SortableKanbanCard 
              key={card.id} 
              card={card} 
              isPastDay={isPastDay} 
              handleOpenEditModal={handleOpenEditModal} 
              formatDuration={formatDuration} 
              handleMoveCardStatus={handleMoveCardStatus}
            />
          ))}
        </SortableContext>
      </div>
      {(children) && (
        <div className="mt-auto shrink-0 z-10 bg-[#F4F5F7] group-hover/col:bg-[#EBECF0] transition-colors px-2 pb-2 pt-1 w-full">
          {children}
        </div>
      )}
    </div>
  );
}
