
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { AuditRow } from '../types';
import { ChevronUp, ChevronDown, Search, Calendar } from 'lucide-react';

interface AuditTableProps {
  data: AuditRow[];
  simpleView?: boolean;
  forceSplit?: boolean;
  isAnalysis?: boolean;
  isClassReport?: boolean;
  dateLabel?: string;
  onDateClick?: () => void;
  forceDesktopLayout?: boolean;
}

type SortField = 'corridor' | 'sku' | 'notRead' | 'partialPercentage';
type SortOrder = 'asc' | 'desc';

/**
 * Função utilitária interna para limpar o nome na exibição
 */
const formatDisplayName = (name: string): string => {
  if (!name) return "";
  const parts = name.split(/[-\u2013\u2014\/]/).map(p => p.trim()).filter(p => p !== "");
  return parts.length > 0 ? parts[0] : name;
};

const AuditRowItem = React.memo(({
  row,
  idx,
  isClassReport,
  cellTextClass,
  getBadgeColorClass
}: {
  row: AuditRow,
  idx: number,
  isClassReport: boolean,
  cellTextClass: string,
  getBadgeColorClass: (p: number) => string
}) => (
  <tr className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-blue-50 transition-colors'}>
    <td className={`${cellTextClass} text-left font-bold text-slate-900 py-2 px-3 md:px-4 uppercase w-[25%]`}>
      {formatDisplayName(row.corridor)}
    </td>
    {!isClassReport && (
      <td className={`${cellTextClass} text-center font-black text-slate-950 w-[25%] py-2 px-0 text-[11px] md:text-base`}>
        {row.sku.toLocaleString('pt-BR')}
      </td>
    )}
    <td className={`${cellTextClass} text-center font-black text-slate-950 ${isClassReport ? 'w-[75%]' : 'w-[25%]'} py-2 px-0 text-[11px] md:text-base`}>
      {row.notRead.toLocaleString('pt-BR')}
    </td>
    {!isClassReport && (
      <td className={`${cellTextClass} text-center w-[25%] py-2 px-0`}>
        <div className="flex justify-center">
          <span className={`inline-flex items-center justify-center font-black rounded-lg px-2 md:px-3 py-1 md:py-1.5 min-w-[65px] md:min-w-[85px] text-[10px] md:text-sm ${getBadgeColorClass(row.partialPercentage)}`}>
            {row.partialPercentage.toFixed(2)}
          </span>
        </div>
      </td>
    )}
  </tr>
));

