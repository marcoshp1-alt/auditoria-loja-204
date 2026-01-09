
import React, { useMemo, useState } from 'react';
import { HistoryItem, UserProfile } from '../types';
import { Calendar, Store, Info, AlertTriangle, CheckCircle2, Search, X, FileSpreadsheet, Download, Sparkles, FileText, ClipboardCheck } from 'lucide-react';
import { exportWeeklySummaryToExcel } from '../services/excelService';

interface WeeklySummaryProps {
  history: HistoryItem[];
  userProfile: UserProfile | null;
  onSelectAudit: (item: HistoryItem) => void;
}

interface StoreSummary {
  loja: string;
  monday: HistoryItem | null;
  tuesday: HistoryItem | null;
  wednesday: HistoryItem | null;
  thursday: HistoryItem | null;
}

const WeeklySummary: React.FC<WeeklySummaryProps> = ({ history, userProfile, onSelectAudit }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Helper para formatar porcentagem com truncamento (sem arredondar)
  const formatTruncatedPercentage = (value: number) => {
    const truncated = Math.floor(value * 100) / 100;
    return truncated.toFixed(2);
  };

  // Cálculo do total de lojas cadastradas (Únicas, ignorando "00")
  const totalRegisteredStores = useMemo(() => {
    const uniqueStores = new Set(
      history
        .map(h => h.loja)
        .filter(loja => loja && loja !== '00')
    );
    return uniqueStores.size;
  }, [history]);

  const summaryData = useMemo(() => {
    const storesMap = new Map<string, StoreSummary>();

    // Filtramos apenas auditorias e análises (relatórios de classe não entram no consolidado semanal)
    const relevantHistory = history.filter(h => h.reportType === 'audit' || h.reportType === 'analysis');

    relevantHistory.forEach(item => {
      const lojaId = item.loja;
      
      if (!storesMap.has(lojaId)) {
        storesMap.set(lojaId, { loja: lojaId, monday: null, tuesday: null, wednesday: null, thursday: null });
      }

      const summary = storesMap.get(lojaId)!;
      const dateToUse = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
      const dayOfWeek = dateToUse.getDay();

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

    let results = Array.from(storesMap.values()).sort((a, b) => a.loja.localeCompare(b.loja));

    if (userProfile && userProfile.role !== 'admin') {
      results = results.filter(r => r.loja === userProfile.loja);
    }

    if (searchTerm.trim()) {
      results = results.filter(r => r.loja.includes(searchTerm.trim().toUpperCase()));
    }

    return results;
  }, [history, userProfile, searchTerm]);

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
    const isAnalysis = item?.reportType === 'analysis';

    return (
      <div 
        onClick={() => item && onSelectAudit(item)}
        className={`flex flex-col p-4 rounded-2xl border-2 transition-all group/card relative ${
          item 
            ? `${getStatusColor(item.stats.generalPartial)} cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95` 
            : 'bg-slate-50/50 border-slate-100 grayscale opacity-60'
        }`}
      >
        {item && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
             <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase border shadow-sm ${
               isAnalysis ? 'bg-purple-600 text-white border-purple-700' : 'bg-blue-600 text-white border-blue-700'
             }`}>
               {isAnalysis ? 'ANL' : 'AUD'}
             </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xl font-black">
              {item ? `${formatTruncatedPercentage(item.stats.generalPartial)}%` : '--'}
            </span>
            {isAnalysis && (
              <span className="text-[7px] font-black uppercase tracking-widest opacity-50 -mt-1">Relatório Geral</span>
            )}
          </div>
          {item && isAnalysis ? (
            <Sparkles className="w-5 h-5 text-purple-400 opacity-60" />
          ) : item && item.stats.generalPartial <= 3 ? (
            <CheckCircle2 className="w-5 h-5 opacity-60" />
          ) : item && item.stats.generalPartial > 3 ? (
            <AlertTriangle className="w-5 h-5 opacity-60" />
          ) : (
            <Calendar className="w-5 h-5 opacity-20" />
          )}
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] font-bold truncate opacity-60">
            {item ? new Date(item.timestamp).toLocaleDateString('pt-BR') : 'Pendente'}
          </span>
          {item && (
            <span className="text-[8px] font-black uppercase tracking-tighter opacity-0 group-hover/card:opacity-100 transition-opacity">
              Abrir {isAnalysis ? 'Análise' : 'Auditoria'}
            </span>
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
              <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
                RESUMO SEMANAL
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 uppercase tracking-wider">
                  {totalRegisteredStores} Lojas Cadastradas
                </span>
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">•</span>
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Sincronizado com Análises Gerais</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar loja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-black placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest"
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
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-black text-white px-6 py-3.5 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shrink-0"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Exportar por Dias
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">AUD = Auditoria Parcial</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-600" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">ANL = Análise Geral (Prioritário)</span>
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
        <div className="grid grid-cols-1 gap-8">
          {summaryData.map((summary) => (
            <div key={summary.loja} className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 p-8 overflow-hidden relative group transition-all hover:border-emerald-200">
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -mr-10 -mt-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
              
              <div className="flex items-center gap-4 mb-8 relative">
                <div className="bg-emerald-600 p-4 rounded-3xl shadow-lg shadow-emerald-100 transition-transform group-hover:rotate-6">
                  <Store className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight">LOJA {summary.loja}</h3>
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Painel de Performance Semanal</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
                {renderDayItem("Segunda - Etiqueta", summary.monday)}
                {renderDayItem("Terça - Presença", summary.tuesday)}
                {renderDayItem("Quarta - Ruptura", summary.wednesday)}
                {renderDayItem("Quinta - Etiqueta", summary.thursday)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeeklySummary;
