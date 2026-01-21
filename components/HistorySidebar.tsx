
import React, { useState, useRef, useMemo } from 'react';
import { HistoryItem } from '../types';
import { Trash2, FileSpreadsheet, Clock, Package, FileText, Calendar, Filter, X, LogOut, User, Settings, LayoutDashboard, CalendarX, ChevronDown, Store, LayoutGrid, KeyRound } from 'lucide-react';

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  onSignOut: () => void;
  userEmail?: string;
  isAdmin?: boolean;
  role?: string;
  loja?: string;
  onOpenAdmin: () => void;
  onOpenDashboard: () => void;
  onOpenWeekly: () => void;
  onOpenPasswordChange: () => void;
  activeView: 'dashboard' | 'admin' | 'weekly';
  activeReportId?: string;
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  history, onSelect, onClearAll, onDelete, isOpen, toggleSidebar, onSignOut, userEmail, isAdmin, role, loja, onOpenAdmin, onOpenDashboard, onOpenWeekly, onOpenPasswordChange, activeView, activeReportId, selectedDate, onDateChange
}) => {
  // Função para obter data local YYYY-MM-DD corretamente
  const getTodayLocal = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // O filtro de data agora é controlado externamente pelo prop selectedDate
  const filterDate = selectedDate || getTodayLocal();
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar filtro lateral com o relatório ativo (apenas no dashboard)
  React.useEffect(() => {
    if (activeView === 'dashboard' && activeReportId && history.length > 0) {
      const activeItem = history.find(h => h.id === activeReportId);
      if (activeItem) {
        const itemDate = activeItem.customDate || new Date(activeItem.timestamp).toLocaleDateString('en-CA');
        if (itemDate !== selectedDate) {
          onDateChange(itemDate);
        }
      }
    }
  }, [activeReportId, history, selectedDate, onDateChange, activeView]);

  // Helper para formatar porcentagem com truncamento (sem arredondar)
  const formatTruncatedPercentage = (value: number) => {
    const truncated = Math.floor(value * 100) / 100;
    return truncated.toFixed(2);
  };

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

  const getAuditLabel = (item: HistoryItem) => {
    const dateToUse = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
    const dayOfWeek = dateToUse.getDay();

    if (item.reportType === 'audit') {
      if (dayOfWeek === 1) return "Etiqueta";
      if (dayOfWeek === 2) return "Presença";
      if (dayOfWeek === 3) return "Ruptura";
      if (dayOfWeek === 4) return "Etiqueta";
      return "Auditoria";
    }

    if (item.reportType === 'class') return "Classe";
    if (item.reportType === 'analysis') return "Análise";
    if (item.reportType === 'rupture' || item.reportType === 'final_rupture') return "Análise";
    return "Auditoria";
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDateISO = item.customDate || new Date(item.timestamp).toLocaleDateString('en-CA');
      return itemDateISO === filterDate;
    });
  }, [history, filterDate]);

  // handleClearFilter removido pois agora mostramos sempre um dia por vez

  const formatDateLabel = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={toggleSidebar} />

      <aside className={`fixed left-0 top-0 h-full w-72 bg-white border-r border-slate-200 shadow-xl z-40 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-slate-200 p-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-500">Histórico de Auditoria</h2>
          </div>
          {history.length > 0 && isAdmin && (
            <button onClick={onClearAll} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors" title="Limpar Tudo">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-3 border-b border-slate-100 space-y-1">
          <button
            onClick={onOpenDashboard}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>

          <button
            onClick={onOpenWeekly}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'weekly' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <LayoutGrid className="w-5 h-5" /> Resumo Semanal
          </button>

          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              <Settings className="w-5 h-5" /> Administração
            </button>
          )}
        </div>

        <div className="p-4 bg-white border-b border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Filtrar por Período</p>

          <div
            onClick={() => dateInputRef.current?.showPicker()}
            className={`group relative flex items-center justify-between p-3 rounded-2xl border-2 transition-all cursor-pointer ${filterDate
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-100 bg-slate-50 hover:border-slate-300'
              }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-colors ${filterDate ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">
                  {filterDate ? 'Data Selecionada' : 'Filtrar Histórico'}
                </span>
                <span className={`text-xs font-black uppercase ${filterDate ? 'text-blue-700' : 'text-slate-600'}`}>
                  {filterDate ? formatDateLabel(filterDate) : 'Todas as Datas'}
                </span>
              </div>
            </div>

            {filterDate && (
              <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            )}

            <input
              type="date"
              ref={dateInputRef}
              value={filterDate}
              onChange={e => onDateChange(e.target.value)}
              className="absolute inset-0 opacity-0 pointer-events-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="bg-white rounded-[32px] p-8 border-2 border-dashed border-slate-200 shadow-sm">
                <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                  {filterDate
                    ? `Nenhuma auditoria encontrada em ${formatDateLabel(filterDate)}`
                    : 'Nenhum registro no histórico ainda.'}
                </p>
                {/* Botão de ver todo histórico removido para manter apenas um dia por vez */}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {filterDate ? 'Encontrados' : 'Arquivos Recentes'}
                </p>
                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {filteredHistory.length}
                </span>
              </div>

              {filteredHistory.map((item) => {
                const isActive = item.id === activeReportId;
                return (
                  <div
                    key={item.id}
                    className={`group border rounded-2xl p-4 transition-all cursor-pointer relative overflow-hidden ${isActive
                      ? 'bg-blue-50/40 border-blue-500 shadow-lg shadow-blue-500/10'
                      : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10'
                      }`}
                    onClick={() => onSelect(item)}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${item.reportType === 'analysis' || item.reportType === 'rupture' || item.reportType === 'final_rupture' ? 'bg-purple-600 text-white' :
                          item.reportType === 'class' ? 'bg-orange-500 text-white' :
                            'bg-blue-600 text-white'
                          }`}>
                          {getAuditLabel(item)}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter border ${isActive ? 'bg-blue-600 text-white border-blue-700' : 'bg-blue-50 text-blue-500 border-blue-100/50'
                          }`}>
                          Loja {item.loja}
                        </span>
                      </div>
                      {(isAdmin || role === 'user') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                          className={`transition-all p-1 ${isActive ? 'text-blue-400 hover:text-red-500' : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <p className={`text-[11px] font-black truncate mb-3 transition-colors ${isActive ? 'text-blue-700' : 'text-slate-700 group-hover:text-blue-600'}`} title={item.fileName}>
                      {item.fileName}
                    </p>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                      <div className={`flex items-center gap-1.5 font-bold text-[9px] ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{getDisplayDate(item)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.stats?.generalPartial > 3 ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
                        <span className={`text-[11px] font-black ${item.stats?.generalPartial > 3 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatTruncatedPercentage(item.stats?.generalPartial)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 bg-white border-t border-slate-200">
          {/* Seção de Perfil Clicável para Alterar Senha */}
          <div
            onClick={onOpenPasswordChange}
            className="flex items-center gap-4 mb-4 px-1 cursor-pointer hover:bg-slate-50 rounded-2xl p-2 transition-all group"
          >
            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 shadow-sm group-hover:bg-blue-600 group-hover:border-blue-700 transition-all relative">
              <User className="w-5 h-5 text-slate-600 group-hover:text-white" />
              <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity border border-white">
                <KeyRound className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tighter group-hover:text-blue-600 transition-colors">{userEmail}</p>
              <div className="flex flex-col gap-0.5 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-indigo-500' : (role === 'viewer' ? 'bg-slate-400' : 'bg-emerald-500')}`} />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {isAdmin ? 'ADMIN' : (role === 'viewer' ? 'VIEWER' : 'USER')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Store className="w-2.5 h-2.5 text-slate-300" />
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest Loja">Loja {loja || '---'}</p>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onSignOut} className="w-full flex items-center justify-center gap-3 px-4 py-3.5 text-[10px] font-black text-red-600 bg-red-50/50 border-2 border-red-50 hover:bg-red-100/50 hover:border-red-100 rounded-2xl transition-all shadow-sm active:scale-95 uppercase tracking-[0.2em]">
            <LogOut className="w-4 h-4" /> Finalizar Sessão
          </button>
        </div>
      </aside>
    </>
  );
};

export default HistorySidebar;
