
import React, { useMemo, useState } from 'react';
import { HistoryItem, UserProfile } from '../types';
import { Calendar, Store, Info, AlertTriangle, CheckCircle2, Search, X, FileSpreadsheet, Download, Sparkles, FileText, ClipboardCheck, RefreshCcw, LayoutGrid, Trophy, Medal } from 'lucide-react';
import { exportWeeklySummaryToExcel } from '../services/excelService';

interface WeeklySummaryProps {
  history: HistoryItem[];
  userProfile: UserProfile | null;
  allProfiles: UserProfile[];
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

interface MonthlyStoreSummary {
  loja: string;
  weeks: {
    weekLabel: string;
    etiquetaFinal: { value: number; monday: number; thursday: number } | null;
    rupturaFinal: HistoryItem | null;
    weekRange: { start: Date; end: Date };
  }[];
  monthlyAverageEtiqueta: number | null;
  monthlyAverageRuptura: number | null;
}

const WeeklySummary: React.FC<WeeklySummaryProps> = ({ history, userProfile, allProfiles, selectedDate, onSelectAudit, onDateChange, onImportFinalRupture }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [isCompactView, setIsCompactView] = useState(false);
  const [rankingGroup, setRankingGroup] = useState<any>(null);

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

  const getWeeksOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const weeks: { start: Date; end: Date; label: string }[] = [];

    // Encontrar a primeira segunda-feira do mês
    // Começamos do dia 1 e vamos até encontrar uma segunda-feira que esteja dentro do mês
    // OU se a primeira semana do mês começar no mês anterior mas a segunda for neste mês...
    // REGRA: "A primeira semana do mês deve ser definida pela primeira segunda feira do mês"

    let current = new Date(year, month, 1, 12, 0, 0); // Começa no dia 1 ao meio dia para evitar problemas de fuso

    // Ajustar para a primeira segunda-feira DIA >= 1
    // Se hoje não é segunda (1), avança até ser
    while (current.getDay() !== 1) {
      current.setDate(current.getDate() + 1);
    }
    // Se avançamos para o próximo mês procurando a segunda, então esse mês não tem semanas (caso impossível mas...)

    // Gerar semanas enquanto a segunda-feira ainda estiver dentro do mês
    let weekCount = 1;
    while (current.getMonth() === month && current.getFullYear() === year) {
      // Segunda-feira
      const monday = new Date(current);

      // Quinta-feira (Fim da semana de auditoria)
      const thursday = new Date(monday);
      thursday.setDate(monday.getDate() + 3);

      weeks.push({
        start: monday,
        end: thursday,
        label: `Semana ${weekCount}`
      });

      // Avançar para a próxima segunda
      current.setDate(current.getDate() + 7);
      weekCount++;
    }

    return weeks;
  };

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const monthWeeks = useMemo(() => selectedDate ? getWeeksOfMonth(new Date(selectedDate + 'T12:00:00')) : getWeeksOfMonth(new Date()), [selectedDate]);

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
  }, [history, userProfile, searchTerm, weekRange, viewMode, monthWeeks]);

  // Cálculos para o Modo Mensal
  const monthlyDataResult = useMemo(() => {
    if (viewMode !== 'monthly') return { results: [], totalRegisteredStores: 0 };

    const storesMap = new Map<string, MonthlyStoreSummary>();

    // Precisamos iterar por TODAS as semanas calculadas para o mês
    monthWeeks.forEach((weekInfo) => {
      const weekSunday = new Date(weekInfo.start);
      weekSunday.setDate(weekSunday.getDate() - 1); // Domingo anterior à segunda

      const weekSaturday = new Date(weekInfo.start);
      weekSaturday.setDate(weekSaturday.getDate() + 5); // Sábado seguinte à segunda

      // Filtra o histórico para ESTA semana específica
      const relevantHistory = history.filter(item => {
        const itemDate = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
        return itemDate >= weekSunday && itemDate <= weekSaturday;
      });

      // Agrupa por loja para ESTA semana
      const weekStoreMap = new Map<string, { monday: HistoryItem | null; thursday: HistoryItem | null; rupture: HistoryItem | null }>();

      relevantHistory.forEach(item => {
        // Lógica de Ruptura (similar ao semanal)
        if (item.reportType === 'rupture' || item.reportType === 'final_rupture') {
          if (!weekStoreMap.has(item.loja)) {
            weekStoreMap.set(item.loja, { monday: null, thursday: null, rupture: null });
          }
          const storeData = weekStoreMap.get(item.loja)!;
          if (!storeData.rupture || item.timestamp > storeData.rupture.timestamp) {
            storeData.rupture = item;
          }
          return;
        }

        if (item.reportType !== 'audit' && item.reportType !== 'analysis') return;

        const dateToUse = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
        const dayOfWeek = dateToUse.getDay();

        if (!weekStoreMap.has(item.loja)) {
          weekStoreMap.set(item.loja, { monday: null, thursday: null, rupture: null });
        }
        const storeWeekData = weekStoreMap.get(item.loja)!;

        // Simplificação: Pegar o mais recente de audit/analysis para Seg e Qui
        if (dayOfWeek === 1) { // Segunda
          if (!storeWeekData.monday || item.timestamp > storeWeekData.monday.timestamp) storeWeekData.monday = item;
        } else if (dayOfWeek === 4) { // Quinta
          if (!storeWeekData.thursday || item.timestamp > storeWeekData.thursday.timestamp) storeWeekData.thursday = item;
        }
      });

      // Agora consolida isso no MonthlyStoreSummary
      weekStoreMap.forEach((data, lojaId) => {
        if (!storesMap.has(lojaId)) {
          storesMap.set(lojaId, {
            loja: lojaId,
            weeks: monthWeeks.map(w => ({
              weekLabel: w.label,
              etiquetaFinal: null,
              rupturaFinal: null,
              weekRange: { start: w.start, end: w.end }
            })),
            monthlyAverageEtiqueta: null,
            monthlyAverageRuptura: null
          });
        }

        const storeMonthly = storesMap.get(lojaId)!;
        // Encontrar o slot da semana atual
        const weekSlot = storeMonthly.weeks.find(w => w.weekLabel === weekInfo.label);

        if (weekSlot) {
          // Etiqueta
          if (data.monday && data.thursday) {
            const avg = (data.monday.stats.generalPartial + data.thursday.stats.generalPartial) / 2;
            weekSlot.etiquetaFinal = {
              value: avg,
              monday: data.monday.stats.generalPartial,
              thursday: data.thursday.stats.generalPartial
            };
          }
          // Ruptura
          if (data.rupture) {
            weekSlot.rupturaFinal = data.rupture;
          }
        }
      });
    });

    let results = Array.from(storesMap.values()).sort((a, b) => a.loja.localeCompare(b.loja));

    // Filtros de Usuario e Busca
    if (userProfile && userProfile.role !== 'admin') {
      results = results.filter(r => r.loja === userProfile.loja);
    }
    if (searchTerm.trim()) {
      results = results.filter(r => r.loja.includes(searchTerm.trim().toUpperCase()));
    }

    // Calcular médias mensais
    results.forEach(res => {
      // Média Etiqueta
      const validWeeksEtiqueta = res.weeks.filter(w => w.etiquetaFinal !== null);
      if (validWeeksEtiqueta.length > 0) {
        const sum = validWeeksEtiqueta.reduce((acc, curr) => acc + curr.etiquetaFinal!.value, 0);
        res.monthlyAverageEtiqueta = sum / validWeeksEtiqueta.length;
      }

      // Média Ruptura
      const validWeeksRuptura = res.weeks.filter(w => w.rupturaFinal !== null);
      if (validWeeksRuptura.length > 0) {
        // Assumindo que queremos a média do generalPartial da ruptura
        const sum = validWeeksRuptura.reduce((acc, curr) => acc + curr.rupturaFinal!.stats.generalPartial, 0);
        res.monthlyAverageRuptura = sum / validWeeksRuptura.length;
      }
    });

    return { results, totalRegisteredStores: results.length }; // Approx total stores
  }, [history, userProfile, searchTerm, monthWeeks, viewMode]);

  const { results: summaryData, totalRegisteredStores } = viewMode === 'weekly' ? summaryDataResult : { results: [], totalRegisteredStores: 0 };
  const { results: monthlyData } = monthlyDataResult;

  // Mapeamento centralizado de Lojas para Regionais
  const lojaToRegion = useMemo(() => {
    const map = new Map<string, string>();
    allProfiles.forEach(p => {
      if (p.loja) map.set(p.loja, p.regional || 'NE 2');
    });
    // Fallback para a própria loja do usuário logado
    if (userProfile?.loja) {
      map.set(userProfile.loja, userProfile.regional || 'NE 2');
    }
    return map;
  }, [allProfiles, userProfile]);

  // Agrupamento Semanal por Regional
  const groupedWeeklyData = useMemo(() => {
    if (viewMode !== 'weekly') return [];

    const groups = new Map<string, typeof summaryData>();
    summaryData.forEach(item => {
      const region = lojaToRegion.get(item.loja) || 'NE 2';
      if (!groups.has(region)) groups.set(region, []);
      groups.get(region)!.push(item);
    });

    return Array.from(groups.entries())
      .map(([region, stores]) => ({ region, stores }))
      .sort((a, b) => a.region.localeCompare(b.region));
  }, [summaryData, viewMode, lojaToRegion]);

  // Agrupamento Mensal por Regional
  const groupedMonthlyData = useMemo(() => {
    if (viewMode !== 'monthly') return [];

    const groups = new Map<string, typeof monthlyData>();
    monthlyData.forEach(item => {
      const region = lojaToRegion.get(item.loja) || 'NE 2';
      if (!groups.has(region)) groups.set(region, []);
      groups.get(region)!.push(item);
    });

    return Array.from(groups.entries())
      .map(([region, stores]) => ({ region, stores }))
      .sort((a, b) => a.region.localeCompare(b.region));
  }, [monthlyData, viewMode, lojaToRegion]);

  // Consolidados por Regional (Cards do Topo)
  const regionalSummaries = useMemo(() => {
    // Agora disponível para todos para permitir ver a média da própria regional
    if (!userProfile) return [];

    const regionMap = new Map<string, {
      region: string,
      storesCount: number,
      etiquetaSum: number,
      etiquetaCount: number,
      rupturaSum: number,
      rupturaCount: number
    }>();

    // Seleciona a fonte de dados baseada no modo de visualização
    const sourceData = viewMode === 'weekly' ? summaryData : monthlyData;

    sourceData.forEach((res: any) => {
      const region = lojaToRegion.get(res.loja) || 'NE 2';
      if (!regionMap.has(region)) {
        regionMap.set(region, {
          region,
          storesCount: 0,
          etiquetaSum: 0,
          etiquetaCount: 0,
          rupturaSum: 0,
          rupturaCount: 0
        });
      }
      const reg = regionMap.get(region)!;
      reg.storesCount++;

      if (viewMode === 'weekly') {
        if (res.etiquetaFinal) {
          reg.etiquetaSum += res.etiquetaFinal.value;
          reg.etiquetaCount++;
        }
        if (res.rupture) {
          reg.rupturaSum += res.rupture.stats.generalPartial;
          reg.rupturaCount++;
        }
      } else {
        if (res.monthlyAverageEtiqueta !== null) {
          reg.etiquetaSum += res.monthlyAverageEtiqueta;
          reg.etiquetaCount++;
        }
        if (res.monthlyAverageRuptura !== null) {
          reg.rupturaSum += res.monthlyAverageRuptura;
          reg.rupturaCount++;
        }
      }
    });

    return Array.from(regionMap.values()).map(r => ({
      region: r.region,
      storesCount: r.storesCount,
      avgEtiqueta: r.etiquetaCount > 0 ? r.etiquetaSum / r.etiquetaCount : null,
      avgRuptura: r.rupturaCount > 0 ? r.rupturaSum / r.rupturaCount : null
    })).sort((a, b) => a.region.localeCompare(b.region));
  }, [summaryData, monthlyData, userProfile, viewMode, lojaToRegion]);


  const handleExport = () => {
    exportWeeklySummaryToExcel(summaryData);
  };

  const getStatusColor = (percentage: number | undefined) => {
    if (percentage === undefined) return 'text-slate-300 bg-slate-50 border-slate-100';
    if (percentage > 3) return 'text-red-600 bg-red-50 border-red-100';
    if (percentage > 2.5) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  // Helper para formatar data igual ao histórico (com hora)
  const getDisplayDate = (item: HistoryItem) => {
    if (item.customDate) {
      const parts = item.customDate.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
      }
    }
    return new Date(item.timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', ' às');
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
            {item ? getDisplayDate(item) : 'Pendente'}
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
    <>
      <div className="space-y-6 animate-in fade-in duration-700">
        {/* Cabeçalho com Busca, Contador e Exportação */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-100 shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                  {viewMode === 'weekly' ? 'Resumo Semanal' : 'Resumo Mensal'}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {viewMode === 'weekly' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black bg-emerald-50 text-emerald-700 uppercase border border-emerald-100">
                      Semana de {weekRange.sunday.toLocaleDateString('pt-BR')} a {weekRange.saturday.toLocaleDateString('pt-BR')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black bg-emerald-50 text-emerald-700 uppercase border border-emerald-100">
                      Mês de {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Atual'}
                    </span>
                  )}
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest leading-none mt-0.5">•</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black bg-blue-50 text-blue-700 uppercase border border-blue-100">
                    {viewMode === 'weekly' ? `${totalRegisteredStores} Lojas na Semana` : `${monthlyData.length} Lojas no Mês`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 flex-1 lg:max-w-2xl lg:justify-end">
              <div className="flex-1 relative group min-w-[200px]">
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

              <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setViewMode('weekly')}
                  className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'weekly'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  Semanal
                </button>
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'monthly'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  Mensal
                </button>
              </div>

              <button
                onClick={() => setIsCompactView(!isCompactView)}
                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-[9px] tracking-widest uppercase transition-all shadow-xl active:scale-95 shrink-0 ${isCompactView
                  ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700'
                  : 'bg-white text-slate-600 border border-slate-200 shadow-slate-100 hover:border-emerald-200 hover:text-emerald-600'
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                {isCompactView ? 'Visão Detalhada' : 'Visão Compacta'}
              </button>

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

          {/* Linha Independente: Cartões Consolidados por Regional (Admin Only) */}
          {regionalSummaries.length > 0 && (
            <div className="w-full pt-4 border-t border-slate-100 animate-in slide-in-from-top-4 duration-500">
              <div className="flex flex-wrap gap-4">
                {regionalSummaries.map(reg => (
                  <div key={reg.region} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-3 group hover:border-blue-200 transition-all w-fit min-w-[240px]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-100 shrink-0">
                          <LayoutGrid className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight truncate">{reg.region}</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase shrink-0">{reg.storesCount} Lojas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-2 rounded-xl border-2 flex flex-col gap-1 ${reg.avgEtiqueta !== null ? getStatusColor(reg.avgEtiqueta) : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                        <span className="text-[8px] font-black uppercase opacity-60">Média Etiqueta</span>
                        <span className="text-base font-black leading-none">{reg.avgEtiqueta !== null ? `${formatTruncatedPercentage(reg.avgEtiqueta)}%` : '--'}</span>
                      </div>
                      <div className={`p-2 rounded-xl border-2 flex flex-col gap-1 ${reg.avgRuptura !== null ? getStatusColor(reg.avgRuptura) : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                        <span className="text-[8px] font-black uppercase opacity-60">Média Ruptura</span>
                        <span className="text-base font-black leading-none">{reg.avgRuptura !== null ? `${formatTruncatedPercentage(reg.avgRuptura)}%` : '--'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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



        {
          viewMode === 'monthly' ? (
            // RENDERIZAÇÃO MODO MENSAL
            groupedMonthlyData.length === 0 ? (
              <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 py-32 text-center">
                {/* Empty State Mensal reuse or custom */}
                <div className="bg-slate-50 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                  <Store className="w-12 h-12 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Nenhum Dado Mensal</h3>
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest px-8">
                  Não existem auditorias completas (Seg+Qui) para gerar o resumo deste mês.
                </p>
              </div>
            ) : (
              <div className="space-y-12">
                {groupedMonthlyData.map((group, index) => (
                  <div key={group.region} className="space-y-6">
                    {index > 0 && <div className="pt-12 border-t-2 border-slate-200/60 mb-8" />}
                    <div className="flex items-center gap-4 px-2">
                      <div className="h-px flex-1 bg-slate-200" />
                      <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                        <LayoutGrid className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{group.region}</span>
                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-100 text-slate-400">{group.stores.length} LOJAS</span>
                        <button
                          onClick={() => setRankingGroup(group)}
                          className="ml-2 bg-amber-500 hover:bg-amber-600 p-1.5 rounded-xl transition-all shadow-lg shadow-amber-200 group/rank"
                          title="Ver Ranking Regional"
                        >
                          <Trophy className="w-3.5 h-3.5 text-white group-hover/rank:rotate-12 transition-transform" />
                        </button>
                      </div>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <div className={isCompactView ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3" : "grid grid-cols-1 gap-4"}>
                      {group.stores.map((store) => (
                        isCompactView ? (
                          // CARD COMPACTO MENSAL
                          <div key={store.loja} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 hover:border-emerald-200 transition-all group relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-12 h-12 bg-emerald-50 rounded-bl-3xl -mr-4 -mt-4 opacity-40" />

                            <div className="flex flex-col gap-2 relative z-10">
                              <div className="flex items-center gap-2">
                                <div className="bg-emerald-600 p-1.5 rounded-lg">
                                  <Store className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-sm font-black text-slate-800">L{store.loja}</span>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Etiq.</span>
                                  <span className={`text-[10px] font-black ${store.monthlyAverageEtiqueta ? getStatusColor(store.monthlyAverageEtiqueta).split(' ')[0] : 'text-slate-300'}`}>
                                    {store.monthlyAverageEtiqueta ? `${formatTruncatedPercentage(store.monthlyAverageEtiqueta)}%` : '--'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Rupt.</span>
                                  <span className={`text-[10px] font-black ${store.monthlyAverageRuptura ? getStatusColor(store.monthlyAverageRuptura).split(' ')[0] : 'text-slate-300'}`}>
                                    {store.monthlyAverageRuptura ? `${formatTruncatedPercentage(store.monthlyAverageRuptura)}%` : '--'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // CARD DETALHADO MENSAL (Existente)
                          <div key={store.loja} className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/40 py-4 px-6 overflow-hidden relative group transition-all hover:border-emerald-200">
                            {/* ... Resto do card detalhado ... */}
                            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -mr-10 -mt-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />

                            <div className="flex items-center gap-3 mb-6 relative">
                              <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-100 transition-transform group-hover:rotate-6">
                                <Store className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">LOJA {store.loja}</h3>
                                <p className="text-slate-400 font-black text-[9px] uppercase tracking-[0.2em]">Painel de Performance Mensal</p>
                              </div>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-8 relative items-stretch">
                              {/* Seção Semanas */}
                              <div className="flex-1 flex flex-col">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center justify-center gap-2 h-5">
                                  Períodos Semanais
                                </div>
                                <div className={`p-2 border-2 border-transparent grid grid-cols-2 md:grid-cols-${Math.min(store.weeks.length, 5)} gap-2 flex-1`}>
                                  {store.weeks.map((week, idx) => {
                                    // Determinar a cor de fundo do cartão com base na Etiqueta
                                    const bgColorClass = week.etiquetaFinal
                                      ? getStatusColor(week.etiquetaFinal.value).split(' ')[1] // Pega o bg-*
                                      : 'bg-slate-50/50';

                                    const borderColorClass = week.etiquetaFinal
                                      ? getStatusColor(week.etiquetaFinal.value).split(' ')[2] // Pega o border-*
                                      : 'border-slate-100';

                                    return (
                                      <div
                                        key={idx}
                                        onClick={() => {
                                          if (onDateChange) {
                                            onDateChange(week.weekRange.start.toISOString().split('T')[0]);
                                            setViewMode('weekly');
                                          }
                                        }}
                                        className={`flex flex-col h-full py-2 px-3 rounded-xl border-2 transition-all relative cursor-pointer hover:scale-[1.02] active:scale-95 ${week.etiquetaFinal || week.rupturaFinal
                                          ? `${bgColorClass} ${borderColorClass} shadow-sm`
                                          : 'bg-slate-50/50 border-slate-100 grayscale opacity-60'
                                          }`}>
                                        <span className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-2 block text-center border-b border-slate-100/50 pb-1">{week.weekLabel}</span>

                                        <div className="flex flex-col gap-2 flex-1 justify-center">
                                          {/* Etiqueta */}
                                          <div className="flex items-center justify-between">
                                            <span className="text-[8px] font-bold text-slate-500 uppercase">Etiq.</span>
                                            <span className={`text-sm font-black ${week.etiquetaFinal ? getStatusColor(week.etiquetaFinal.value).split(' ')[0] : 'text-slate-300'}`}>
                                              {week.etiquetaFinal ? `${formatTruncatedPercentage(week.etiquetaFinal.value)}%` : '--'}
                                            </span>
                                          </div>

                                          {/* Ruptura */}
                                          <div className="flex items-center justify-between">
                                            <span className="text-[8px] font-bold text-slate-500 uppercase">Rupt.</span>
                                            <span className={`text-sm font-black ${week.rupturaFinal ? getStatusColor(week.rupturaFinal.stats.generalPartial).split(' ')[0] : 'text-slate-300'}`}>
                                              {week.rupturaFinal ? `${formatTruncatedPercentage(week.rupturaFinal.stats.generalPartial)}%` : '--'}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="pt-1 border-t border-slate-100/50 mt-2 text-center">
                                          <span className="text-[7px] font-bold truncate opacity-60 block">
                                            {week.weekRange.start.getDate()}/{week.weekRange.start.getMonth() + 1} - {week.weekRange.end.getDate()}/{week.weekRange.end.getMonth() + 1}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Seção Média Final Mensal */}
                              <div className="lg:w-[320px] flex flex-col">
                                <div className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-1 flex items-center justify-center gap-2 h-5">
                                  Resultados Acumulados
                                </div>
                                <div className="flex flex-col gap-3 flex-1">
                                  {/* Acumulado Etiqueta */}
                                  <div className={`p-3 rounded-2xl border-2 flex-1 flex items-center justify-between relative overflow-hidden group/acc ${store.monthlyAverageEtiqueta
                                    ? getStatusColor(store.monthlyAverageEtiqueta).replace('text-', 'text-slate-700 data-text-').replace('bg-', 'bg-').replace('border-', 'border-')
                                    : 'bg-slate-50 border-slate-100'}`}>
                                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-full -mr-8 -mt-8 blur-xl opacity-0 group-hover/acc:opacity-100 transition-opacity ${store.monthlyAverageEtiqueta ? getStatusColor(store.monthlyAverageEtiqueta).split(' ')[1].replace('bg-', 'bg-') : 'bg-slate-200'}`} />
                                    <div className="relative z-10 flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Acumulado Etiqueta</span>
                                      <span className="text-[8px] font-bold opacity-50">Média das Semanas</span>
                                    </div>
                                    <span className={`relative z-10 text-2xl font-black ${store.monthlyAverageEtiqueta ? getStatusColor(store.monthlyAverageEtiqueta).split(' ')[0] : 'text-slate-300'}`}>
                                      {store.monthlyAverageEtiqueta ? `${formatTruncatedPercentage(store.monthlyAverageEtiqueta)}%` : '--%'}
                                    </span>
                                  </div>

                                  {/* Acumulado Ruptura */}
                                  <div className={`p-3 rounded-2xl border-2 flex-1 flex items-center justify-between relative overflow-hidden group/acc ${store.monthlyAverageRuptura
                                    ? getStatusColor(store.monthlyAverageRuptura).replace('text-', 'text-slate-700 data-text-').replace('bg-', 'bg-').replace('border-', 'border-')
                                    : 'bg-slate-50 border-slate-100'}`}>
                                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-full -mr-8 -mt-8 blur-xl opacity-0 group-hover/acc:opacity-100 transition-opacity ${store.monthlyAverageRuptura ? getStatusColor(store.monthlyAverageRuptura).split(' ')[1].replace('bg-', 'bg-') : 'bg-slate-200'}`} />
                                    <div className="relative z-10 flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Acumulado Ruptura</span>
                                      <span className="text-[8px] font-bold opacity-50">Média das Semanas</span>
                                    </div>
                                    <span className={`relative z-10 text-2xl font-black ${store.monthlyAverageRuptura ? getStatusColor(store.monthlyAverageRuptura).split(' ')[0] : 'text-slate-300'}`}>
                                      {store.monthlyAverageRuptura ? `${formatTruncatedPercentage(store.monthlyAverageRuptura)}%` : '--%'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            groupedWeeklyData.length === 0 ? (
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
              <div className="space-y-12">
                {groupedWeeklyData.map((group, index) => (
                  <div key={group.region} className="space-y-6">
                    {index > 0 && <div className="pt-12 border-t-2 border-slate-200/60 mb-8" />}
                    <div className="flex items-center gap-4 px-2">
                      <div className="h-px flex-1 bg-slate-200" />
                      <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                        <LayoutGrid className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{group.region}</span>
                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-100 text-slate-400">{group.stores.length} LOJAS</span>
                        <button
                          onClick={() => setRankingGroup(group)}
                          className="ml-2 bg-amber-500 hover:bg-amber-600 p-1.5 rounded-xl transition-all shadow-lg shadow-amber-200 group/rank"
                          title="Ver Ranking Regional"
                        >
                          <Trophy className="w-3.5 h-3.5 text-white group-hover/rank:rotate-12 transition-transform" />
                        </button>
                      </div>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <div className={isCompactView ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3" : "grid grid-cols-1 gap-4"}>
                      {group.stores.map((summary) => (
                        isCompactView ? (
                          // CARD COMPACTO SEMANAL
                          <div key={summary.loja} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 hover:border-emerald-200 transition-all group relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-12 h-12 bg-emerald-50 rounded-bl-3xl -mr-4 -mt-4 opacity-40" />

                            <div className="flex flex-col gap-2 relative z-10">
                              <div className="flex items-center gap-2">
                                <div className="bg-emerald-600 p-1.5 rounded-lg">
                                  <Store className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-sm font-black text-slate-800">L{summary.loja}</span>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Etiq.</span>
                                  <span className={`text-[10px] font-black ${summary.etiquetaFinal ? getStatusColor(summary.etiquetaFinal.value).split(' ')[0] : 'text-slate-300'}`}>
                                    {summary.etiquetaFinal ? `${formatTruncatedPercentage(summary.etiquetaFinal.value)}%` : '--'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Rupt.</span>
                                  <span className={`text-[10px] font-black ${summary.rupture ? getStatusColor(summary.rupture.stats.generalPartial).split(' ')[0] : 'text-slate-300'}`}>
                                    {summary.rupture ? `${formatTruncatedPercentage(summary.rupture.stats.generalPartial)}%` : '--'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // CARD DETALHADO SEMANAL (Existente)
                          <div key={summary.loja} className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/40 py-4 px-6 overflow-hidden relative group transition-all hover:border-emerald-200">
                            {/* ... Resto do card detalhado semanal ... */}
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
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center justify-center gap-2 h-5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  Auditorias Diárias (Seg a Qui)
                                </div>
                                <div className="p-2 border-2 border-transparent grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-2 flex-1">
                                  {renderDayItem("Segunda - Etiqueta", summary.monday)}
                                  {renderDayItem("Terça - Presença", summary.tuesday)}
                                  {renderDayItem("Quarta - Ruptura", summary.wednesday)}
                                  {renderDayItem("Quinta - Etiqueta", summary.thursday)}
                                </div>
                              </div>

                              {/* Seção Resultados Finais */}
                              <div className="lg:w-[400px] xl:w-[450px] flex flex-col group/section">
                                <div className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-1 flex items-center justify-center gap-2 h-5 group-hover/section:scale-105 transition-transform duration-300">
                                  <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                                  Resultado Final da Semana
                                </div>
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
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )
        }

      </div >

      {/* MODAL DE RANKING REGIONAL */}
      {rankingGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRankingGroup(null)} />

          <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-100">
            {/* Header do Ranking */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Trophy className="w-32 h-32" />
              </div>

              <button
                onClick={() => setRankingGroup(null)}
                className="absolute top-6 right-6 p-2 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-2">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/30">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Ranking {viewMode === 'weekly' ? 'Semanal' : 'Mensal'}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/70">REGIONAL {rankingGroup.region}</p>
                </div>
              </div>
            </div>

            {/* Lista do Ranking */}
            <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50/30">
              <div className="space-y-3">
                {[...rankingGroup.stores]
                  .sort((a, b) => {
                    // Ordenar por Etiqueta (DESC) e depois Ruptura (ASC)
                    const etiqA = a.monthlyAverageEtiqueta ?? a.etiquetaFinal?.value ?? 0;
                    const etiqB = b.monthlyAverageEtiqueta ?? b.etiquetaFinal?.value ?? 0;
                    if (etiqB !== etiqA) return etiqB - etiqA;

                    const ruptA = a.monthlyAverageRuptura ?? a.rupture?.stats.generalPartial ?? 100;
                    const ruptB = b.monthlyAverageRuptura ?? b.rupture?.stats.generalPartial ?? 100;
                    return ruptA - ruptB;
                  })
                  .map((store, idx) => {
                    const isTop3 = idx < 3;
                    const medals = [
                      { color: 'text-amber-400', bg: 'bg-amber-50', border: 'border-amber-100' },
                      { color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' },
                      { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' }
                    ];

                    return (
                      <div
                        key={store.loja}
                        className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${isTop3 ? `${medals[idx].bg} ${medals[idx].border} border-2` : 'bg-white border-slate-100 shadow-sm'
                          }`}
                      >
                        {/* Posição */}
                        <div className="flex flex-col items-center justify-center min-w-[40px]">
                          {isTop3 ? (
                            <Medal className={`w-6 h-6 ${medals[idx].color}`} />
                          ) : (
                            <span className="text-lg font-black text-slate-300">#{idx + 1}</span>
                          )}
                        </div>

                        {/* Loja Info */}
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-slate-800 uppercase">Loja {store.loja}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Performance {viewMode === 'weekly' ? 'Semanal' : 'Mensal'}</p>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-4 items-center">
                          <div className="text-right">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter">Etiqueta</span>
                            <span className={`text-sm font-black ${(store.monthlyAverageEtiqueta ?? store.etiquetaFinal?.value) ? getStatusColor(store.monthlyAverageEtiqueta ?? store.etiquetaFinal?.value).split(' ')[0] : 'text-slate-300'}`}>
                              {(store.monthlyAverageEtiqueta ?? store.etiquetaFinal?.value) ? `${formatTruncatedPercentage(store.monthlyAverageEtiqueta ?? store.etiquetaFinal?.value)}%` : '--'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter">Ruptura</span>
                            <span className={`text-sm font-black ${(store.monthlyAverageRuptura ?? store.rupture?.stats.generalPartial) ? getStatusColor(store.monthlyAverageRuptura ?? store.rupture?.stats.generalPartial).split(' ')[0] : 'text-slate-300'}`}>
                              {(store.monthlyAverageRuptura ?? store.rupture?.stats.generalPartial) ? `${formatTruncatedPercentage(store.monthlyAverageRuptura ?? store.rupture?.stats.generalPartial)}%` : '--'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-white border-t border-slate-100 flex justify-center">
              <button
                onClick={() => setRankingGroup(null)}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Fechar Ranking
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WeeklySummary;
