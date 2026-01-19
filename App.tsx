
import React, { useState, useRef, useMemo, useEffect, useCallback, startTransition } from 'react';
import FileUpload from './components/FileUpload';
import AuditTable from './components/AuditTable';
import AuditCharts from './components/AuditCharts';
import SummaryStats from './components/SummaryStats';
import HistorySidebar from './components/HistorySidebar';
import AuthScreen from './components/AuthScreen';
import AdminPanel from './components/AdminPanel';
import WeeklySummary from './components/WeeklySummary';
import ModalConfirm from './components/ModalConfirm';
import DetailedProductList from './components/DetailedProductList';
import CollaboratorRanking from './components/CollaboratorRanking';
import PasswordChangeModal from './components/PasswordChangeModal';
import Toast from './components/Toast';
import { AuditRow, ClassDetailRow, HistoryItem, UserProfile } from './types';
import { parseExcelFile, parseAnalysisFile, parseProductClassFile } from './services/excelService';
import { fetchHistory, addHistoryItem, deleteHistoryItemById, deleteAllHistory, fetchHistoryItemDetails, updateHistoryItemDate } from './services/historyService';
import { pb } from './services/pocketbase';
import { LayoutDashboard, RefreshCcw, Download, Copy, Package, EyeOff, Activity, BarChart2, FileSpreadsheet, Menu, CloudOff, Cloud, ShieldAlert, Loader2, Calendar, LayoutGrid, FileSearch, Hash, Check, Database, Terminal, Copy as CopyIcon, X, Share2, FilePlus } from 'lucide-react';
import html2canvas from 'html2canvas';

type ReportType = 'audit' | 'analysis' | 'class' | 'rupture' | 'final_rupture';
type ViewType = 'dashboard' | 'admin' | 'weekly';

