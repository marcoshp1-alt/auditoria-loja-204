
import { supabase } from './supabaseClient';
import { HistoryItem, UserProfile } from '../types';

// Busca apenas metadados leves para a barra lateral e listagens
export const fetchHistory = async (profile: UserProfile): Promise<HistoryItem[]> => {
  let query = supabase
    .from('audit_history')
    .select('id, created_at, file_name, report_type, stats, custom_date, loja')
    .order('created_at', { ascending: false });

  if (profile.role !== 'admin') {
    query = query.eq('loja', profile.loja);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching history:', JSON.stringify(error));
    throw error;
  }

  return data.map((row: any) => ({
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    fileName: row.file_name,
    reportType: row.report_type,
    data: [], // Vazio por padrão no fetch leve
    classDetails: [],
    categoryStats: null,
    collaboratorStats: null,
    stats: row.stats || { totalSku: 0, totalNotRead: 0, generalPartial: 0 },
    customDate: row.custom_date,
    loja: row.loja || '204'
  }));
};

// Busca os dados pesados (JSONB) de um único relatório
export const fetchHistoryItemDetails = async (id: string): Promise<any> => {
  const { data, error } = await supabase
    .from('audit_history')
    .select('data, class_details, category_stats, collaborator_stats')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching item details:', error);
    throw error;
  }

  return {
    data: data.data || [],
    classDetails: data.class_details || [],
    categoryStats: data.category_stats || null,
    collaboratorStats: data.collaborator_stats || null
  };
};

export const addHistoryItem = async (item: HistoryItem): Promise<void> => {
  const payload = {
    file_name: item.fileName,
    report_type: item.reportType,
    custom_date: item.customDate || null,
    stats: item.stats,
    data: item.data || [],
    class_details: item.classDetails || [],
    category_stats: item.categoryStats || null,
    collaborator_stats: item.collaboratorStats || null,
    loja: item.loja || '204'
  };

  const { error } = await supabase.from('audit_history').insert([payload]);

  if (error) {
    if (error.code === '42703' || error.message?.includes('column')) {
      const sqlRepair = `
-- Execute este script no SQL Editor do seu Supabase para habilitar novos recursos:
ALTER TABLE audit_history ADD COLUMN IF NOT EXISTS class_details JSONB DEFAULT '[]';
ALTER TABLE audit_history ADD COLUMN IF NOT EXISTS category_stats JSONB DEFAULT '{}';
ALTER TABLE audit_history ADD COLUMN IF NOT EXISTS collaborator_stats JSONB DEFAULT '{}';
      `.trim();
      
      const enhancedError = new Error("Sua tabela 'audit_history' precisa ser atualizada.");
      (enhancedError as any).sql = sqlRepair;
      (enhancedError as any).code = 'MISSING_COLUMNS';
      throw enhancedError;
    }
    throw error;
  }
};

export const deleteHistoryItemById = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('audit_history')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const deleteAllHistory = async (): Promise<void> => {
    const { error } = await supabase
      .from('audit_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
  
    if (error) throw error;
};
