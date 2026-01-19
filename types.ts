
export interface AuditRow {
  corridor: string;
  sku: number;
  notRead: number;
  outdated?: number;
  partialPercentage: number;
  id: string;
}

export interface ClassDetailRow {
  c: string | number; // codigo
  p: string;         // produto
  e: number;         // estoque
  r: string;         // classeRaiz
  l: string;         // local
  s: string;         // situacao
}

export interface RawExcelRow {
  [key: string]: string | number;
}

export interface AnalysisState {
  isLoading: boolean;
  text: string | null;
  error: string | null;
}

export interface ProductClassResult {
  summary: AuditRow[];
  details: ClassDetailRow[];
  categoryStats: {
    semEstoque: number;
    desatualizado: number;
    naoLidoComEstoque: number;
    semPresencaComEstoque: number;
  };
  collaboratorStats: { [name: string]: number };
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  reportType: 'audit' | 'analysis' | 'class' | 'final_rupture' | 'rupture';
  data: AuditRow[];
  classDetails?: ClassDetailRow[];
  categoryStats?: {
    semEstoque: number;
    desatualizado: number;
    naoLidoComEstoque: number;
    semPresencaComEstoque: number;
  } | null;
  collaboratorStats?: { [name: string]: number } | null;
  stats: {
    totalSku: number;
    totalNotRead: number;
    totalOutdated?: number;
    generalPartial: number;
  };
  customDate: string | null;
  loja: string;
}

export interface UserProfile {
  id: string;
  username: string;
  role: 'admin' | 'user' | 'viewer';
  loja: string;
  visibleLojas?: string[];
}
