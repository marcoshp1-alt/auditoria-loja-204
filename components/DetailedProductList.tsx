
import React, { useMemo, useState } from 'react';
import { ClassDetailRow } from '../types';
import { Search, X, Package, MapPin, Hash, Layers, ListFilter, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DetailedProductListProps {
  data: ClassDetailRow[];
  category: string;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

const DetailedProductList: React.FC<DetailedProductListProps> = ({ data, category, onClose, onShowToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const normalizeItem = (item: any) => ({
    c: item.c !== undefined ? item.c : item.codigo,
    p: item.p !== undefined ? item.p : item.produto,
    e: item.e !== undefined ? item.e : item.estoque,
    r: item.r !== undefined ? item.r : item.classeRaiz,
    l: item.l !== undefined ? item.l : item.local,
    s: item.s !== undefined ? item.s : item.situacao,
    d: item.d !== undefined ? item.d : (item.diasSemVenda || 0),
    u: item.u !== undefined ? item.u : (item.ultimaCompra || "")
  });

  const filteredData = useMemo(() => {
    let result = [...data];

    // 1. Filtro de Busca
    if (searchTerm) {
      const low = searchTerm.toLowerCase();
      result = result.filter(item => {
        const norm = normalizeItem(item);
        return (
          norm.p.toLowerCase().includes(low) ||
          String(norm.c).includes(low) ||
          norm.r.toLowerCase().includes(low) ||
          norm.l.toLowerCase().includes(low)
        );
      });
    }

    // 2. Ordenação
    if (sortConfig) {
      result.sort((a, b) => {
        const normA = normalizeItem(a);
        const normB = normalizeItem(b);

        let valA = (normA as any)[sortConfig.key];
        let valB = (normB as any)[sortConfig.key];

        // Tratar números
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        // Tratar strings
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const displayTitle = useMemo(() => {
    const cat = category.toLowerCase();
    if (cat === 'total_not_read') return "Relatório Geral: Itens Não Auditados";
    if (cat.includes('não lido')) return "Etiquetas Não Lidas";
    if (cat.includes('sem presença')) return "Sem Presença (Com Estoque)";
    return category.toUpperCase();
  }, [category]);

  const handleExportToExcel = () => {
    if (filteredData.length === 0) return;

    // Preparar dados para exportação
    const exportData = filteredData.map(item => {
      const norm = normalizeItem(item);
      return {
        'Código': norm.c,
        'Produto': norm.p,
        'Local': norm.l,
        'Estoque Atual': norm.e,
        'Dias sem Venda': norm.d,
        'Última Compra': norm.u,
        'Classe Raiz': norm.r
      };
    });

    // Criar planilha
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatorio_Detalhado');

    // Ajustar largura das colunas
    const wscols = [
      { wch: 15 }, // Código
      { wch: 50 }, // Produto
      { wch: 15 }, // Local
      { wch: 15 }, // Estoque
      { wch: 15 }, // Dias sem Venda
      { wch: 20 }, // Última Compra
      { wch: 30 }  // Classe
    ];
    worksheet['!cols'] = wscols;

    // Gerar download
    const fileName = `Relatorio_${displayTitle.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    onShowToast("Excel Exportado!");
  };

  return (
    <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
      {/* Header Profissional */}
      <div className="p-8 md:p-10 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="flex items-start gap-5">
          <div className="bg-blue-600 p-4 rounded-[24px] shadow-xl shadow-blue-100 hidden sm:flex">
            <ListFilter className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none mb-3">
              {displayTitle}
            </h2>
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-blue-200">
                {filteredData.length} Produtos na Lista
              </span>
              <span className="text-slate-400 text-xs font-bold hidden sm:inline">•</span>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest hidden sm:inline">Visualização Detalhada de Classe</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group flex-1 md:flex-initial">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              placeholder="Pesquisar por código, nome ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 pl-14 pr-6 py-4.5 bg-white border-2 border-slate-200 rounded-[22px] font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-300 placeholder:font-black placeholder:uppercase placeholder:text-[10px] shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportToExcel}
              title="Exportar para Excel"
              className="p-4 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-2 border-emerald-100 rounded-[22px] transition-all active:scale-95 flex items-center gap-2 group/export"
            >
              <FileSpreadsheet className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              onClick={onClose}
              title="Fechar"
              className="p-4 hover:bg-slate-200 rounded-[22px] text-slate-500 transition-all active:scale-90 bg-white border-2 border-slate-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Dados */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-100">
              <th
                className="px-8 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('c')}
              >
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5" />
                  Código
                  {sortConfig?.key === 'c' && (
                    <span className="text-blue-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-8 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('p')}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" />
                  Produto
                  {sortConfig?.key === 'p' && (
                    <span className="text-blue-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-8 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('l')}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Local
                  {sortConfig?.key === 'l' && (
                    <span className="text-blue-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('e')}
              >
                <div className="flex items-center justify-center gap-1">
                  Estoque
                  {sortConfig?.key === 'e' && (
                    <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('d')}
              >
                <div className="flex items-center justify-center gap-1">
                  Dias s/ Venda
                  {sortConfig?.key === 'd' && (
                    <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('u')}
              >
                <div className="flex items-center justify-center gap-1">
                  Últ. Compra
                  {sortConfig?.key === 'u' && (
                    <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-8 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('r')}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  Classe Raiz
                  {sortConfig?.key === 'r' && (
                    <span className="text-blue-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <p className="text-slate-300 font-black uppercase tracking-widest text-xs">Nenhum produto encontrado na busca</p>
                </td>
              </tr>
            ) : (
              filteredData.map((item, idx) => {
                const norm = normalizeItem(item);
                return (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                    {/* Código */}
                    <td className="px-8 py-2 whitespace-nowrap bg-slate-50/20 group-hover:bg-transparent">
                      <span className="font-mono text-sm font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                        {norm.c}
                      </span>
                    </td>

                    {/* Produto */}
                    <td className="px-8 py-2">
                      <p className="text-[13px] font-black text-slate-800 uppercase leading-tight group-hover:text-blue-900 transition-colors">
                        {norm.p}
                      </p>
                    </td>

                    {/* Local */}
                    <td className="px-8 py-2 whitespace-nowrap bg-slate-50/20 group-hover:bg-transparent">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-400" />
                        <span className="text-[11px] font-bold text-slate-500 uppercase">
                          {norm.l}
                        </span>
                      </div>
                    </td>

                    {/* Estoque Atual */}
                    <td className="px-5 py-2 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-black text-[11px] min-w-[50px] border border-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-700 transition-all font-mono">
                        {norm.e}
                      </span>
                    </td>

                    {/* Dias sem venda */}
                    <td className="px-5 py-2 whitespace-nowrap text-center bg-slate-50/20 group-hover:bg-transparent">
                      <span className="text-[11px] font-black text-slate-600 group-hover:text-blue-700 font-mono">
                        {norm.d}
                      </span>
                    </td>

                    {/* Última Compra */}
                    <td className="px-5 py-2 whitespace-nowrap text-center">
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 font-mono">
                        {norm.u || "--"}
                      </span>
                    </td>

                    {/* Classe de Produto Raiz */}
                    <td className="px-8 py-2 whitespace-nowrap bg-slate-50/20 group-hover:bg-transparent">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                        {norm.r}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Informativo */}
      <div className="p-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Listagem Técnica de Produtos por Classe</p>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{filteredData.length} registros exibidos</p>
      </div>
    </div>
  );
};

export default DetailedProductList;
