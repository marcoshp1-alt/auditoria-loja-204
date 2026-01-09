
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

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const low = searchTerm.toLowerCase();
    return data.filter(item => 
      item.produto.toLowerCase().includes(low) || 
      String(item.codigo).includes(low) ||
      item.classeRaiz.toLowerCase().includes(low) ||
      item.local.toLowerCase().includes(low)
    );
  }, [data, searchTerm]);

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
    const exportData = filteredData.map(item => ({
      'Código': item.codigo,
      'Produto': item.produto,
      'Local': item.local,
      'Estoque Atual': item.estoque,
      'Classe Raiz': item.classeRaiz
    }));

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
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30">
                 <div className="flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> Código</div>
              </th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                 <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5" /> Produto</div>
              </th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30">
                 <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Local</div>
              </th>
              <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                 Estoque Atual
              </th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30">
                 <div className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Classe Raiz</div>
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
              filteredData.map((item, idx) => (
                <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                  {/* Código */}
                  <td className="px-8 py-5 whitespace-nowrap bg-slate-50/20 group-hover:bg-transparent">
                    <span className="font-mono text-sm font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                      {item.codigo}
                    </span>
                  </td>
                  
                  {/* Produto */}
                  <td className="px-8 py-5">
                    <p className="text-[13px] font-black text-slate-800 uppercase leading-tight group-hover:text-blue-900 transition-colors">
                      {item.produto}
                    </p>
                  </td>

                  {/* Local */}
                  <td className="px-8 py-5 whitespace-nowrap bg-slate-50/20 group-hover:bg-transparent">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-400" />
                       <span className="text-[11px] font-bold text-slate-500 uppercase">
                          {item.local}
                       </span>
                    </div>
                  </td>

                  {/* Estoque Atual */}
                  <td className="px-8 py-5 whitespace-nowrap text-center">
                    <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-black text-sm min-w-[60px] border border-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-700 transition-all">
                      {item.estoque}
                    </span>
                  </td>

                  {/* Classe de Produto Raiz */}
                  <td className="px-8 py-5 whitespace-nowrap bg-slate-50/20 group-hover:bg-transparent">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                      {item.classeRaiz}
                    </span>
                  </td>
                </tr>
              ))
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