const AuditTable: React.FC<AuditTableProps> = ({
  data,
  simpleView = false,
  forceSplit = false,
  isAnalysis = false,
  isClassReport = false,
  dateLabel,
  onDateClick,
  forceDesktopLayout = false
}) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const [isLargeViewport, setIsLargeViewport] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1400 : true);

  useEffect(() => {
    const handleResize = () => {
      const large = window.innerWidth >= 1400;
      setIsLargeViewport(prev => (prev !== large ? large : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
        return prevField;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(row =>
        row.corridor.toLowerCase().includes(lower)
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        const numA = (valA as number) || 0;
        const numB = (valB as number) || 0;

        if (numA < numB) return sortOrder === 'asc' ? -1 : 1;
        if (numA > numB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortField, sortOrder]);

  const headers = useMemo(() => ({
    corridor: isClassReport ? "CLASSE" : (isAnalysis ? "DESCRIÇÃO" : "CORREDOR"),
    sku: isClassReport ? "QTD" : (isAnalysis ? "QTDE" : "SKU"),
    notRead: "NÃO LIDOS",
    partial: "PARCIAL"
  }), [isClassReport, isAnalysis]);

  const currentSortLabel = useMemo(() => {
    if (!sortField) return "Ordem: Original da Planilha";
    const fieldLabels: Record<SortField, string> = {
      corridor: headers.corridor,
      sku: headers.sku,
      notRead: headers.notRead,
      partialPercentage: "PARCIAL"
    };
    const isNumeric = ['sku', 'notRead', 'partialPercentage'].includes(sortField);
    const dirText = isNumeric
      ? (sortOrder === 'asc' ? 'Menor → Maior' : 'Maior → Menor')
      : (sortOrder === 'asc' ? 'A → Z' : 'Z → A');
    return `Ordem: ${fieldLabels[sortField]} (${dirText})`;
  }, [sortField, sortOrder, headers]);

  const shouldSplit = useMemo(() => {
    if (isAnalysis || isClassReport) return false;
    if (forceDesktopLayout) return filteredAndSortedData.length > 1;
    if (forceSplit) return filteredAndSortedData.length > 1;
    return filteredAndSortedData.length > 8 && !simpleView && isLargeViewport;
  }, [isAnalysis, isClassReport, forceSplit, filteredAndSortedData.length, simpleView, isLargeViewport, forceDesktopLayout]);

  const { leftData, rightData } = useMemo(() => {
    if (!shouldSplit) return { leftData: filteredAndSortedData, rightData: [] };
    const midPoint = Math.ceil(filteredAndSortedData.length / 2);
    return {
      leftData: filteredAndSortedData.slice(0, midPoint),
      rightData: filteredAndSortedData.slice(midPoint)
    };
  }, [filteredAndSortedData, shouldSplit]);

  const getBadgeColorClass = useCallback((percentage: number) => {
    if (percentage > 20) return 'bg-red-600 text-white';
    if (percentage > 3) return 'bg-red-100 text-red-900';
    if (percentage > 2.5) return 'bg-yellow-100 text-yellow-900';
    return 'bg-green-100 text-green-900';
  }, []);

  const headerTextClass = 'text-[9px] md:text-sm py-2.5 px-2 md:px-4 font-black uppercase tracking-widest select-none text-black';
  const cellTextClass = 'text-[11px] md:text-base';

  const renderTableBlock = (rows: AuditRow[]) => (
    <div className="overflow-x-auto custom-scrollbar w-full border border-slate-200 rounded-lg shadow-sm bg-white">
      <table className="w-full divide-y divide-slate-200 table-fixed">
        <thead className="bg-slate-200">
          <tr>
            <th
              scope="col"
              className={`${headerTextClass} text-left cursor-pointer hover:bg-slate-300 transition-colors w-[25%] px-3`}
              onClick={() => !simpleView && handleSort('corridor')}
            >
              <div className="flex items-center">
                <span>{headers.corridor}</span>
                {!simpleView && (sortField === 'corridor' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" /> : <ChevronDown className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" />) : <div className="w-3 h-3 md:w-4 h-4 ml-1 opacity-0 shrink-0" />)}
              </div>
            </th>
            {!isClassReport && (
              <th
                scope="col"
                className={`${headerTextClass} text-center cursor-pointer hover:bg-slate-300 transition-colors w-[25%] px-0`}
                onClick={() => !simpleView && handleSort('sku')}
              >
                <div className="flex items-center justify-center">
                  <span>{headers.sku}</span>
                  {!simpleView && (sortField === 'sku' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" /> : <ChevronDown className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" />) : <div className="w-3 h-3 md:w-4 h-4 ml-1 opacity-0 shrink-0" />)}
                </div>
              </th>
            )}
            <th
              scope="col"
              className={`${headerTextClass} text-center cursor-pointer hover:bg-slate-300 transition-colors ${isClassReport ? 'w-[75%]' : 'w-[25%]'} px-0`}
              onClick={() => !simpleView && handleSort('notRead')}
            >
              <div className="flex items-center justify-center">
                <span>NÃO LIDOS</span>
                {!simpleView && (sortField === 'notRead' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" /> : <ChevronDown className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" />) : <div className="w-3 h-3 md:w-4 h-4 ml-1 opacity-0 shrink-0" />)}
              </div>
            </th>
            {!isClassReport && (
              <th
                scope="col"
                className={`${headerTextClass} text-center cursor-pointer hover:bg-slate-300 transition-colors w-[25%] px-0`}
                onClick={() => !simpleView && handleSort('partialPercentage')}
              >
                <div className="flex items-center justify-center">
                  <span>{headers.partial}</span>
                  {!simpleView && (sortField === 'partialPercentage' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" /> : <ChevronDown className="w-3 h-3 md:w-4 h-4 ml-1 text-black shrink-0" />) : <div className="w-3 h-3 md:w-4 h-4 ml-1 opacity-0 shrink-0" />)}
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {rows.map((row, idx) => (
            <AuditRowItem
              key={row.id}
              row={row}
              idx={idx}
              isClassReport={isClassReport}
              cellTextClass={cellTextClass}
              getBadgeColorClass={getBadgeColorClass}
            />
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`overflow-hidden ${simpleView ? '' : 'space-y-4 md:space-y-6'} w-full`}>
      {!simpleView && (
        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-slate-900 text-base md:text-xl tracking-tight uppercase">Detalhes da Auditoria</h2>
              {dateLabel && (
                onDateClick ? (
                  <button
                    onClick={onDateClick}
                    className="flex items-center gap-1 md:gap-2 text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-blue-200 group cursor-pointer"
                    title="Clique para alterar a data"
                  >
                    <Calendar className="w-3 h-3 md:w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] md:text-xs font-black uppercase tracking-widest">{dateLabel}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 md:gap-2 text-blue-700 bg-blue-100 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-blue-200">
                    <Calendar className="w-3 h-3 md:w-4 h-4" />
                    <span className="text-[9px] md:text-xs font-black uppercase tracking-widest">{dateLabel}</span>
                  </div>
                )
              )}
            </div>
            <p className="text-[9px] md:text-xs text-slate-600 mt-1 font-bold uppercase tracking-wide">{currentSortLabel}</p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 md:pl-12 pr-4 py-2 md:py-3 text-xs md:text-sm border-2 border-slate-100 rounded-xl focus:outline-none focus:border-blue-600 transition-all w-full sm:w-80 font-bold text-slate-900"
            />
          </div>
        </div>
      )}

      {filteredAndSortedData.length === 0 ? (
        <div className="bg-white px-6 py-12 md:py-20 text-center flex flex-col items-center rounded-xl border border-slate-200">
          <Search className="w-10 h-10 md:w-12 h-12 text-slate-200 mb-4" />
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Nenhum dado encontrado</p>
        </div>
      ) : (
        <div className={`w-full flex ${forceDesktopLayout ? 'flex-row gap-12' : (shouldSplit ? 'lg:flex-row lg:gap-12' : 'flex-col gap-4')}`}>
          <div className="flex-1">
            {renderTableBlock(leftData)}
          </div>
          {shouldSplit && rightData.length > 0 && (
            <div className="flex-1">
              {renderTableBlock(rightData)}
            </div>
          )}
        </div>
      )}

      {!simpleView && (
        <div className="p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Painel de Monitoramento Técnico</span>
          </div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
            {filteredAndSortedData.length} registros
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(AuditTable);