const App: React.FC = () => {
  // 1. STATE HOOKS
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const [data, setData] = useState<AuditRow[]>([]);
  const [classDetails, setClassDetails] = useState<ClassDetailRow[]>([]);
  const [classCategoryStats, setClassCategoryStats] = useState<any>(null);
  const [classCollaboratorStats, setClassCollaboratorStats] = useState<{ [name: string]: number } | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCollaboratorView, setIsCollaboratorView] = useState(false);

  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('audit');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string>('');
  const [activeLoja, setActiveLoja] = useState<string>('');

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth >= 1024;
    return true;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Pull to Refresh State
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef<number | null>(null);

  // Modal & Toast States
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
  const [clearAllModal, setClearAllModal] = useState(false);
  const [dbErrorModal, setDbErrorModal] = useState<{ isOpen: boolean; message: string; sql: string }>({ isOpen: false, message: '', sql: '' });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [datePickerModal, setDatePickerModal] = useState<{ isOpen: boolean; reportId: string; currentDate: string }>({ isOpen: false, reportId: '', currentDate: '' });
  const [newDateValue, setNewDateValue] = useState('');
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Sku Modal State
  const [skuModal, setSkuModal] = useState<{ isOpen: boolean; pendingFile?: File; pendingResult?: any; pendingDate?: string | null }>({ isOpen: false });
  const [manualSku, setManualSku] = useState<string>('');

  const reportRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string) => setToast({ visible: true, message }), []);

  // 2. HELPER FUNCTIONS
  const fetchProfile = useCallback(async (user: any) => {
    try {
      // No PocketBase, o perfil já vem no authStore ou buscamos na coleção 'profiles'
      const userId = user.id;

      let profileData: any = null;
      try {
        profileData = await pb.collection('profiles').getFirstListItem(`user="${userId}"`, { requestKey: null });
      } catch (e: any) {
        // Silenciar erro de autocancelamento ou apenas informar que o perfil será criado
        if (!e.isAbort && e.status !== 0) {
          console.warn("Perfil não encontrado na coleção 'profiles', usando dados básicos.");
        }
      }


      const mergedProfile: UserProfile = {
        id: userId,
        username: profileData?.username || user.username || user.email || 'usuário',
        role: profileData?.role || user.role || 'user',
        loja: profileData?.loja || user.loja || '204',
        visibleLojas: [] // Inicializa vazio para ser populado abaixo
      };

      // ⚠️ WORKAROUND: Forçar admin estritamente para o usuário principal "admin"
      if (user.username === 'admin') {
        mergedProfile.role = 'admin';
        console.log('🔧 FORÇADO: Usuário admin detectado, role definido como admin');
      }

      // Se for admin, o campo 'visibleLojas' contém a lista CSV de lojas que ele pode ver
      // O campo 'loja' deve conter apenas a sua loja base (ID único)
      if (mergedProfile.role === 'admin') {
        // 1. Limpa o campo loja caso contenha CSV (erro antigo)
        if (mergedProfile.loja && mergedProfile.loja.includes(',')) {
          mergedProfile.loja = mergedProfile.loja.split(',')[0].trim();
        }

        // 2. Carrega lojas visíveis do novo campo, com fallback para loja se necessário
        const rawVisible = profileData?.visible_lojas || profileData?.visibleLojas || "";
        console.log('📊 Campos do Profile:', Object.keys(profileData || {}));
        console.log('📦 Conteúdo visibleLojas bruto:', rawVisible);

        const visibleList = String(rawVisible).split(',')
          .map((l: string) => l.trim())
          .filter((l: string) => l !== '' && l.length < 10);

        mergedProfile.visibleLojas = visibleList.length > 0 ? visibleList : [mergedProfile.loja];
        console.log('🎯 visibleLojas processadas:', mergedProfile.visibleLojas);
      }

      console.log('👤 Perfil final aplicado:', mergedProfile);

      setProfile(mergedProfile);
      setActiveLoja(prev => {
        // Se a loja anterior estiver corrompida por CSV, limpa
        if (prev && prev.includes(',')) return mergedProfile.loja;
        return prev || mergedProfile.loja;
      });

      console.log('✅ Perfil carregado com sucesso:', mergedProfile.username, 'Lojas:', mergedProfile.visibleLojas);
    } catch (err: any) {
      if (!err.isAbort && err.status !== 0) {
        console.error("Erro fatal no carregamento do perfil:", err);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!profile) return;
    setIsSyncing(true);
    try {
      const remoteHistory = await fetchHistory(profile);
      setHistory(remoteHistory || []);
    } catch (e: any) {
      if (!e.isAbort && e.status !== 0) {
        console.error("Histórico não pôde ser carregado:", e);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [profile]);

  // Pull to Refresh Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartRef.current = e.touches[0].pageY;
    } else {
      touchStartRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current !== null && !isRefreshing) {
      const currentY = e.touches[0].pageY;
      const diff = currentY - touchStartRef.current;
      if (diff > 0) {
        // Logarithmic resistance for smoother pull feel
        const resistance = 0.4;
        const newDist = Math.min(diff * resistance, 160);
        setPullDistance(newDist);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 120) {
      setIsRefreshing(true);
      setPullDistance(80);
      window.location.reload();
    } else {
      setPullDistance(0);
    }
    touchStartRef.current = null;
  };

  const handleSignOut = useCallback(async () => {
    pb.authStore.clear();
    setSession(null);
    setProfile(null);
  }, []);

  const addToHistory = async (newData: AuditRow[], type: ReportType, file: File, date: string | null, details?: ClassDetailRow[], categoryStats?: any, collaboratorStats?: any, overrideSku?: number) => {
    if (!session || !profile) return;

    let totalSku = overrideSku !== undefined ? overrideSku : newData.reduce((acc, curr) => acc + curr.sku, 0);
    const totalNotRead = newData.reduce((acc, curr) => acc + curr.notRead, 0);

    const hasOutdatedData = newData.some(row => row.outdated !== undefined);
    const totalOutdated = hasOutdatedData
      ? newData.reduce((acc, curr) => acc + (curr.outdated || 0), 0)
      : undefined;

    let generalPartial = totalSku > 0 ? (totalNotRead / totalSku) * 100 : 0;

    // Arredondar para cima se for Ruptura Final
    if (type === 'rupture') {
      generalPartial = Math.ceil(generalPartial);
    }

    setActiveLoja(profile.loja);

    const newItem: HistoryItem = {
      id: '',
      timestamp: Date.now(),
      fileName: file.name,
      reportType: type,
      data: newData,
      classDetails: details || [],
      categoryStats: categoryStats || null,
      collaboratorStats: collaboratorStats || null,
      stats: { totalSku, totalNotRead, totalOutdated, generalPartial },
      customDate: date,
      loja: profile.loja
    };

    setIsSyncing(true);
    try {
      await addHistoryItem(newItem);
      const updatedHistory = await fetchHistory(profile);
      setHistory(updatedHistory || []);

      const savedItem = updatedHistory[0];
      if (savedItem) {
        setActiveReportId(savedItem.id);
      }
    } catch (e: any) {
      console.error("Erro ao salvar no PocketBase:", e);
      if (e.data && e.data.data) {
        console.error("Detalhes da validação (Campos):", JSON.stringify(e.data.data, null, 2));
        const firstErrorField = Object.keys(e.data.data)[0];
        const errorMessage = e.data.data[firstErrorField].message || "Valor inválido";
        showToast(`Erro no campo '${firstErrorField}': ${errorMessage}`);
      } else {
        showToast("Erro ao salvar no banco de dados. Verifique a conexão.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleHistorySelect = useCallback(async (item: HistoryItem) => {
    setReportLoading(true);
    try {
      let detailedData = item.data;
      let detailedClass = item.classDetails;
      let detailedCatStats = item.categoryStats;
      let detailedCollStats = item.collaboratorStats;

      if (!detailedData || detailedData.length === 0) {
        const details = await fetchHistoryItemDetails(item.id);
        detailedData = details.data;
        detailedClass = details.classDetails;
        detailedCatStats = details.categoryStats;
        detailedCollStats = details.collaboratorStats;
      }

      startTransition(() => {
        setData(detailedData || []);
        setReportType(item.reportType);
        setCustomDate(item.customDate);
        setActiveReportId(item.id);
        setActiveLoja(item.loja);
        setClassDetails(detailedClass || []);
        setClassCategoryStats(detailedCatStats || null);
        setClassCollaboratorStats(detailedCollStats || null);
        setSelectedCategory(null);
        setIsCollaboratorView(false);
        setCurrentView('dashboard');
      });
    } catch (err) {
      console.error("Erro ao carregar detalhes do relatório:", err);
      showToast("Erro ao carregar dados do histórico.");
    } finally {
      setReportLoading(false);
    }

    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [profile, showToast]);

  const handleClassFileSelect = async (file: File, date: string | null) => {
    setLoading(true);
    setReportType('class');
    setCustomDate(date);

    try {
      const result = await parseProductClassFile(file);
      const targetDate = date || new Date().toLocaleDateString('en-CA');

      const lastAudit = [...history]
        .sort((a, b) => b.timestamp - a.timestamp)
        .find(h => h.reportType === 'audit' && h.loja === profile?.loja && h.stats.totalSku > 0);

      if (lastAudit) {
        const lastSku = lastAudit.stats.totalSku;
        startTransition(() => {
          setData(result.summary);
          setClassDetails(result.details);
          setClassCategoryStats(result.categoryStats);
          setClassCollaboratorStats(result.collaboratorStats);
          setSelectedCategory(null);
          setIsCollaboratorView(false);
        });
        await addToHistory(result.summary, 'class', file, date, result.details, result.categoryStats, result.collaboratorStats, lastSku);
      } else {
        setSkuModal({ isOpen: true, pendingFile: file, pendingResult: result, pendingDate: date });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSkuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sku = parseInt(manualSku);
    if (isNaN(sku) || sku <= 0) {
      showToast("SKU Inválido!");
      return;
    }

    if (skuModal.pendingResult && skuModal.pendingFile) {
      const result = skuModal.pendingResult;
      startTransition(() => {
        setData(result.summary);
        setClassDetails(result.details);
        setClassCategoryStats(result.categoryStats);
        setClassCollaboratorStats(result.collaboratorStats);
        setSelectedCategory(null);
        setIsCollaboratorView(false);
      });
      await addToHistory(result.summary, 'class', skuModal.pendingFile, skuModal.pendingDate || null, result.details, result.categoryStats, result.collaboratorStats, sku);
    }

    setSkuModal({ isOpen: false });
    setManualSku('');
  };

  const confirmClearAll = async () => {
    setIsSyncing(true);
    try {
      await deleteAllHistory();
      setHistory([]);
      setData([]);
      setClassDetails([]);
      setActiveReportId('');
      setClearAllModal(false);
      showToast("Histórico limpo!");
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmDeleteHistory = async () => {
    setIsSyncing(true);
    try {
      await deleteHistoryItemById(deleteModal.id);

      if (deleteModal.id === activeReportId) {
        startTransition(() => {
          setData([]);
          setClassDetails([]);
          setClassCategoryStats(null);
          setClassCollaboratorStats(null);
          setActiveReportId('');
        });
      }

      setHistory(prev => prev.filter(item => item.id !== deleteModal.id));
      setDeleteModal({ isOpen: false, id: '', name: '' });
      showToast("Auditoria removida!");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAuditFileSelect = async (file: File, date: string | null) => {
    setLoading(true); setReportType('audit'); setCustomDate(date);
    try {
      const parsedData = await parseExcelFile(file);
      startTransition(() => {
        setData(parsedData);
        setClassDetails([]); setClassCategoryStats(null); setClassCollaboratorStats(null);
      });
      await addToHistory(parsedData, 'audit', file, date);
      showToast("Arquivo importado!");
    } catch (error) {
      console.error(error);
      showToast("Erro ao ler o arquivo.");
    } finally { setLoading(false); }
  };

  const handleUpdateDate = async () => {
    if (!datePickerModal.reportId || !newDateValue) return;

    try {
      setIsSyncing(true);
      await updateHistoryItemDate(datePickerModal.reportId, newDateValue);

      // Atualizar estado local do histórico
      setHistory(prev => prev.map(item =>
        item.id === datePickerModal.reportId
          ? { ...item, customDate: newDateValue }
          : item
      ));

      // Se o relatório editado for o ativo, atualizar customDate
      if (activeReportId === datePickerModal.reportId) {
        setCustomDate(newDateValue);
      }

      showToast("Data atualizada com sucesso!");
      setDatePickerModal({ isOpen: false, reportId: '', currentDate: '' });
    } catch (error) {
      console.error(error);
      showToast("Erro ao atualizar a data.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAnalysisFileSelect = async (file: File, date: string | null) => {
    setLoading(true); setReportType('analysis'); setCustomDate(date);
    try {
      const parsedData = await parseAnalysisFile(file);
      startTransition(() => {
        setData(parsedData);
        setClassDetails([]); setClassCategoryStats(null); setClassCollaboratorStats(null);
      });
      await addToHistory(parsedData, 'analysis', file, date);
      showToast("Arquivo importado!");
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleFinalRuptureFileSelect = async (file: File, date: string | null) => {
    setLoading(true); setReportType('rupture'); setCustomDate(date);
    try {
      const parsedData = await parseAnalysisFile(file);
      startTransition(() => {
        setData(parsedData);
        setClassDetails([]); setClassCategoryStats(null); setClassCollaboratorStats(null);
      });
      await addToHistory(parsedData, 'rupture', file, date);
      showToast("Ruptura Final Importada!");
    } catch (error) {
      console.error(error);
      showToast("Erro ao importar ruptura final.");
    } finally { setLoading(false); }
  };

  const handleShareReport = async () => {
    if (!captureRef.current) return;
    try {
      setIsSyncing(true);
      const canvas = await html2canvas(captureRef.current, {
        scale: 3,
        backgroundColor: '#f1f5f9',
        logging: false,
        useCORS: true,
        width: 1452, // largura calculada: 3*420px + 2*48px (gap) + 2*48px (padding)
        onclone: (clonedDoc) => {
          const element = clonedDoc.getElementById('capture-container');
          if (element) {
            element.style.display = 'block';
          }
        }
      });

      // Converter para blob usando Promise para manter o contexto do gesto do usuário
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 0.95));

      if (!blob) {
        showToast("Erro ao gerar imagem.");
        return;
      }

      const file = new File([blob], `Relatorio_Auditoria_Loja_${activeLoja || profile?.loja}.png`, { type: 'image/png' });

      // Verificação de suporte ao compartilhamento
      // IMPORTANTE: navigator.share geralmente requer HTTPS para funcionar em dispositivos remotos
      if (navigator.share) {
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Relatório de Auditoria',
              text: 'Confira o relatório de auditoria da loja.'
            });
          } else {
            // Tenta compartilhar apenas o texto se arquivos não forem suportados
            await navigator.share({
              title: 'Relatório de Auditoria',
              text: 'Confira o relatório de auditoria da loja.'
            });
            showToast("Navegador não suporta compartilhamento de arquivos.");
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Erro ao compartilhar:', err);
            showToast("Erro ao abrir compartilhamento.");
          }
        }
      } else {
        // Fallback para download se não houver navigator.share (ex: ambiente HTTP)
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_Auditoria_Loja_${activeLoja || profile?.loja}.png`;
        link.click();

        // Mensagem explicativa específica sobre HTTPS
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
          showToast("Acesso via HTTP: Compartilhamento desativado pelo navegador. Imagem baixada.");
        } else {
          showToast("Compartilhamento não suportado. Imagem baixada.");
        }
      }
    } catch (error) {
      console.error(error);
      showToast("Erro ao preparar relatório.");
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerHeaderFileUpload = useCallback(() => {
    startTransition(() => {
      setData([]); setClassDetails([]); setCustomDate(null); setClassCategoryStats(null); setClassCollaboratorStats(null); setSelectedCategory(null); setIsCollaboratorView(false); setCurrentView('dashboard'); setActiveReportId('');
      if (profile) setActiveLoja(profile.loja);
    });
  }, [profile]);

  const getReportInfo = () => {
    const lojaNum = activeLoja || profile?.loja || '---';
    const histItem = history.find(h => h.id === activeReportId);
    const dateToUse = customDate ? new Date(customDate + 'T12:00:00') : new Date(histItem?.timestamp || Date.now());
    const dayOfWeek = dateToUse.getDay();

    let title = "";
    if (reportType === 'audit') {
      if (dayOfWeek === 1) title = `Auditoria de Etiqueta`;
      else if (dayOfWeek === 2) title = `Auditoria de Presença`;
      else if (dayOfWeek === 3) title = `Auditoria de Ruptura`;
      else if (dayOfWeek === 4) title = `Auditoria de Etiqueta`;
      else title = `Auditoria Parcial`;
    } else if (reportType === 'analysis') {
      title = `Resultado Auditoria`;
    } else if (reportType === 'rupture') {
      title = `Ruptura Final`;
    } else {
      title = `Não Lidos por Classe`;
    }

    return { title, store: `Loja ${lojaNum}` };
  };

  const getFormattedDateLabel = () => {
    const histItem = history.find(h => h.id === activeReportId);
    if (!activeReportId && !customDate) return "";
    if (customDate) {
      const parts = customDate.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
      }
    }
    return new Date(histItem?.timestamp || Date.now()).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).replace(',', ' às');
  };

  const handleExportImage = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 3,
        backgroundColor: '#f1f5f9',
        width: 1452,
        onclone: (clonedDoc) => {
          const element = clonedDoc.getElementById('capture-container');
          if (element) {
            element.style.display = 'block';
          }
        }
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Relatorio_${reportType}_Loja_${activeLoja}.png`;
      link.click();
      showToast("Relatório baixado!");
    } catch (err) {
      console.error("Erro exportando imagem:", err);
    }
  };

  const handleCopyReport = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 3,
        backgroundColor: '#f1f5f9',
        width: 1452,
        onclone: (clonedDoc) => {
          const element = clonedDoc.getElementById('capture-container');
          if (element) {
            element.style.display = 'block';
          }
        }
      });
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setShowCopySuccess(true);
          setTimeout(() => setShowCopySuccess(false), 3000);
        }
      });
    } catch (err) {
      console.error("Erro copiando imagem:", err);
    }
  };

  // 3. MEMO HOOKS
  const currentStats = useMemo(() => {
    if (data.length === 0 && !reportLoading) return { totalSku: 0, totalNotRead: 0, totalOutdated: undefined, generalPartial: 0, isSyncing: false };

    const histItem = history.find(h => h.id === activeReportId);
    const totalNotRead = data.reduce((acc, curr) => acc + curr.notRead, 0);

    const hasOutdatedData = data.some(row => row.outdated !== undefined);
    const totalOutdated = hasOutdatedData
      ? data.reduce((acc, curr) => acc + (curr.outdated || 0), 0)
      : undefined;

    let totalSku = histItem ? histItem.stats.totalSku : data.reduce((acc, curr) => acc + curr.sku, 0);

    if (reportType === 'class' && !histItem && !loading && !skuModal.isOpen && totalSku === totalNotRead) {
      totalSku = 0;
    }

    const generalPartialRaw = totalSku > 0 ? (totalNotRead / totalSku) * 100 : 0;
    const generalPartial = reportType === 'rupture' ? Math.ceil(generalPartialRaw) : generalPartialRaw;

    return {
      totalSku,
      totalNotRead,
      totalOutdated,
      generalPartial,
      isSyncing: loading || reportLoading
    };
  }, [data, history, activeReportId, reportType, loading, reportLoading, skuModal.isOpen]);

  const getEtiquetaFinalStats = useMemo(() => {
    if (!profile) return null;

    // Função auxiliar para intervalo semanal (Dom-Sab)
    const getWeekBoundaries = (dStr: string | null) => {
      const d = dStr ? new Date(dStr + 'T12:00:00') : new Date();
      const sunday = new Date(d);
      sunday.setDate(d.getDate() - d.getDay());
      sunday.setHours(0, 0, 0, 0);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      saturday.setHours(23, 59, 59, 999);
      return { sunday, saturday };
    };

    const period = getWeekBoundaries(customDate);

    // Filtra histórico por loja, tipo e semana selecionada
    const storeHistory = history.filter(h => {
      if (h.loja !== profile.loja) return false;
      if (h.reportType !== 'audit' && h.reportType !== 'analysis') return false;

      const itemDate = h.customDate ? new Date(h.customDate + 'T12:00:00') : new Date(h.timestamp);
      return itemDate >= period.sunday && itemDate <= period.saturday;
    });

    // Encontrar último de Segunda (1) e Último de Quinta (4) na semana filtrada
    let mondayItem: HistoryItem | null = null;
    let thursdayItem: HistoryItem | null = null;

    storeHistory.forEach(item => {
      const date = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
      const day = date.getDay();
      if (day === 1 && (!mondayItem || item.timestamp > mondayItem.timestamp)) mondayItem = item;
      if (day === 4 && (!thursdayItem || item.timestamp > thursdayItem.timestamp)) thursdayItem = item;
    });

    if (mondayItem && thursdayItem) {
      const m = mondayItem as HistoryItem;
      const t = thursdayItem as HistoryItem;
      const avg = (m.stats.generalPartial + t.stats.generalPartial) / 2;
      return {
        value: avg,
        monday: m.stats.generalPartial,
        thursday: t.stats.generalPartial
      };
    }

    return null;
  }, [history, profile, customDate]);

  const filteredDetailedRows = useMemo(() => {
    if (!selectedCategory) return [];
    const catLow = selectedCategory.toLowerCase();

    return classDetails.filter(row => {
      const situacao = (row as any).s || (row as any).situacao || "";
      const sitLow = situacao.toLowerCase();
      const estoque = (row as any).e !== undefined ? (row as any).e : (row as any).estoque || 0;

      if (catLow === 'total_not_read') {
        const isOutOfStock = sitLow.includes('sem estoque');
        const isOutdated = sitLow.includes('desatualizado');
        if (isOutOfStock || isOutdated) return false;

        const isNoRead = (sitLow.includes('não lido') || sitLow.includes('não lidos')) && sitLow.includes('estoque');
        const isNoPresence = sitLow.includes('sem presença') && sitLow.includes('estoque');

        return (isNoRead || isNoPresence) && (estoque > 0 || sitLow.includes('com estoque'));
      }

      if (catLow.includes('não lido')) {
        return (sitLow.includes('não lido') || sitLow.includes('não lidos')) && sitLow.includes('estoque');
      }
      if (catLow.includes('presença')) {
        return sitLow.includes('sem presença') && sitLow.includes('estoque');
      }
      return sitLow === catLow;
    });
  }, [classDetails, selectedCategory]);

  // 4. EFFECT HOOKS
  useEffect(() => {
    // Verificar sessão inicial do PocketBase
    if (pb.authStore.isValid) {
      setSession(pb.authStore.model);
      fetchProfile(pb.authStore.model);
    } else {
      setAuthLoading(false);
    }

    // Listener para mudanças na store do PocketBase
    const removeListener = pb.authStore.onChange((token, model) => {
      setSession(model);
      if (model) {
        fetchProfile(model);
      } else {
        setProfile(null);
        setHistory([]);
        setData([]);
        setHasAutoSelected(false);
        setCurrentView('dashboard');
        setActiveLoja('');
        setAuthLoading(false);
      }
    });

    return () => removeListener();
  }, [fetchProfile]);

  useEffect(() => {
    if (session && profile) {
      loadHistory();
    }
  }, [session, profile, loadHistory]);

  useEffect(() => {
    if (history.length > 0 && !hasAutoSelected && data.length === 0 && classDetails.length === 0 && currentView === 'dashboard') {
      const today = new Date().toLocaleDateString('en-CA');
      const todayItems = history.filter(item => {
        const itemDate = item.customDate || new Date(item.timestamp).toLocaleDateString('en-CA');
        return itemDate === today;
      });
      if (todayItems.length > 0) handleHistorySelect(todayItems[0]);
      setHasAutoSelected(true);
    }
  }, [history, hasAutoSelected, data.length, classDetails.length, currentView, handleHistorySelect]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin h-12 w-12 text-blue-600" /></div>;
  if (!session) return <AuthScreen onLoginSuccess={() => { }} />;

  const reportInfo = getReportInfo();
  const hasData = (data && data.length > 0) || (classDetails && classDetails.length > 0);
  const canEdit = profile?.role === 'admin' || profile?.role === 'user';

  return (
    <div
      className="min-h-screen bg-slate-100 text-slate-800 overscroll-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-[200] flex justify-center pointer-events-none transition-transform duration-200"
        style={{ transform: `translateY(${pullDistance - 50}px)` }}
      >
        <div className={`bg-white rounded-full shadow-xl border border-blue-100 p-2.5 flex items-center justify-center transition-all ${pullDistance > 120 ? 'scale-110 shadow-blue-200' : 'scale-90 opacity-60'}`}>
          <RefreshCcw
            className={`w-6 h-6 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
      </div>

      <HistorySidebar
        history={history} onSelect={handleHistorySelect} onClearAll={() => setClearAllModal(true)}
        activeReportId={activeReportId}
        onDelete={(id) => {
          const item = history.find(h => h.id === id);
          setDeleteModal({ isOpen: true, id, name: item?.fileName || 'esta auditoria' });
        }}
        isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onSignOut={handleSignOut} userEmail={profile?.username}
        isAdmin={profile?.role === 'admin'} role={profile?.role} loja={profile?.loja}
        onOpenAdmin={() => setCurrentView('admin')} onOpenDashboard={() => setCurrentView('dashboard')} onOpenWeekly={() => setCurrentView('weekly')}
        onOpenPasswordChange={() => setIsPasswordModalOpen(true)}
        activeView={currentView}
        selectedDate={customDate}
        onDateChange={setCustomDate}
      />

      <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}`}>
        <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10 h-20 flex items-center px-4 md:px-8">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-slate-100 lg:hidden"><Menu className="w-6 h-6" /></button>
            <div className={`p-2 rounded-lg transition-colors shadow-lg ${currentView === 'admin' ? 'bg-indigo-600' : currentView === 'weekly' ? 'bg-emerald-600' : 'bg-blue-600'}`}><LayoutDashboard className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">{currentView === 'admin' ? 'Administração' : currentView === 'weekly' ? 'Semanal' : 'Auditoria'}</h1>
          </div>
          {currentView === 'dashboard' && hasData && (
            <div className="flex gap-2 items-center">
              {/* Desktop Only Buttons */}
              <div className="relative">
                <button
                  onClick={handleCopyReport}
                  className="hidden md:flex p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  title="Copiar Relatório"
                >
                  <CopyIcon className="w-5 h-5" />
                </button>
                {showCopySuccess && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-100 animate-in fade-in slide-in-from-top-1 duration-300 z-50 whitespace-nowrap flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Copiado!
                  </div>
                )}
              </div>
              <button onClick={handleExportImage} className="hidden md:flex p-2 text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors" title="Baixar Imagem"><Download className="w-5 h-5" /></button>
              {canEdit && <button onClick={triggerHeaderFileUpload} className="hidden md:flex p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors" title="Nova Importação"><FilePlus className="w-5 h-5" /></button>}

              {/* Mobile Only Share Button */}
              <button
                onClick={handleShareReport}
                disabled={isSyncing}
                className="flex md:hidden p-3 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors active:scale-90"
              >
                {isSyncing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Share2 className="w-6 h-6" />}
              </button>
            </div>
          )}
        </header>

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-80px)]">
          {reportLoading && (
            <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-600 font-black uppercase tracking-widest text-xs">Carregando detalhes do relatório...</p>
            </div>
          )}

          {currentView === 'admin' ? <AdminPanel profile={profile} onShowToast={showToast} onProfileUpdate={(newProfile) => {
            setProfile(newProfile);
            // O useEffect que observa 'profile' irá disparar o loadHistory automaticamente
          }} /> : currentView === 'weekly' ? <WeeklySummary history={history} userProfile={profile} selectedDate={customDate} onSelectAudit={handleHistorySelect} onDateChange={setCustomDate} onImportFinalRupture={handleFinalRuptureFileSelect} /> : (
            !hasData ? (
              canEdit ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FileUpload onFileSelect={handleAuditFileSelect} isLoading={loading} title="Importar Auditoria" subtitle="Planilha Parcial" variant="blue" />
                  <FileUpload onFileSelect={handleAnalysisFileSelect} isLoading={loading} title="Importar Análise" subtitle="Planilha Detalhada" variant="purple" />
                  <FileUpload onFileSelect={handleClassFileSelect} isLoading={loading} title="Classe de Produto" subtitle="Itens por Classe" variant="orange" />
                </div>
              ) :
                <div className="mt-20 flex flex-col items-center text-center"><div className="bg-white p-12 rounded-[50px] shadow-2xl max-w-lg"><FileSearch className="w-12 h-12 text-slate-300 mx-auto mb-8" /><h3 className="text-2xl font-black mb-4 uppercase">Visualização de Dados</h3><p className="text-slate-500">Selecione um relatório no menu lateral para visualizar os dados salvos.</p></div></div>
            ) : (
              <div ref={reportRef} key={activeReportId || 'new'} className="animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col gap-1 mb-6 text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase leading-tight">
                    <span className="block md:inline">{reportInfo.title}</span>
                    <span className="block md:inline md:ml-2">{reportInfo.store}</span>
                  </h2>
                </div>

                <SummaryStats
                  data={data}
                  isAnalysis={reportType === 'analysis' || reportType === 'rupture'}
                  isClassReport={reportType === 'class'}
                  categoryStats={classCategoryStats}
                  collaboratorStats={classCollaboratorStats || {}}
                  selectedCategory={selectedCategory}
                  isCollaboratorView={isCollaboratorView}
                  onCategoryClick={(cat) => {
                    setIsCollaboratorView(false);
                    setSelectedCategory(cat === selectedCategory ? null : cat);
                  }}
                  onCollaboratorClick={() => {
                    setSelectedCategory(null);
                    setIsCollaboratorView(!isCollaboratorView);
                  }}
                  overrideStats={currentStats}
                />

                {isCollaboratorView && classCollaboratorStats ? (
                  <div className="mb-10">
                    <CollaboratorRanking
                      stats={classCollaboratorStats}
                      onClose={() => setIsCollaboratorView(false)}
                    />
                  </div>
                ) : selectedCategory ? (
                  <div className="mb-10">
                    <DetailedProductList
                      data={filteredDetailedRows}
                      category={selectedCategory}
                      onClose={() => setSelectedCategory(null)}
                      onShowToast={showToast}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    {data && data.length > 0 && (
                      <div className={`${reportType === 'class' ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
                        <AuditTable
                          data={data}
                          isAnalysis={reportType === 'analysis' || reportType === 'rupture'}
                          isClassReport={reportType === 'class'}
                          dateLabel={getFormattedDateLabel()}
                          onDateClick={canEdit ? () => {
                            if (!activeReportId) {
                              showToast("Selecione um relatório salvo para editar a data.");
                              return;
                            }
                            const item = history.find(h => h.id === activeReportId);
                            const initialDate = customDate || (item?.customDate) || new Date().toISOString().split('T')[0];
                            setDatePickerModal({ isOpen: true, reportId: activeReportId, currentDate: initialDate });
                            setNewDateValue(initialDate);
                          } : undefined}
                        />
                      </div>
                    )}
                    {reportType !== 'class' && data && data.length > 0 && <div className="xl:col-span-4"><AuditCharts data={data} /></div>}
                  </div>
                )}
              </div>
            )
          )}
        </main>
      </div>

      {dbErrorModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-red-100">
            <div className="px-10 py-10 bg-red-50 flex flex-col items-center text-center relative">
              <button onClick={() => setDbErrorModal({ ...dbErrorModal, isOpen: false })} className="absolute top-6 right-6 text-red-300 hover:text-red-500 p-2 hover:bg-white/50 rounded-full transition-all"><X className="w-7 h-7" /></button>
              <div className="bg-red-600 p-6 rounded-[28px] shadow-xl shadow-red-200 mb-8 scale-110"><Database className="w-10 h-10 text-white" /></div>
              <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4 leading-tight">{dbErrorModal.message}</h3>
              <p className="text-slate-500 font-bold text-sm leading-relaxed px-10">Para utilizar relatórios de classe, você precisa garantir que sua coleção no PocketBase tenha todos os campos necessários. Entre em contato com o suporte ou verifique o esquema da coleção <strong>audit_history</strong>.</p>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-slate-900 rounded-3xl p-6 border-2 border-slate-800 relative group overflow-hidden">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Script SQL de Reparo</span>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(dbErrorModal.sql); showToast("SQL Copiado!"); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-90"><CopyIcon className="w-3.5 h-3.5" /> Copiar Código</button>
                </div>
                <pre className="font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all py-2 max-h-[150px] custom-scrollbar">
                  {dbErrorModal.sql}
                </pre>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setDbErrorModal({ ...dbErrorModal, isOpen: false })} className="w-full bg-slate-800 hover:bg-black text-white font-black py-4.5 rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-[10px] tracking-widest">Entendi, Vou Executar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {skuModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 bg-blue-50 flex flex-col items-center text-center">
              <div className="bg-blue-600 p-5 rounded-[24px] shadow-xl mb-6">
                <Hash className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">Informar SKU</h3>
              <p className="text-slate-500 font-bold text-sm leading-relaxed mb-6">
                Não encontramos uma auditoria para este dia. Informe o total de SKU da loja para calcularmos a parcial do relatório de classe.
              </p>

              <form onSubmit={handleManualSkuSubmit} className="w-full space-y-4">
                <input
                  type="number"
                  required
                  autoFocus
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  placeholder="Ex: 12500"
                  className="w-full px-6 py-4 bg-white border-2 border-blue-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 outline-none text-center text-2xl transition-all"
                />

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSkuModal({ isOpen: false });
                      if (!history.some(h => h.id === activeReportId)) {
                        setData([]);
                        setClassDetails([]);
                        setActiveReportId('');
                      }
                    }}
                    className="flex-1 px-6 py-4 rounded-2xl font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest"
                  >
                    Ignorar SKU
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 uppercase text-[10px] tracking-widest"
                  >
                    <Check className="w-4 h-4" /> Confirmar SKU
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ModalConfirm
        isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={confirmDeleteHistory} title="Excluir Auditoria?"
        message={`Deseja remover o registro "${deleteModal.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover" isLoading={isSyncing} variant="danger"
      />

      <ModalConfirm
        isOpen={clearAllModal} onClose={() => setClearAllModal(false)}
        onConfirm={confirmClearAll} title="Limpar Histórico?"
        message="Deseja remover TODOS os registros do seu histórico? Esta ação é irreversível."
        confirmLabel="Limpar Tudo" isLoading={isSyncing} variant="danger"
      />

      <PasswordChangeModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        username={profile?.username || ''}
      />

      <Toast
        isVisible={toast.visible}
        message={toast.message}
        onClose={() => setToast({ ...toast, visible: false })}
      />

      {datePickerModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            <div className="bg-blue-600 p-8 text-white relative">
              <button
                onClick={() => setDatePickerModal({ isOpen: false, reportId: '', currentDate: '' })}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Alterar Data</h3>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-widest opacity-80">Ajuste o dia do relatório</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nova Data da Auditoria</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <input
                      type="date"
                      value={newDateValue}
                      onChange={(e) => setNewDateValue(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-black text-slate-900 uppercase tracking-tight"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleUpdateDate}
                    disabled={isSyncing}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Salvar Alteração
                  </button>
                  <button
                    onClick={() => setDatePickerModal({ isOpen: false, reportId: '', currentDate: '' })}
                    className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 active:scale-[0.98] transition-all"
                  >
                    Manter Atual
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Container Oculto para Captura de Imagem (Força Layout Desktop) */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1452px' }}>
        <div ref={captureRef} id="capture-container" className="bg-slate-100 p-12 w-[1452px]">
          <div className="flex flex-col gap-1 mb-10 text-left px-4">
            <h1 className="text-5xl font-black text-slate-900 tracking-tight uppercase leading-tight">
              <span>{reportInfo.title}</span>
              <span className="ml-4 text-blue-600 font-black">{reportInfo.store}</span>
            </h1>
          </div>

          <div className="px-4">
            <SummaryStats
              data={data}
              isAnalysis={reportType === 'analysis'}
              isClassReport={reportType === 'class'}
              categoryStats={classCategoryStats}
              collaboratorStats={classCollaboratorStats || {}}
              selectedCategory={null}
              isCollaboratorView={false}
              overrideStats={currentStats}
              forceDesktopLayout={true}
            />
          </div>

          <div className="flex gap-12 items-start px-4">
            <div className={`${reportType === 'class' ? 'w-full' : 'w-[888px]'} flex-shrink-0`}>
              <AuditTable
                data={data}
                isAnalysis={reportType === 'analysis'}
                isClassReport={reportType === 'class'}
                dateLabel={getFormattedDateLabel()}
                forceDesktopLayout={true}
              />
            </div>
            {reportType !== 'class' && data && data.length > 0 && (
              <div className="w-[420px] flex-shrink-0">
                <AuditCharts data={data} forceDesktopLayout={true} />
              </div>
            )}
          </div>

          <div className="mt-12 p-8 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-sm mx-4 flex justify-between items-center text-slate-400 font-black uppercase tracking-[0.25em] text-[11px]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>PAINEL DE MONITORAMENTO TÉCNICO</span>
            </div>
            <span>RELATÓRIO OFICIAL • {new Date().toLocaleString('pt-BR')}</span>
            <div className="flex items-center gap-3 text-slate-500">
              <span className="bg-slate-100 px-4 py-1.5 rounded-full">{history.length} REGISTROS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
