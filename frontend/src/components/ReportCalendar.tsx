import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface ReportItem {
  id: string;
  version: number;
  reportType: string;
  isAutomatic: boolean;
  generatedAt: string;
  contentPreview: string;
  content: string;
}

interface ReportsByDateEntry {
  date: string; // YYYY-MM-DD
  reports: ReportItem[];
}

interface ReportCalendarProps {
  reportsByDate: ReportsByDateEntry[];
  currentMonth: string; // YYYY-MM
  onMonthChange?: (month: string) => void;
  onSelectReport: (report: ReportItem, date: string) => void;
  onGenerateReport?: (date: string) => void;
}

function getVersionBadge(version: number, reportType: string) {
  if (version === 3 || reportType === 'AUTOMATIC') {
    return { label: 'V3', bg: 'var(--report-v3-bg)', color: 'var(--report-v3-color)', title: 'Relatório Automático (23:59)' };
  }
  if (version === 2) {
    return { label: 'V2', bg: 'var(--report-v2-bg)', color: 'var(--report-v2-color)', title: 'Relatório IA Manual #2' };
  }
  return { label: 'V1', bg: 'var(--report-v1-bg)', color: 'var(--report-v1-color)', title: 'Relatório IA Manual #1' };
}

export default function ReportCalendar({
  reportsByDate,
  currentMonth,
  onMonthChange,
  onSelectReport,
  onGenerateReport
}: ReportCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [year, month] = currentMonth.split('-').map(Number);

  // Build a map for quick lookup
  const reportMap: Record<string, ReportItem[]> = {};
  for (const entry of reportsByDate) {
    reportMap[entry.date] = entry.reports;
  }

  // Build calendar days grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay(); // 0 = Sunday
  const totalDays = lastDay.getDate();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const handlePrev = () => {
    if (!onMonthChange) return;
    const d = new Date(year, month - 2, 1);
    onMonthChange(d.toISOString().slice(0, 7));
  };
  const handleNext = () => {
    if (!onMonthChange) return;
    const d = new Date(year, month, 1);
    onMonthChange(d.toISOString().slice(0, 7));
  };

  const monthLabel = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const selectedReports = selectedDate ? (reportMap[selectedDate] || []) : [];

  // Days grid — pad with empty cells
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-0">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
          <FileText size={16} className="text-slate-400" />
          Relatórios por Dia
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold text-slate-600 capitalize min-w-[110px] text-center">{monthLabel}</span>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="bg-white h-[52px]" />;

          const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayReports = reportMap[dayStr] || [];
          const isToday = dayStr === todayStr;
          const isSelected = dayStr === selectedDate;
          const hasSomething = dayReports.length > 0;

          return (
            <button
              key={dayStr}
              onClick={() => setSelectedDate(isSelected ? null : dayStr)}
              className={[
                'bg-white h-[52px] flex flex-col items-center justify-start pt-1.5 gap-0.5 transition-all duration-150 relative',
                isSelected ? 'bg-blue-50 ring-2 ring-inset ring-[var(--color-primary)]' : 'hover:bg-slate-50',
              ].join(' ')}
              title={hasSomething ? `${dayReports.length} relatório(s) em ${dayStr}` : `Sem relatórios em ${dayStr}`}
            >
              <span className={[
                'text-[11px] font-bold leading-none',
                isToday ? 'w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px]' : 'text-slate-600',
                isSelected && !isToday ? 'text-[var(--color-primary)]' : '',
              ].join(' ')}>
                {isToday ? (
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                    {day}
                  </span>
                ) : day}
              </span>

              {/* Version badges */}
              {dayReports.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                  {dayReports.map((r) => {
                    const badge = getVersionBadge(r.version, r.reportType);
                    return (
                      <span
                        key={r.id}
                        style={{ background: badge.bg, color: badge.color }}
                        className="text-[8px] font-extrabold rounded px-[3px] py-[1px] leading-none"
                        title={badge.title}
                      >
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Panel */}
      {selectedDate && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
            {onGenerateReport && selectedReports.filter(r => r.reportType !== 'AUTOMATIC').length < 2 && (
              <button
                onClick={() => onGenerateReport(selectedDate)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
              >
                + Gerar Relatório IA
              </button>
            )}
          </div>

          {selectedReports.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">Nenhum relatório neste dia.</p>
              {onGenerateReport && (
                <button
                  onClick={() => onGenerateReport(selectedDate)}
                  className="mt-2 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                  Gerar Primeiro Relatório
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {selectedReports.map((report) => {
                const badge = getVersionBadge(report.version, report.reportType);
                return (
                  <button
                    key={report.id}
                    onClick={() => onSelectReport(report, selectedDate)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-150 text-left transition-all group"
                  >
                    <span
                      style={{ background: badge.bg, color: badge.color }}
                      className="text-[10px] font-extrabold rounded-md px-1.5 py-0.5 shrink-0"
                    >
                      {badge.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">{badge.title}</p>
                      <p className="text-[10px] text-slate-400 truncate">{report.contentPreview}</p>
                    </div>
                    <span className="text-[10px] text-slate-300 group-hover:text-[var(--color-primary)] transition-colors shrink-0">
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 justify-center flex-wrap">
        {[
          { label: 'V1', bg: 'var(--report-v1-bg)', color: 'var(--report-v1-color)', desc: 'IA Manual' },
          { label: 'V2', bg: 'var(--report-v2-bg)', color: 'var(--report-v2-color)', desc: 'IA Manual' },
          { label: 'V3', bg: 'var(--report-v3-bg)', color: 'var(--report-v3-color)', desc: 'Automático' },
        ].map(({ label, bg, color, desc }) => (
          <div key={label} className="flex items-center gap-1">
            <span style={{ background: bg, color }} className="text-[9px] font-extrabold rounded px-[4px] py-[2px]">{label}</span>
            <span className="text-[10px] text-slate-400">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
