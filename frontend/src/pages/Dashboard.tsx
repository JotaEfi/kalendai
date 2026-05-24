import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  Percent, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  FileText, 
  Eye, 
  X, 
  TrendingUp,
  AlertCircle
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

interface ReportData {
  id: string;
  date: string;
  isAutomatic: boolean;
  generatedAt: string;
  contentPreview: string;
  content: string;
}

interface DashboardResponse {
  month: string;
  metrics: DashboardMetrics;
  weeklyChart: WeeklyData[];
  latestReports: ReportData[];
}

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7); // e.g. YYYY-MM
  });

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);

  const fetchDashboardData = async (month: string) => {
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
  };

  useEffect(() => {
    fetchDashboardData(currentMonth);
  }, [currentMonth]);

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
            <BarChart3 className="text-[#0079bf] w-8 h-8" />
            Dashboard Mensal
          </h1>
          <p className="text-sm text-slate-500 mt-1">Monitore sua produtividade diária, metas e relatórios resumidos.</p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <button 
            onClick={handlePrevMonth}
            className="p-2 text-slate-600 hover:text-[#0079bf] hover:bg-slate-100 rounded-lg transition-colors"
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
            className="p-2 text-slate-600 hover:text-[#0079bf] hover:bg-slate-100 rounded-lg transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 h-[400px]">
          <div className="w-10 h-10 border-4 border-[#0079bf]/30 border-t-[#0079bf] rounded-full animate-spin"></div>
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

          {/* Main Visual Panels: Graph left, Last Reports right */}
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
              <div className="mt-8 flex flex-col justify-end h-[240px] w-full">
                {/* Visual horizontal y-axis grids container */}
                <div className="flex-1 flex flex-col justify-between relative border-l border-b border-slate-200 pb-2 pl-3">
                  
                  {/* Map bars side-by-side */}
                  <div className="absolute inset-0 flex justify-around items-end pt-3 z-10 px-2">
                    {data.weeklyChart.map((week, idx) => {
                      const createdPercentage = (week.Criadas / maxWeeklyVal) * 100;
                      const completedPercentage = (week.Concluídas / maxWeeklyVal) * 100;

                      return (
                        <div key={idx} className="flex flex-col items-center gap-1 group/bar w-[18%]">
                          <div className="flex items-end gap-2 w-full justify-center h-[180px]">
                            
                            {/* Criadas column (Blue) */}
                            <div className="relative flex justify-center w-5 sm:w-7 group/tip">
                              <div 
                                style={{ height: `${Math.max(createdPercentage, 4)}%` }}
                                className="w-full bg-[#0079bf]/80 hover:bg-[#0079bf] transition-all duration-500 rounded-t-md cursor-pointer shadow-sm shadow-[#0079bf]/20"
                              />
                              {/* Tooltip */}
                              <span className="hidden group-hover/bar:block absolute -top-8 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-md shadow-lg z-20 whitespace-nowrap leading-none">
                                {week.Criadas} Criadas
                              </span>
                            </div>

                            {/* Concluidas column (Green) */}
                            <div className="relative flex justify-center w-5 sm:w-7">
                              <div 
                                style={{ height: `${Math.max(completedPercentage, 4)}%` }}
                                className="w-full bg-emerald-500/80 hover:bg-emerald-500 transition-all duration-500 rounded-t-md cursor-pointer shadow-sm shadow-emerald-500/20"
                              />
                              {/* Tooltip */}
                              <span className="hidden group-hover/bar:block absolute -top-12 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-md shadow-lg z-20 whitespace-nowrap leading-none">
                                {week.Concluídas} Concluídas
                              </span>
                            </div>

                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-2">{week.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Horizontal grid guide lines */}
                  <div className="w-full border-t border-slate-100 opacity-50 h-0" />
                  <div className="w-full border-t border-slate-100 opacity-50 h-0" />
                  <div className="w-full border-t border-slate-100 opacity-50 h-0" />
                  <div className="w-full border-t border-slate-100 opacity-50 h-0" />

                </div>
              </div>

              {/* Color legend guide indicator */}
              <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-[#0079bf] rounded-md shadow" />
                  <span className="text-[11px] font-bold text-slate-600">Tarefas Criadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-emerald-500 rounded-md shadow" />
                  <span className="text-[11px] font-bold text-slate-600">Tarefas Concluídas</span>
                </div>
              </div>

            </div>

            {/* Reports index block pane */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-5 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <FileText size={18} className="text-slate-500" />
                  Histórico de Relatórios AI
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Os últimos 5 sumários gerados do seu Kanban.</p>
              </div>

              <div className="mt-6 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[250px] pr-1 scrollbar-thin">
                {data.latestReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Calendar className="text-slate-300 w-10 h-10 mb-2" />
                    <p className="text-slate-500 text-xs">Nenhum relatório AI gravado recentemente.</p>
                  </div>
                ) : (
                  data.latestReports.map((report) => {
                    const parsedDate = new Date(report.date + 'T00:00:00');
                    return (
                      <div 
                        key={report.id} 
                        className="p-3 border border-slate-150 rounded-xl bg-slate-50 hover:bg-slate-100/50 hover:border-[#0079bf]/30 transition-all duration-200 flex justify-between items-center group/item"
                      >
                        <div className="min-w-0 pr-3">
                          <h4 className="font-bold text-slate-700 text-xs truncate capitalize">
                            {parsedDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{report.contentPreview}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedReport(report)}
                          className="p-2 bg-white border border-slate-200 hover:border-[#0079bf] text-slate-600 hover:text-[#0079bf] rounded-xl shadow-xs transition-all duration-200 group-hover/item:scale-105 shrink-0"
                          title="Visualizar Relatório"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Atualizado recentemente</span>
                <span>UTC</span>
              </div>
            </div>

          </div>

        </div>
      ) : null}

      {/* LIGHTBOX MODAL DIALOG POP-UP: Visualizer for any selected report */}
      {selectedReport && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full h-[85vh] max-h-[600px] shadow-2xl flex flex-col overflow-hidden animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="text-[#0079bf]" size={20} />
                <div>
                  <h3 className="font-extrabold text-slate-800 capitalize text-sm">
                    Relatório do Dia — {new Date(selectedReport.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">IA {selectedReport.isAutomatic ? 'Automática' : 'Manual'} • Gerado em {new Date(selectedReport.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              
              {/* Close Button */}
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Contents */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar text-slate-700 bg-white leading-relaxed">
              <p className="text-xs md:text-sm whitespace-pre-wrap font-medium">
                {selectedReport.content}
              </p>
            </div>

            {/* Modal Action Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-3xl">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedReport.content);
                }}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                Copiar Texto
              </button>
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-[#0079bf] hover:bg-[#0079bf]/95 text-white rounded-xl text-xs font-bold transition-all"
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
