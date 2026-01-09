
import React, { useMemo, useState } from 'react';
import { Search, X, User, TrendingUp, Hash, Trophy, Medal } from 'lucide-react';

interface CollaboratorRankingProps {
  stats: { [name: string]: number };
  onClose: () => void;
}

const CollaboratorRanking: React.FC<CollaboratorRankingProps> = ({ stats, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const ranking = useMemo(() => {
    return Object.entries(stats || {})
      .map(([name, count]) => ({ name, count: count as number }))
      // Filtro extra de segurança: Remove S/N do ranking caso passe pelo serviço
      .filter(item => 
        item.name && 
        item.name !== 'S/N' && 
        item.name !== 'SN' && 
        item.name !== 'S / N' && 
        item.name !== 'NULL' &&
        item.name !== 'DESCONHECIDO'
      )
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const maxReadings = useMemo(() => {
    return ranking.length > 0 ? ranking[0].count : 0;
  }, [ranking]);

  const filteredRanking = useMemo(() => {
    if (!searchTerm) return ranking;
    const low = searchTerm.toLowerCase();
    return ranking.filter(item => item.name.toLowerCase().includes(low));
  }, [ranking, searchTerm]);

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header do Ranking */}
      <div className="p-6 md:p-8 bg-indigo-50 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-indigo-900 tracking-tight uppercase leading-none mb-2">
            RANKING DE LEITURAS
          </h2>
          <div className="flex items-center gap-3">
             <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                {ranking.length} Colaboradores Ativos
             </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group flex-1 md:flex-initial">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
             <input 
               type="text" 
               placeholder="Buscar colaborador..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full md:w-80 pl-12 pr-4 py-3.5 bg-white border-2 border-indigo-100 rounded-2xl font-bold text-slate-700 focus:border-indigo-500 outline-none transition-all placeholder:text-indigo-300 placeholder:font-black placeholder:uppercase placeholder:text-[10px]"
             />
          </div>
          <button onClick={onClose} className="p-3 hover:bg-indigo-200 rounded-full text-indigo-500 transition-all">
            <X className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* Lista de Colaboradores */}
      <div className="p-4 md:p-8">
        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-100 border-b border-slate-200">
            <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pos</div>
            <div className="col-span-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</div>
            <div className="col-span-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance Visual</div>
            <div className="col-span-2 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Leituras</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredRanking.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum colaborador encontrado</p>
              </div>
            ) : (
              filteredRanking.map((item, idx) => {
                const progress = maxReadings > 0 ? (item.count / maxReadings) * 100 : 0;
                const isTop1 = idx === 0 && !searchTerm;
                
                return (
                  <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-6 py-4 bg-white hover:bg-indigo-50/30 transition-colors group">
                    {/* Posição */}
                    <div className="col-span-1 flex items-center">
                      {isTop1 ? (
                        <div className="bg-amber-100 p-2 rounded-lg">
                          <Trophy className="w-5 h-5 text-amber-600" />
                        </div>
                      ) : (
                        <span className="text-sm font-black text-slate-400 px-2">#{idx + 1}</span>
                      )}
                    </div>

                    {/* Nome e Avatar */}
                    <div className="col-span-5 flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl hidden sm:block ${isTop1 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white'} transition-colors`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`text-sm font-black uppercase tracking-tight ${isTop1 ? 'text-amber-700' : 'text-slate-800'}`}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3 text-emerald-500" />
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Frequência Ativa</p>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progresso (Performance) */}
                    <div className="col-span-4 hidden md:block">
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                        <div 
                          className={`h-full transition-all duration-1000 ease-out ${isTop1 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Contador de Leituras */}
                    <div className="col-span-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Hash className="w-3 h-3 text-slate-300" />
                        <span className={`text-xl font-black ${isTop1 ? 'text-amber-600' : 'text-slate-800'}`}>
                          {item.count.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Leituras</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-200 text-right">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Exibindo Estatísticas de Performance da Equipe</p>
      </div>
    </div>
  );
};

export default CollaboratorRanking;
