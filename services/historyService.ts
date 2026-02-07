import { pb } from './pocketbase';
import { HistoryItem, UserProfile } from '../types';

// Helper para extrair data do nome do arquivo (dd-mm-yyyy ou dd_mm_yyyy)
const extractDateFromFileName = (fileName: string): string | null => {
  const match = fileName.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
  if (match) {
    const [_, d, m, y] = match;
    return `${y}-${m}-${d}`; // Formato ISO YYYY-MM-DD
  }
  return null;
};

// Busca apenas metadados leves para a barra lateral e listagens
export const fetchHistory = async (profile: UserProfile): Promise<HistoryItem[]> => {
  try {
    let filter = '';
    if (profile.role !== 'admin') {
      filter = `loja = "${profile.loja}"`;
    } else if (profile.visibleLojas && profile.visibleLojas.length > 0) {
      filter = profile.visibleLojas.map(l => `loja = "${l}"`).join(' || ');
    }

    console.log('🔍 Buscando histórico com filtro:', filter || 'NENHUM (ADMIN - VER TUDO)');

    const records = await pb.collection('audit_history').getList(1, 500, {
      sort: '-created',
      filter: filter,
      requestKey: null // Desativa cancelamento automático para garantir persistência
    });

    return records.items.map((row: any) => ({
      id: row.id,
      timestamp: new Date(row.created).getTime(),
      fileName: row.fileName,
      reportType: row.reportType,
      data: [],
      classDetails: [],
      categoryStats: null,
      collaboratorStats: null,
      stats: row.stats || { totalSku: 0, totalNotRead: 0, generalPartial: 0 },
      customDate: row.customDate,
      loja: row.loja || '204'
    }));
  } catch (error: any) {
    if (error.isAbort || error.status === 0) return [];
    console.error('Error fetching history:', error);
    throw error;
  }
};

// Busca os dados pesados (JSONB) de um único relatório
export const fetchHistoryItemDetails = async (id: string): Promise<any> => {
  try {
    const data = await pb.collection('audit_history').getOne(id, { requestKey: null });

    return {
      data: data.data || [],
      classDetails: data.classDetails || [],
      categoryStats: data.categoryStats || null,
      collaboratorStats: data.collaboratorStats || null
    };
  } catch (error: any) {
    if (error.isAbort || error.status === 0) return null;
    console.error('Error fetching item details:', error);
    throw error;
  }
};

const REPORT_LIMITS: Record<string, number> = {
  'audit': 5,
  'analysis': 1,
  'class': 1,
  'final_rupture': 1
};

// Função auxiliar para obter o intervalo da semana (Domingo a Sábado)
const getWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Dom) a 6 (Sab)

  const diffToSunday = day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - diffToSunday);
  sunday.setHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  return { sunday, saturday };
};

export const addHistoryItem = async (item: HistoryItem): Promise<void> => {
  const loja = item.loja || '204';
  const type = item.reportType;
  const limit = REPORT_LIMITS[type] || 5;

  try {
    if (type === 'rupture' || type === 'final_rupture') {
      // Regra: Apenas uma ruptura por semana (Dom a Sab)
      const itemDate = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
      const { sunday, saturday } = getWeekRange(itemDate);

      const isoSunday = sunday.toISOString().replace('T', ' ').substring(0, 19);
      const isoSaturday = saturday.toISOString().replace('T', ' ').substring(0, 19);

      // Busca registros de ruptura da mesma loja na mesma semana
      // Nota: customDate é string YYYY-MM-DD. Podemos filtrar por ele ou por created.
      // Para ser mais preciso com o que o usuário vê (semana do relatório):
      const existingInWeek = await pb.collection('audit_history').getFullList({
        filter: `loja = "${loja}" && reportType = "rupture" && created >= "${isoSunday}" && created <= "${isoSaturday}"`,
        requestKey: null
      });

      for (const record of existingInWeek) {
        console.log(`🗑️ Removendo ruptura duplicada na semana: ${record.id}`);
        await pb.collection('audit_history').delete(record.id);
      }
    } else {
      // Limpeza padrão por dia/limite para outros tipos
      let filter = `loja = "${loja}" && reportType = "${type}"`;
      if (item.customDate) {
        filter += ` && customDate = "${item.customDate}"`;
      } else {
        filter += ` && customDate = null`;
      }

      const existing = await pb.collection('audit_history').getFullList({
        filter: filter,
        sort: 'created',
        fields: 'id',
        requestKey: null
      });

      if (existing.length >= limit) {
        const toDeleteCount = (existing.length - limit) + 1;
        const toDelete = existing.slice(0, toDeleteCount);

        for (const record of toDelete) {
          await pb.collection('audit_history').delete(record.id);
        }
      }
    }

    // --- GARANTIA DE DATA (ROBUSTEZ) ---
    let finalCustomDate = item.customDate;

    if (!finalCustomDate) {
      // Tenta extrair do nome do arquivo
      finalCustomDate = extractDateFromFileName(item.fileName);

      // Se ainda não tiver, usa a data atual do sistema como fallback fixo
      if (!finalCustomDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        finalCustomDate = `${y}-${m}-${d}`;
        console.log(`📅 Data auto-atribuída para ${item.fileName}: ${finalCustomDate} (Atual)`);
      } else {
        console.log(`📅 Data extraída do arquivo ${item.fileName}: ${finalCustomDate}`);
      }
    }

    const payload = {
      fileName: item.fileName,
      reportType: item.reportType,
      customDate: finalCustomDate,
      stats: item.stats,
      data: item.data || [],
      classDetails: item.classDetails || [],
      categoryStats: item.categoryStats || null,
      collaboratorStats: item.collaboratorStats || null,
      loja: loja
    };

    await pb.collection('audit_history').create(payload);
  } catch (error: any) {
    console.error('Error adding history item:', error);
    if (error.data) {
      console.error('Validation errors:', JSON.stringify(error.data, null, 2));
    }
    throw error;
  }
};

export const updateHistoryItemDate = async (id: string, newDate: string): Promise<void> => {
  try {
    await pb.collection('audit_history').update(id, {
      customDate: newDate
    });
  } catch (error) {
    console.error('Error updating history item date:', error);
    throw error;
  }
};

export const deleteHistoryItemById = async (id: string): Promise<void> => {
  try {
    await pb.collection('audit_history').delete(id, { requestKey: null });
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

export const deleteAllHistory = async (): Promise<void> => {
  try {
    // PocketBase não tem "delete all" nativo simples via SDK sem loop ou batch
    // Como é uma operação de risco, vamos apenas avisar ou implementar via loop controlado
    const records = await pb.collection('audit_history').getFullList();
    for (const record of records) {
      await pb.collection('audit_history').delete(record.id);
    }
  } catch (error) {
    console.error('Error deleting all history:', error);
    throw error;
  }
};
