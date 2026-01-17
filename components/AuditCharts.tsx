
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { AuditRow } from '../types';

interface AuditChartsProps {
  data: AuditRow[];
  forceDesktopLayout?: boolean;
}

/**
 * Função utilitária interna para limpar o nome na exibição do gráfico
 */
const formatDisplayName = (name: string): string => {
  if (!name) return "";
  const parts = name.split(/[-\u2013\u2014\/]/).map(p => p.trim()).filter(p => p !== "");
  return parts.length > 0 ? parts[0] : name;
};

const AuditCharts: React.FC<AuditChartsProps> = ({ data, forceDesktopLayout = false }) => {
  // Pre-processamento para garantir que os nomes fiquem limpos no gráfico
  const sanitizedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      displayName: formatDisplayName(item.corridor)
    }));
  }, [data]);

  // Data for Highest percentages (Worst performing)
  const highestData = useMemo(() => {
    return [...sanitizedData]
      .sort((a, b) => b.partialPercentage - a.partialPercentage)
      .slice(0, 10);
  }, [sanitizedData]);

  // Data for Lowest percentages (Best performing)
  const lowestData = useMemo(() => {
    return [...sanitizedData]
      .sort((a, b) => a.partialPercentage - b.partialPercentage)
      .slice(0, 10);
  }, [sanitizedData]);

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-8 w-full">

      {/* Chart 1: Highest Percentages */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2 border-b pb-2 border-red-100">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          Top 10 - Maiores Percentuais
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={highestData}
              layout="vertical"
              margin={{ top: 0, right: 50, left: 40, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" unit="%" hide />
              <YAxis
                dataKey="displayName"
                type="category"
                width={70}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: '#fef2f2' }}
                contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Parcial']}
              />
              <Bar dataKey="partialPercentage" radius={[0, 4, 4, 0]} barSize={18} fill="#ef4444">
                <LabelList
                  dataKey="partialPercentage"
                  position="right"
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  fontSize={11}
                  fill="#64748b"
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Lowest Percentages */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2 border-b pb-2 border-green-100">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Top 10 - Menores Percentuais
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={lowestData}
              layout="vertical"
              margin={{ top: 0, right: 50, left: 40, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" unit="%" hide />
              <YAxis
                dataKey="displayName"
                type="category"
                width={70}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: '#f0fdf4' }}
                contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Parcial']}
              />
              <Bar dataKey="partialPercentage" radius={[0, 4, 4, 0]} barSize={18} fill="#22c55e">
                <LabelList
                  dataKey="partialPercentage"
                  position="right"
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  fontSize={11}
                  fill="#64748b"
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default AuditCharts;
