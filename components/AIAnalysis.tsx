import React, { useEffect, useState } from 'react';
import { AuditRow, AnalysisState } from '../types';
import { generateAuditAnalysis } from '../services/geminiService';
import { Sparkles, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIAnalysisProps {
  data: AuditRow[];
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ data }) => {
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    text: null,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchAnalysis = async () => {
      if (data.length === 0) return;

      setAnalysis({ isLoading: true, text: null, error: null });
      
      try {
        const result = await generateAuditAnalysis(data);
        if (isMounted) {
          setAnalysis({ isLoading: false, text: result, error: null });
        }
      } catch (err) {
        if (isMounted) {
          setAnalysis({ isLoading: false, text: null, error: "Erro ao gerar análise." });
        }
      }
    };

    fetchAnalysis();

    return () => { isMounted = false; };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg shadow-sm border border-indigo-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-indigo-600" />
        <h2 className="text-lg font-bold text-indigo-800">Análise Inteligente (Gemini AI)</h2>
      </div>

      {analysis.isLoading && (
        <div className="flex flex-col items-center justify-center py-8">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
           <p className="text-indigo-500 text-sm animate-pulse">Gerando insights sobre a auditoria...</p>
        </div>
      )}

      {analysis.error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-md">
          <AlertTriangle className="w-5 h-5" />
          <p>{analysis.error}</p>
        </div>
      )}

      {analysis.text && (
        <div className="prose prose-sm max-w-none text-slate-700">
           <ReactMarkdown>{analysis.text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default AIAnalysis;