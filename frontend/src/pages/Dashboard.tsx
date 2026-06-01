import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import ReportCalendar from '../components/ReportCalendar';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  PlusCircle,
  Percent,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  TrendingUp,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface DashboardMetrics {
  totalCreated: number;
  totalCompleted: number;
  completionRate: number;
  averageCompletionTimeHours: number;
}

interface WeeklyData {
  name: string;
  Criadas: number;
  Concluídas: number;
}

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
  date: string;
  reports: ReportItem[];
}

interface DashboardResponse {
  month: string;
  metrics: DashboardMetrics;
  weeklyChart: WeeklyData[];
  reportsByDate: ReportsByDateEntry[];
}

interface SelectedReportState {
  report: ReportItem;
  date: string;
}

function getVersionLabel(version: number, reportType: string) {
  if (version === 3 || reportType === 'AUTOMATIC') return { label: 'V3 — Automático (23:59)', color: 'var(--report-v3-color)', bg: 'var(--report-v3-bg)' };
  if (version === 2) return { label: 'V2 — Relatório IA Manual', color: 'var(--report-v2-color)', bg: 'var(--report-v2-bg)' };
  return { label: 'V1 — Relatório IA Manual', color: 'var(--report-v1-color)', bg: 'var(--report-v1-bg)' };
}

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7);
  });

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<SelectedReportState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/dashboard?month=${month}`);
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data', err);
      setError(err?.response?.data?.error || 'Erro ao carregar dados do dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(currentMonth);
  }, [currentMonth, fetchDashboardData]);

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2, 1);
    setCurrentMonth(newDate.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month, 1);
    setCurrentMonth(newDate.toISOString().slice(0, 7));
  };

  const formatLongMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleGenerateReport = async (date: string) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      await api.post(`/reports/generate/${date}`);
      // Refresh dashboard data to show new report badge
      await fetchDashboardData(currentMonth);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao gerar relatório.';
      setGenerateError(msg);
      setTimeout(() => setGenerateError(null), 5000);
    } finally {
      setGenerating(false);
    }
  };

  // Helper to compute maximum weekly value for graph scaling
  const getMaxWeeklyValue = () => {
    if (!data?.weeklyChart) return 1;
    let max = 1;
    data.weeklyChart.forEach(w => {
      if (w.Criadas > max) max = w.Criadas;
      if (w.Concluídas > max) max = w.Concluídas;
    });
    return max;
  };

  const maxWeeklyVal = getMaxWeeklyValue();

  return (
    <div className="p-4 md:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50">
      
      {/* Header section with Year/Month controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 flex items-center gap-2">
            <BarChart3 style={{ color: 'var(--color-primary)' }} className="w-8 h-8" />
            Dashboard Mensal
          </h1>
          <p className="text-sm text-slate-500 mt-1">Monitore sua produtividade diária, metas e relatórios resumidos.</p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <button 
            onClick={handlePrevMonth}
            className="p-2 text-slate-600 hover:text-[var(--color-primary)] hover:bg-slate-100 rounded-lg transition-colors"
            title="Mês Anterior"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="relative px-3 font-semibold text-slate-800 capitalize text-sm min-w-[150px] text-center">
            {formatLongMonth(currentMonth)}
            <input 
              type="month" 
              value={currentMonth}
              onChange={(e) => e.target.value && setCurrentMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          <button 
            onClick={handleNextMonth}
            className="p-2 text-slate-600 hover:text-[var(--color-primary)] hover:bg-slate-100 rounded-lg transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Generate Error Banner */}
      {generateError && (
        <div className="mb-4 bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-sm animate-fade-in">
          <AlertCircle size={16} className="shrink-0" />
          {generateError}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 h-[400px]">
          <div className="w-10 h-10 border-4 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm mt-4">Compilando métricas das tarefas...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 border border-red-200 p-6 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold">Ocorreu um erro</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6 w-full max-w-7xl animate-fade-in">
          
          {/* Bento-grid of 4 High-contrast metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            {/* Created Cards */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-blue-100 hover:shadow-md transition-all duration-300 group">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Criadas</span>
                <span className="text-2xl md:text-3xl font-extrabold text-slate-800 mt-2">{data.metrics.totalCreated}</span>
                <span className="text-[11px] text-slate-500 mt-1">Adicionadas ao Kanban</span>
              </div>
              <div className="p-3.5 bg-blue-50 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                <PlusCircle size={24} />
              </div>
            </div>

            {/* Completed Cards */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-green-100 hover:shadow-md transition-all duration-300 group">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Concluídas</span>
                <span className="text-2xl md:text-3xl font-extrabold text-slate-800 mt-2">{data.metrics.totalCompleted}</span>
                <span className="text-[11px] text-slate-500 mt-1">Finalizadas com sucesso</span>
              </div>
              <div className="p-3.5 bg-green-50 text-green-500 rounded-2xl group-hover:bg-green-500 group-hover:text-white transition-all duration-300">
                <CheckCircle2 size={24} />
              </div>
            </div>

            {/* Completion Rate (%) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-emerald-100 hover:shadow-md transition-all duration-300 group">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Taxa de Conclusão</span>
                <span className="text-2xl md:text-3xl font-extrabold text-slate-800 mt-2">{data.metrics.completionRate}%</span>
                <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <TrendingUp size={12} className="text-emerald-500" />
                  Eficiência relativa do mês
                </span>
              </div>
              <div className="p-3.5 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                <Percent size={24} />
              </div>
            </div>

            {/* Average Completion Duration (Hours) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-amber-100 hover:shadow-md transition-all duration-300 group">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tempo Médio</span>
                <span className="text-2xl md:text-3xl font-extrabold text-slate-800 mt-2">
                  {data.metrics.averageCompletionTimeHours}h
                </span>
                <span className="text-[11px] text-slate-500 mt-1">Por tarefa concluída</span>
              </div>
              <div className="p-3.5 bg-amber-50 text-amber-500 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                <Clock size={24} />
              </div>
            </div>
          </div>

          {/* Main Visual Panels: Graph left, Report Calendar right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Custom interactive bars chart panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-7 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <BarChart3 size={18} className="text-slate-500" />
                  Tarefas Criadas vs. Concluídas por Semana
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Compara o fluxo de criação e fechamento no mês selecionado.</p>
              </div>

              {/* Graphical Canvas Render */}
              <div className="mt-8 flex items-stretch h-[240px] w-full">
                
                {/* Y-axis numbers */}
                <div className="flex flex-col justify-between text-[10px] font-bold text-slate-400 h-[190px] pr-3 text-right w-10 select-none pb-2 mt-1">
                  <span>{maxWeeklyVal}</span>
                  <span>{Math.round(maxWeeklyVal * 0.75)}</span>
                  <span>{Math.round(maxWeeklyVal * 0.50)}</span>
                  <span>{Math.round(maxWeeklyVal * 0.25)}</span>
                  <span>0</span>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 flex flex-col justify-between relative border-l border-b border-slate-200 pb-2 pl-3 h-[190px]">
                  
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 pr-2 pb-2">
                    <div className="w-full border-t border-slate-100/70" />
                    <div className="w-full border-t border-slate-100/70" />
                    <div className="w-full border-t border-slate-100/70" />
                    <div className="w-full border-t border-slate-100/70" />
                    <div className="w-full" />
                  </div>

                  {/* Columns */}
                  <div className="absolute inset-0 flex justify-around items-end z-10 px-2 pb-2">
                    {data.weeklyChart.map((week, idx) => {
                      const createdPercentage = (week.Criadas / maxWeeklyVal) * 100;
                      const completedPercentage = (week.Concluídas / maxWeeklyVal) * 100;

                      return (
                        <div key={idx} className="flex flex-col items-center gap-1 group/bar w-[18%] relative h-full justify-end">
                          
                          {/* Backdrop highlight on week hover */}
                          <div className="absolute inset-x-0 -inset-y-1 bg-slate-50/0 group-hover/bar:bg-slate-50/70 rounded-2xl transition-all duration-300 z-0 pointer-events-none border border-transparent group-hover/bar:border-slate-100/80" />

                          {/* Unified premium tooltip */}
                          <div className="absolute -top-24 left-1/2 -translate-x-1/2 hidden group-hover/bar:flex flex-col bg-slate-950 text-white text-[11px] p-2.5 rounded-xl shadow-xl z-30 pointer-events-none min-w-[125px] border border-slate-850/80 backdrop-blur-md transition-all">
                            <div className="font-bold text-[10px] text-slate-400 border-b border-slate-800 pb-1 mb-1.5 uppercase tracking-wider text-center">{week.name}</div>
                            <div className="flex justify-between items-center gap-4 py-0.5">
                              <span className="text-slate-400 font-medium">Criadas:</span>
                              <span className="font-bold text-sky-400">{week.Criadas}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 py-0.5">
                              <span className="text-slate-400 font-medium">Concluídas:</span>
                              <span className="font-bold text-emerald-400">{week.Concluídas}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 mt-1.5 border-t border-slate-800 pt-1">
                              <span className="text-slate-400 font-medium text-[9px]">Aproveitamento:</span>
                              <span className="font-extrabold text-amber-400 text-[10px]">
                                {week.Criadas > 0 ? Math.round((week.Concluídas / week.Criadas) * 100) : 0}%
                              </span>
                            </div>
                          </div>

                          {/* The two columns */}
                          <div className="flex items-end gap-2 w-full justify-center h-[140px] z-10">
                            
                            {/* Criadas column (Blue Gradient) */}
                            <div className="relative flex justify-center w-5 sm:w-7 h-full items-end">
                              <div 
                                style={{ height: `${Math.max(createdPercentage, 4)}%` }}
                                className="w-full bg-gradient-to-t from-blue-600 to-sky-400 hover:from-blue-700 hover:to-sky-500 transition-all duration-300 rounded-t-md cursor-pointer shadow-sm shadow-blue-500/10 hover:shadow-md hover:shadow-blue-500/20"
                              />
                            </div>

                            {/* Concluídas column (Green Gradient) */}
                            <div className="relative flex justify-center w-5 sm:w-7 h-full items-end">
                              <div 
                                style={{ height: `${Math.max(completedPercentage, 4)}%` }}
                                className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 hover:from-emerald-700 hover:to-teal-500 transition-all duration-300 rounded-t-md cursor-pointer shadow-sm shadow-emerald-500/10 hover:shadow-md hover:shadow-emerald-500/20"
                              />
                            </div>

                          </div>
                          
                          {/* Week name label */}
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-2 z-10">{week.name}</span>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

              {/* Color legend guide indicator */}
              <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-gradient-to-t from-blue-600 to-sky-400 rounded-md shadow" />
                  <span className="text-[11px] font-bold text-slate-600">Tarefas Criadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-gradient-to-t from-emerald-600 to-teal-400 rounded-md shadow" />
                  <span className="text-[11px] font-bold text-slate-600">Tarefas Concluídas</span>
                </div>
              </div>

            </div>

            {/* Report Mini-Calendar panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-5 flex flex-col">
              {generating && (
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                  Gerando relatório com IA...
                </div>
              )}
              <ReportCalendar
                reportsByDate={data.reportsByDate || []}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onSelectReport={(report, date) => setSelectedState({ report, date })}
                onGenerateReport={handleGenerateReport}
                isGenerating={generating}
              />
            </div>

          </div>

        </div>
      ) : null}

      {/* REPORT VIEWER MODAL */}
      {selectedState && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedState(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full h-[85vh] max-h-[600px] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText style={{ color: 'var(--color-primary)' }} size={20} />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-800 capitalize text-sm">
                      {new Date(selectedState.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </h3>
                    {(() => {
                      const vl = getVersionLabel(selectedState.report.version, selectedState.report.reportType);
                      return (
                        <span
                          style={{ background: vl.bg, color: vl.color }}
                          className="text-[10px] font-extrabold rounded-md px-1.5 py-0.5"
                        >
                          V{selectedState.report.version}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {getVersionLabel(selectedState.report.version, selectedState.report.reportType).label}
                    {' • '}
                    Gerado às {new Date(selectedState.report.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              
              {/* Close Button */}
              <button 
                onClick={() => setSelectedState(null)}
                className="p-2 hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Contents */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar text-slate-700 bg-white leading-relaxed">
              <p className="text-xs md:text-sm whitespace-pre-wrap font-medium">
                {selectedState.report.content}
              </p>
            </div>

            {/* Modal Action Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-3xl">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedState.report.content);
                }}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                Copiar Texto
              </button>
              <button
                onClick={() => setSelectedState(null)}
                className="px-4 py-2 text-white rounded-xl text-xs font-bold transition-all"
                style={{ background: 'var(--color-primary)' }}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
