
import React, { useMemo, useState } from 'react';
import { HistoryItem, UserProfile } from '../types';
import { Calendar, Store, Info, AlertTriangle, CheckCircle2, Search, X, FileSpreadsheet, Download, Sparkles, FileText, ClipboardCheck, RefreshCcw } from 'lucide-react';
import { exportWeeklySummaryToExcel } from '../services/excelService';

interface WeeklySummaryProps {
  history: HistoryItem[];
  userProfile: UserProfile | null;
  selectedDate: string | null;
  onSelectAudit: (item: HistoryItem) => void;
  onDateChange?: (date: string) => void;
  onImportFinalRupture?: (file: File, date: string | null) => void;
}

interface StoreSummary {
  loja: string;
  monday: HistoryItem | null;
  tuesday: HistoryItem | null;
  wednesday: HistoryItem | null;
  thursday: HistoryItem | null;
  rupture: HistoryItem | null;
  etiquetaFinal: { value: number; monday: number; thursday: number } | null;
}

const WeeklySummary: React.FC<WeeklySummaryProps> = ({ history, userProfile, selectedDate, onSelectAudit, onDateChange, onImportFinalRupture }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Função para obter o intervalo da semana (Domingo a Sábado) da data de referência
  const getWeekRange = (dateStr: string | null) => {
    const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const day = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);
    sunday.setHours(0, 0, 0, 0);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    return { sunday, saturday };
  };

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Helper para formatar porcentagem com truncamento (sem arredondar)
  const formatTruncatedPercentage = (value: number) => {
    const truncated = Math.floor(value * 100) / 100;
    return truncated.toFixed(2);
  };


  const summaryDataResult = useMemo(() => {
    const storesMap = new Map<string, StoreSummary>();

    // Processamos todo o histórico, mas filtramos o que é relevante dentro do loop
    const relevantHistory = history.filter(item => {
      const itemDate = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
      return itemDate >= weekRange.sunday && itemDate <= weekRange.saturday;
    });

    relevantHistory.forEach(item => {
      const lojaId = item.loja;

      if (!storesMap.has(lojaId)) {
        storesMap.set(lojaId, {
          loja: lojaId, monday: null, tuesday: null, wednesday: null, thursday: null,
          rupture: null, etiquetaFinal: null
        });
      }

      const summary = storesMap.get(lojaId)!;

      // 1. Lógica para Ruptura Final (Prioridade máxima e independente de dia)
      if (item.reportType === 'rupture' || item.reportType === 'final_rupture') {
        if (!summary.rupture || item.timestamp > summary.rupture.timestamp) {
          summary.rupture = item;
        }
        return;
      }

      // 2. Filtro agressivo para os dias da semana (apenas Auditoria e Análise)
      if (item.reportType !== 'audit' && item.reportType !== 'analysis') return;

      const dateToUse = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
      const dayOfWeek = dateToUse.getDay();
      // ... rest of day key logic ...

      const dayKey = dayOfWeek === 1 ? 'monday' :
        dayOfWeek === 2 ? 'tuesday' :
          dayOfWeek === 3 ? 'wednesday' :
            dayOfWeek === 4 ? 'thursday' : null;

      if (dayKey) {
        const currentSelected = summary[dayKey];

        // LÓGICA DE PRIORIDADE:
        // 1. Se não há nada selecionado, seleciona este.
        // 2. Se o novo é 'analysis' e o atual é 'audit', o novo substitui (prioridade de análise).
        // 3. Se ambos são do mesmo tipo, o mais recente (maior timestamp) substitui.

        if (!currentSelected) {
          summary[dayKey] = item;
        } else {
          const isNewAnalysis = item.reportType === 'analysis';
          const isCurrentAnalysis = currentSelected.reportType === 'analysis';

          if (isNewAnalysis && !isCurrentAnalysis) {
            // Nova análise substitui auditoria parcial anterior
            summary[dayKey] = item;
          } else if (item.reportType === currentSelected.reportType) {
            // Se são do mesmo tipo, pegamos o mais recente postado
            if (item.timestamp > currentSelected.timestamp) {
              summary[dayKey] = item;
            }
          }
        }
      }
    });

    storesMap.forEach(summary => {
      if (summary.monday && summary.thursday) {
        const avg = (summary.monday.stats.generalPartial + summary.thursday.stats.generalPartial) / 2;
        summary.etiquetaFinal = {
          value: avg,
          monday: summary.monday.stats.generalPartial,
          thursday: summary.thursday.stats.generalPartial
        };
      }
    });

    let results = Array.from(storesMap.values()).sort((a, b) => a.loja.localeCompare(b.loja));

    if (userProfile && userProfile.role !== 'admin') {
      results = results.filter(r => r.loja === userProfile.loja);
    }

    if (searchTerm.trim()) {
      results = results.filter(r => r.loja.includes(searchTerm.trim().toUpperCase()));
    }

    const totalRegisteredStores = new Set(
      relevantHistory
        .map(h => h.loja)
        .filter(loja => loja && loja !== '00')
    ).size;

    return { results, totalRegisteredStores };
  }, [history, userProfile, searchTerm, weekRange]);

  const { results: summaryData, totalRegisteredStores } = summaryDataResult;

  const handleExport = () => {
    exportWeeklySummaryToExcel(summaryData);
  };

  const getStatusColor = (percentage: number | undefined) => {
    if (percentage === undefined) return 'text-slate-300 bg-slate-50 border-slate-100';
    if (percentage > 3) return 'text-red-600 bg-red-50 border-red-100';
    if (percentage > 2.5) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  const renderDayItem = (label: string, item: HistoryItem | null) => {
    const isAnalysis = item?.reportType === 'analysis' || item?.reportType === 'final_rupture' || item?.reportType === 'rupture';

    return (
      <div
        onClick={() => item && onSelectAudit(item)}
        className={`flex flex-col h-full py-1.5 px-3 rounded-xl border-2 transition-all group/card relative ${item
          ? `${getStatusColor(item.stats.generalPartial)} cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-95`
          : 'bg-slate-50/50 border-slate-100 grayscale opacity-60'
          }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-black leading-tight">
              {item ? `${formatTruncatedPercentage(item.stats.generalPartial)}%` : '--'}
            </span>
            {isAnalysis && (
              <span className="text-[6px] font-black uppercase tracking-widest opacity-50 -mt-0.5">
                {item?.reportType === 'rupture' || item?.reportType === 'final_rupture' ? 'Relatório Análise' : 'Relatório Geral'}
              </span>
            )}
          </div>
          {item && isAnalysis ? (
            <Sparkles className="w-4 h-4 text-purple-400 opacity-60" />
          ) : item && item.stats.generalPartial <= 3 ? (
            <CheckCircle2 className="w-4 h-4 opacity-60" />
          ) : item && item.stats.generalPartial > 3 ? (
            <AlertTriangle className="w-4 h-4 opacity-60" />
          ) : (
            <Calendar className="w-4 h-4 opacity-20" />
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100/50 mt-1">
          <span className="text-[9px] font-bold truncate opacity-60">
            {item ? new Date(item.timestamp).toLocaleDateString('pt-BR') : 'Pendente'}
          </span>
          {item && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[7px] font-black uppercase tracking-tighter text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded opacity-0 group-hover/card:opacity-100 transition-all transform translate-y-2 group-hover/card:translate-y-0">
                Abrir {isAnalysis ? 'Análise' : 'Auditoria'}
              </span>
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase border shadow-sm ${isAnalysis ? 'bg-purple-600 text-white border-purple-700' : 'bg-blue-600 text-white border-blue-700'
                }`}>
                {isAnalysis ? 'Análise' : 'Auditoria'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Cabeçalho com Busca, Contador e Exportação */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-100">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Resumo Semanal</h2>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black bg-emerald-50 text-emerald-700 uppercase border border-emerald-100">
                  Semana de {weekRange.sunday.toLocaleDateString('pt-BR')} a {weekRange.saturday.toLocaleDateString('pt-BR')}
                </span>
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">•</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black bg-blue-50 text-blue-700 uppercase border border-blue-100">
                  {totalRegisteredStores} Lojas na Semana
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
              <input
                type="text"
                placeholder="Pesquisar loja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-[9px] placeholder:font-black placeholder:uppercase placeholder:tracking-widest"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>



            <button
              onClick={handleExport}
              disabled={summaryData.length === 0}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-black text-white px-5 py-3 rounded-2xl font-black text-[9px] tracking-widest uppercase transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Auditoria Parcial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-600" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Análise Geral (Prioritário)</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 hidden md:block" />
          <div className="hidden md:flex items-center gap-3">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
              O sistema prioriza automaticamente relatórios de Análise Geral quando disponíveis.
            </span>
          </div>
        </div>
      </div>

      {summaryData.length === 0 ? (
        <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 py-32 text-center">
          <div className="bg-slate-50 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-6">
            <Store className="w-12 h-12 text-slate-200" />
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Nenhum Registro Encontrado</h3>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest px-8">
            {searchTerm
              ? `Não encontramos resultados para a loja "${searchTerm}".`
              : "Aguardando importação de planilhas para gerar o resumo."}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-6 text-emerald-600 font-black uppercase text-[10px] tracking-widest border-b-2 border-emerald-100 hover:border-emerald-600 transition-all"
            >
              Limpar Filtros de Busca
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {summaryData.map((summary) => (
            <div key={summary.loja} className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/40 py-4 px-6 overflow-hidden relative group transition-all hover:border-emerald-200">
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -mr-10 -mt-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />

              <div className="flex items-center gap-3 mb-0 relative">
                <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-100 transition-transform group-hover:rotate-6">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">LOJA {summary.loja}</h3>
                  <p className="text-slate-400 font-black text-[9px] uppercase tracking-[0.2em]">Painel de Performance Semanal</p>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 relative items-stretch">
                {/* Seção Auditorias Diárias */}
                <div className="flex-1 flex flex-col">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center justify-center gap-2 h-5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    Auditorias Diárias (Seg a Qui)
                  </p>
                  <div className="p-2 border-2 border-transparent grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-2 flex-1">
                    {renderDayItem("Segunda - Etiqueta", summary.monday)}
                    {renderDayItem("Terça - Presença", summary.tuesday)}
                    {renderDayItem("Quarta - Ruptura", summary.wednesday)}
                    {renderDayItem("Quinta - Etiqueta", summary.thursday)}
                  </div>
                </div>

                {/* Seção Resultados Finais */}
                <div className="lg:w-[400px] xl:w-[450px] flex flex-col group/section">
                  <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-1 flex items-center justify-center gap-2 h-5 group-hover/section:scale-105 transition-transform duration-300">
                    <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                    Resultado Final da Semana
                  </p>
                  <div className="p-2 bg-gradient-to-br from-slate-100 to-purple-100/30 rounded-[20px] border-2 border-purple-200 shadow-lg shadow-purple-500/10 relative overflow-hidden group/final flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 transition-all duration-300 hover:border-purple-300 hover:shadow-purple-500/15">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full -mr-20 -mt-20 blur-3xl opacity-50 transition-opacity group-hover/final:opacity-100" />

                    {/* Card Etiqueta Final */}
                    <div className={`flex flex-col h-full py-1.5 px-3 rounded-xl border-2 transition-all relative ${summary.etiquetaFinal
                      ? `${getStatusColor(summary.etiquetaFinal.value)} bg-white shadow-md shadow-slate-200/50 opacity-100`
                      : 'bg-white/50 border-slate-100 grayscale opacity-60'
                      }`}>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Etiqueta Final</span>
                      <div className="flex flex-col items-start flex-1 py-1">
                        <span className="text-xl font-black leading-tight">
                          {summary.etiquetaFinal ? `${summary.etiquetaFinal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '--%'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100/50 mt-1">
                        <span className="text-[9px] font-bold truncate opacity-60">
                          {summary.etiquetaFinal ? weekRange.saturday.toLocaleDateString('pt-BR') : 'Pendente'}
                        </span>
                        {summary.etiquetaFinal && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[7px] font-black uppercase tracking-tighter text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                              Abrir Análise
                            </span>
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-md uppercase border shadow-sm bg-purple-600 text-white border-purple-700">
                              Análise
                            </span>
                          </div>
                        )}
                      </div>
                      {!summary.etiquetaFinal && <ClipboardCheck className="absolute bottom-4 right-4 w-5 h-5 opacity-20" />}
                    </div>

                    {/* Card Ruptura Final */}
                    {(() => {
                      const item = summary.rupture;
                      const canEdit = userProfile?.role === 'admin' || (userProfile?.role === 'user' && userProfile?.loja === summary.loja);

                      if (item) {
                        return renderDayItem("Ruptura Final", item);
                      }

                      return (
                        <div
                          onClick={() => canEdit && document.getElementById(`file-final-${summary.loja}`)?.click()}
                          className={`flex flex-col h-full py-2 px-4 rounded-xl border-2 transition-all relative group/card border-dashed ${canEdit ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/30' : 'opacity-40'
                            } bg-white/50 border-slate-100 grayscale`}
                        >
                          <input
                            type="file"
                            id={`file-final-${summary.loja}`}
                            className="hidden"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && onImportFinalRupture) {
                                let targetDate = '';

                                // 1. Tentar pegar a data real da auditoria de 'Quarta - Ruptura'
                                if (summary.wednesday) {
                                  const refDate = summary.wednesday.customDate
                                    ? new Date(summary.wednesday.customDate + 'T12:00:00')
                                    : new Date(summary.wednesday.timestamp);
                                  targetDate = refDate.toISOString().split('T')[0];
                                } else {
                                  // 2. Fallback: Calcular a data de quarta-feira da semana selecionada
                                  const ruptureDate = new Date(weekRange.sunday);
                                  ruptureDate.setDate(weekRange.sunday.getDate() + 3);
                                  targetDate = ruptureDate.toISOString().split('T')[0];
                                }

                                onImportFinalRupture(file, targetDate);
                                e.target.value = ''; // Reset para permitir reimportar o mesmo arquivo se necessário
                              }
                            }}
                          />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Ruptura Final</span>
                          <div className="flex items-center justify-between flex-1 py-0.5">
                            <span className="text-lg font-black text-slate-300">Pendente</span>
                            {canEdit && <FileSpreadsheet className="w-4 h-4 text-blue-400 group-hover/card:scale-110 transition-transform" />}
                          </div>
                          <div className="mt-1">
                            <span className="text-[8px] font-bold opacity-40 uppercase tracking-tighter">
                              {canEdit ? 'Importar Planilha' : 'Aguardando'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeeklySummary;
