
import React, { useMemo } from 'react';
import { AuditRow } from '../types';
import { Package, EyeOff, Activity, AlertCircle, Eye, CheckCircle, Info, Loader2, Users, AlertTriangle } from 'lucide-react';

interface SummaryStatsProps {
  data: AuditRow[];
  isAnalysis?: boolean;
  isClassReport?: boolean;
  categoryStats?: {
    semEstoque: number;
    desatualizado: number;
    naoLidoComEstoque: number;
    semPresencaComEstoque: number;
  };
  collaboratorStats?: { [name: string]: number };
  selectedCategory?: string | null;
  onCategoryClick?: (category: string) => void;
  onCollaboratorClick?: () => void;
  isCollaboratorView?: boolean;
  overrideStats?: {
    totalSku: number;
    totalNotRead: number;
    totalOutdated?: number;
    generalPartial: number;
    isSyncing?: boolean;
  };
  forceDesktopLayout?: boolean;
}

const SummaryStats: React.FC<SummaryStatsProps> = ({
  data,
  isAnalysis = false,
  isClassReport = false,
  categoryStats,
  collaboratorStats,
  selectedCategory,
  onCategoryClick,
  onCollaboratorClick,
  isCollaboratorView,
  overrideStats,
  forceDesktopLayout = false
}) => {
  const stats = useMemo(() => {
    if (overrideStats) return overrideStats;

    const totalSku = data.reduce((acc, curr) => acc + curr.sku, 0);
    const totalNotRead = data.reduce((acc, curr) => acc + curr.notRead, 0);

    const hasOutdatedData = data.some(row => row.outdated !== undefined);
    const totalOutdated = hasOutdatedData
      ? data.reduce((acc, curr) => acc + (curr.outdated || 0), 0)
      : undefined;

    const generalPartial = totalSku > 0 ? (totalNotRead / totalSku) * 100 : 0;

    return { totalSku, totalNotRead, totalOutdated, generalPartial, isSyncing: false };
  }, [data, overrideStats]);

  const collaboratorCount = useMemo(() => {
    if (!collaboratorStats) return 0;
    return Object.keys(collaboratorStats).length;
  }, [collaboratorStats]);

  const getCardStyle = (value: number, isSyncing?: boolean) => {
    if (isSyncing) return "bg-gradient-to-br from-slate-600 to-slate-700 shadow-slate-200 animate-pulse";
    if (value > 20) return "bg-gradient-to-br from-red-800 to-red-900 shadow-red-200";
    if (value > 3) return "bg-gradient-to-br from-red-500 to-red-600 shadow-red-200";
    if (value > 2.5) return "bg-gradient-to-br from-yellow-500 to-amber-600 shadow-yellow-200";
    return "bg-gradient-to-br from-green-600 to-emerald-700 shadow-green-200";
  };

  const formatTruncatedPercentage = (value: number) => {
    const truncated = Math.floor(value * 100) / 100;
    return truncated.toFixed(2);
  };

  const shouldShowOutdatedCard = isAnalysis && typeof stats.totalOutdated === 'number';

  const mainCards = (
    <div className={`grid ${forceDesktopLayout ? (shouldShowOutdatedCard ? 'grid-cols-4 gap-12' : 'grid-cols-3 gap-12') : ('grid-cols-1 ' + (shouldShowOutdatedCard ? 'md:grid-cols-4' : 'md:grid-cols-3'))} gap-6 mb-12 w-full`}>
      {/* Total de SKU */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between group hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
        <div>
          <p className="text-sm font-black text-slate-500 uppercase tracking-wider">
            {isAnalysis ? 'Qtde Total Itens' : 'Total de SKU'}
          </p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">
            {stats.isSyncing ? '---' : stats.totalSku.toLocaleString('pt-BR')}
          </h3>
        </div>
        <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors duration-300">
          <Package className="w-8 h-8 text-blue-600 group-hover:text-blue-800 transition-colors duration-300" />
        </div>
      </div>

      {/* Total de Itens Não Lidos */}
      <div
        onClick={() => isClassReport && onCategoryClick?.('TOTAL_NOT_READ')}
        className={`bg-white rounded-xl shadow-sm border-2 p-6 flex items-center justify-between group transition-all duration-300 ${isClassReport ? 'cursor-pointer hover:border-red-300 hover:-translate-y-1 hover:shadow-md' : 'cursor-default border-slate-200'
          } ${selectedCategory === 'TOTAL_NOT_READ' && !isCollaboratorView ? 'border-red-500 ring-2 ring-red-100 shadow-md' : 'border-slate-200'
          }`}
      >
        <div>
          <p className="text-sm font-black text-slate-500 uppercase tracking-wider">
            {isAnalysis ? 'Total Não Lidos' : 'Total de Itens Não Lidos'}
          </p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.totalNotRead.toLocaleString('pt-BR')}</h3>
          {isClassReport && (
            <p className="text-[10px] font-black text-red-500 uppercase mt-2 tracking-widest">
              Clique para ver detalhes
            </p>
          )}
        </div>
        <div className="bg-red-50 p-3 rounded-full group-hover:bg-red-100 transition-colors duration-300">
          <EyeOff className="w-8 h-8 text-red-600 group-hover:text-red-800 transition-colors duration-300" />
        </div>
      </div>

      {/* Itens Desatualizados */}
      {shouldShowOutdatedCard && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between group hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default border-l-4 border-l-amber-500">
          <div>
            <p className="text-sm font-black text-slate-500 uppercase tracking-wider">
              Itens Desatualizados
            </p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">
              {stats.totalOutdated?.toLocaleString('pt-BR')}
            </h3>
          </div>
          <div className="bg-amber-50 p-3 rounded-full group-hover:bg-amber-100 transition-colors duration-300">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
        </div>
      )}

      {/* Parcial Geral - CENTRALIZADO */}
      <div className={`${getCardStyle(stats.generalPartial, stats.isSyncing)} rounded-xl shadow-lg p-6 flex flex-col items-center justify-center text-center text-white transform hover:scale-[1.02] transition-transform duration-200 relative overflow-hidden group`}>
        {/* Ícone de fundo decorativo */}
        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform duration-500">
          <Activity className="w-24 h-24 text-white" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <p className="text-[10px] font-black text-white/90 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
            {isAnalysis ? 'Resultado' : 'Parcial Geral'}
          </p>

          {stats.isSyncing ? (
            <div className="flex flex-col items-center gap-2 mt-2">
              <Loader2 className="w-8 h-8 animate-spin text-white/80" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white/70">Calculando...</h3>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <h3 className="text-5xl font-black text-white drop-shadow-md leading-none">
                {formatTruncatedPercentage(stats.generalPartial)}%
              </h3>
              <div className="h-1.5 w-12 bg-white/30 rounded-full mt-4 group-hover:w-24 transition-all duration-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isClassReport && categoryStats) {
    const categories = [
      { id: 'Desatualizado', label: 'DESATUALIZADO', value: categoryStats.desatualizado, color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertCircle, interactive: false },
      { id: 'Sem estoque', label: 'SEM ESTOQUE', value: categoryStats.semEstoque, color: 'text-blue-600', bg: 'bg-blue-50', icon: Info, interactive: false },
    ].filter(cat => cat.value > 0);

    return (
      <div className="mb-6">
        {mainCards}
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px bg-slate-200 flex-1"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribuição e Equipe</p>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>
        <div className={`grid ${forceDesktopLayout ? 'grid-cols-3 gap-12' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'} w-full`}>
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => cat.interactive && onCategoryClick?.(cat.id)}
              className={`bg-white rounded-xl shadow-sm border-2 p-5 flex items-center justify-between group transition-all duration-300 ${cat.interactive ? 'cursor-pointer hover:border-blue-300 hover:-translate-y-1' : 'cursor-default'
                } ${selectedCategory === cat.id && !isCollaboratorView ? 'border-blue-500 ring-2 ring-blue-100 -translate-y-1' : 'border-slate-100'
                }`}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mb-1">
                  {cat.label}
                </p>
                <h3 className="text-3xl font-black text-slate-800 leading-none">
                  {cat.value.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className={`${cat.bg} p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                <cat.icon className={`w-8 h-8 ${cat.color}`} />
              </div>
            </div>
          ))}

          {/* Card de Colaboradores */}
          <div
            onClick={onCollaboratorClick}
            className={`bg-white rounded-xl shadow-sm border-2 p-5 flex items-center justify-between group cursor-pointer transition-all duration-300 hover:border-indigo-300 hover:-translate-y-1 ${isCollaboratorView ? 'border-indigo-500 ring-2 ring-indigo-100 -translate-y-1' : 'border-slate-100'
              }`}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mb-1">
                TOTAL COLABORADORES
              </p>
              <h3 className="text-3xl font-black text-slate-800 leading-none">
                {collaboratorCount}
              </h3>
              <p className="text-[10px] font-black text-indigo-500 uppercase mt-2 tracking-widest">
                Clique para ver ranking
              </p>
            </div>
            <div className={`bg-indigo-50 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
              <Users className={`w-8 h-8 text-indigo-600`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return mainCards;
};

export default SummaryStats;
