
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Store, User, Shield, Edit2, Trash2, UserPlus, X, Check, Loader2, AlertCircle, FileText, LayoutDashboard, History, Settings, ExternalLink, LogOut, Terminal, Eye, EyeOff, RefreshCw, Lock, UserPlus2 } from 'lucide-react';
import ModalConfirm from './ModalConfirm';
import { pb } from '../services/pocketbase';

interface AdminPanelProps {
  onShowToast: (message: string) => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  profile: UserProfile | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onShowToast, onProfileUpdate, profile }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Custom Confirmation States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    userId: string;
    username: string;
  }>({ isOpen: false, userId: '', username: '' });

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user' | 'viewer',
    loja: '',
    regional: 'NE 2'
  });

  // Novos estados para filtro de lojas do admin
  const [adminLojas, setAdminLojas] = useState<string[]>([]);
  const [allAvailableLojas, setAllAvailableLojas] = useState<string[]>([]);
  const [isSavingLojas, setIsSavingLojas] = useState(false);

  useEffect(() => {
    const loadAdminLojas = async () => {
      // 1. Carregar lojas já selecionadas do perfil (prioridade absoluta para o estado global)
      if (profile?.visibleLojas && profile.visibleLojas.length > 0) {
        setAdminLojas(profile.visibleLojas);
      } else if (profile?.id) {
        // Fallback: Se o perfil não tem visibleLojas carregado ainda, busca do banco agora
        try {
          const profileRecord = await pb.collection('profiles').getFirstListItem(`user="${profile.id}"`, { requestKey: null });
          console.log('📊 [AdminPanel] Campos do Profile no banco:', Object.keys(profileRecord));
          const rawVisible = profileRecord.visible_lojas || profileRecord.visibleLojas || "";

          if (rawVisible) {
            const list = rawVisible.split(',').map((l: string) => l.trim()).filter((l: string) => l !== "");
            console.log('🎯 [AdminPanel] Lojas recuperadas do banco:', list);
            setAdminLojas(list);
          }
        } catch (e) {
          console.warn("Nenhuma preferência anterior encontrada no banco.");
        }
      }

      // 2. Buscar todas as lojas que existem no histórico E nos perfis para dar como opção
      try {
        const historyRecords = await pb.collection('audit_history').getFullList({ fields: 'loja', requestKey: null });
        const profileRecords = await pb.collection('profiles').getFullList({ fields: 'loja', requestKey: null });

        // Combina lojas do histórico e dos usuários cadastrados
        const allSources = [
          ...historyRecords.map(r => r.loja),
          ...profileRecords.flatMap(r => String(r.loja).split(',').map(l => l.trim()))
        ];

        const allLojasFound = allSources
          .filter(l => l && l !== '' && l.length < 10 && !l.includes(','));

        const uniqueLojas = Array.from(new Set(allLojasFound)).sort();
        setAllAvailableLojas(uniqueLojas);
      } catch (e) {
        console.error("Erro ao carregar lojas disponíveis:", e);
      }
    };

    if (profile) loadAdminLojas();
  }, [profile]);

  const toggleAdminLoja = (loja: string) => {
    setAdminLojas(prev =>
      prev.includes(loja) ? prev.filter(l => l !== loja) : [...prev, loja]
    );
  };

  const selectAllLojas = () => {
    setAdminLojas(allAvailableLojas);
  };

  const clearAllLojas = () => {
    setAdminLojas([]);
  };

  const saveAdminLojas = async () => {
    if (!profile) return;
    setIsSavingLojas(true);
    try {
      const lojasCsv = adminLojas.join(',');
      console.log('💾 Salvando visibleLojas no banco para o usuário:', profile.id, 'Conteúdo:', lojasCsv);

      let profileRecord: any = null;
      try {
        const allProfiles = await pb.collection('profiles').getFullList({
          filter: `user="${profile.id}"`,
          sort: '-created',
          requestKey: null
        });
        if (allProfiles.length > 0) {
          profileRecord = allProfiles[0];
          for (let i = 1; i < allProfiles.length; i++) {
            await pb.collection('profiles').delete(allProfiles[i].id).catch(e => { });
          }
        }
      } catch (e) { }

      if (!profileRecord) return;

      await pb.collection('profiles').update(profileRecord.id, {
        visible_lojas: lojasCsv
      }, { requestKey: null });

      console.log('✅ Salvo com sucesso no PocketBase!');

      // LIMPEZA DE CACHE: Garante que o App.tsx recarregue do banco no próximo refresh
      if (profile.id) {
        const cacheKey = `pb_profile_${profile.id}`;
        localStorage.removeItem(cacheKey);
        console.log('🧹 Cache local limpo:', cacheKey);
      }

      // Notificar o componente App sobre a mudança
      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          visibleLojas: adminLojas
          // NOTA: O campo 'loja' (loja base) permanece intacto aqui
        });
      }

      onShowToast("Preferências de lojas salvas!");
    } catch (e) {
      console.error("Erro ao salvar lojas do admin:", e);
      onShowToast("Erro ao salvar preferências.");
    } finally {
      setIsSavingLojas(false);
    }
  };
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<{ message: string, type: 'error' | 'warning' | 'info', sql?: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // No PocketBase, buscamos os perfis
      const records = await pb.collection('profiles').getFullList({
        sort: 'username',
        requestKey: null // Evita auto-cancelamento
      });

      // Deduplicação na listagem para o Admin
      const uniqueMap = new Map<string, UserProfile>();
      records.forEach(r => {
        // LOG CRÍTICO PARA DESCOBRIR COLUNAS REAIS
        if (records.indexOf(r) === 0) {
          console.log('🏗️ [Schema Audit] Colunas reais da coleção profiles:', Object.keys(r));
        }

        const userData: UserProfile = {
          id: r.user,
          username: r.username,
          role: r.role,
          loja: r.loja,
          regional: r.regional || 'NE 2'
        };

        if (!uniqueMap.has(r.user)) {
          uniqueMap.set(r.user, userData);
        }
      });

      setUsers(Array.from(uniqueMap.values()));
    } catch (err: any) {
      if (!err.isAbort && err.status !== 0) {
        console.error('Fetch users error:', err);
        setError('Erro ao carregar usuários do PocketBase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        role: user.role,
        loja: user.loja,
        regional: user.regional || 'NE 2'
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        role: 'user',
        loja: '',
        regional: 'NE 2'
      });
    }
    setFormError(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const extractErrorMessage = (err: any): { message: string, type: 'error' | 'warning' | 'info', sql?: string } => {
    return {
      message: err?.message || 'Erro inesperado no PocketBase',
      type: 'error'
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const cleanUsername = formData.username.trim().toLowerCase();
      const cleanLoja = formData.loja.trim() || '204';
      const internalEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@auditoria.com`;

      // Validação de senha
      if (formData.password.trim() !== '' && formData.password.length < 8) {
        setFormError({ message: 'A senha deve ter pelo menos 8 caracteres.', type: 'error' });
        setFormLoading(false);
        return;
      }

      if (editingUser) {
        // 1. Buscar TODOS os registros para este usuário para evitar duplicatas silenciadas
        let profileRecord: any = null;
        try {
          const allProfiles = await pb.collection('profiles').getFullList({
            filter: `user="${editingUser.id}"`,
            sort: '-created',
            requestKey: null
          });

          if (allProfiles.length > 0) {
            profileRecord = allProfiles[0];
            // Se houver duplicatas, remove as extras
            for (let i = 1; i < allProfiles.length; i++) {
              await pb.collection('profiles').delete(allProfiles[i].id).catch(e => console.error("Erro ao limpar duplicata no save:", e));
            }
          }
        } catch (e) {
          console.warn("Erro ao buscar registros para deduplicação no save.");
        }

        // 2. Atualizar ou Criar perfil (Upsert)
        if (profileRecord) {
          console.log('📤 [AdminPanel] Atualizando perfil existente:', profileRecord.id, { regional: formData.regional.trim() });
          const updateRes = await pb.collection('profiles').update(profileRecord.id, {
            role: formData.role,
            loja: cleanLoja,
            regional: formData.regional.trim() || 'NE 2'
          }, { requestKey: null });
          console.log('📥 [AdminPanel] Resposta UPDATE perfil:', updateRes);
        } else {
          console.log('📤 [AdminPanel] Criando novo perfil para:', editingUser.id);
          const createRes = await pb.collection('profiles').create({
            user: editingUser.id,
            username: cleanUsername,
            role: formData.role,
            loja: cleanLoja,
            regional: formData.regional.trim() || 'NE 2'
          }, { requestKey: null });
          console.log('📥 [AdminPanel] Resposta CREATE perfil:', createRes);
        }

        // 3. Atualizar senha no Auth do PocketBase se fornecida
        if (formData.password.trim() !== '') {
          try {
            await pb.collection('users').update(editingUser.id, {
              password: formData.password,
              passwordConfirm: formData.password
            }, { requestKey: null });
            onShowToast("Usuário e senha atualizados!");
          } catch (passErr: any) {
            console.error('Erro ao atualizar senha:', passErr);
            onShowToast('Perfil atualizado, mas erro ao mudar senha (Verifique as API Rules).');
          }
        } else {
          onShowToast("Usuário atualizado!");
        }

        // 4. LIMPEZA DE CACHE CRÍTICA: Garante que o sistema recarregue os dados corretos
        const cacheKey = `pb_profile_${editingUser.id}`;
        localStorage.removeItem(cacheKey);
        console.log('🧹 Cache local do usuário editado removido:', cacheKey);

        // EXTRA: Se o admin editou a si mesmo, sincroniza o App imediatamente
        if (editingUser.id === profile?.id && onProfileUpdate) {
          onProfileUpdate({
            ...editingUser,
            role: formData.role,
            loja: cleanLoja,
            regional: formData.regional || 'NE 2'
          });
        }
      } else {
        // Criar no PocketBase
        console.log('🚀 Iniciando criação de usuário:', cleanUsername);

        let authData;
        try {
          authData = await pb.collection('users').create({
            email: internalEmail,
            password: formData.password,
            passwordConfirm: formData.password,
            username: cleanUsername,
            name: cleanUsername
          }, { requestKey: null });
          console.log('✅ Usuário criado no Auth:', authData.id);
        } catch (authErr: any) {
          console.error('❌ Falha ao criar usuário no Auth:', authErr);
          throw new Error(`Falha na criação do usuário: ${authErr.message}`);
        }

        if (authData) {
          console.log('🚀 Iniciando criação de perfil para:', authData.id);
          try {
            await pb.collection('profiles').create({
              user: authData.id,
              username: cleanUsername,
              role: formData.role,
              loja: cleanLoja,
              regional: formData.regional || 'NE 2'
            }, { requestKey: null });
            console.log('✅ Perfil criado com sucesso');
          } catch (profileErr: any) {
            console.error('❌ Falha ao criar perfil:', profileErr);
            onShowToast("Usuário criado (Auth), mas houve erro ao criar o Perfil.");
            throw new Error(`Usuário criado, mas falha no Perfil: ${profileErr.message}`);
          }
        }
        onShowToast("Usuário e Perfil criados com sucesso!");
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setFormError({ message: err.message || 'Erro ao salvar no PocketBase', type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    const { userId } = confirmModal;
    setFormLoading(true);
    try {
      // 1. Deletar perfil
      try {
        const profileRecord = await pb.collection('profiles').getFirstListItem(`user="${userId}"`, { requestKey: null });
        await pb.collection('profiles').delete(profileRecord.id, { requestKey: null });
      } catch (e) {
        console.warn("Perfil não encontrado ao deletar, prosseguindo para o Auth.");
      }

      // 2. Deletar usuário no Auth
      await pb.collection('users').delete(userId, { requestKey: null });

      setConfirmModal({ ...confirmModal, isOpen: false });
      onShowToast("Usuário excluído!");
      fetchUsers();
    } catch (err: any) {
      console.error('Delete error:', err);
      setFormError({ message: err.message || 'Erro ao excluir usuário', type: 'error' });
      setIsModalOpen(true);
      setConfirmModal({ ...confirmModal, isOpen: false });
    } finally {
      setFormLoading(false);
    }
  };

  // Bloqueio de segurança: Se não for admin, não renderiza nada
  if (profile && profile.role !== 'admin' && pb.authStore.model?.username !== 'admin') {
    return (
      <div className="p-8 text-center bg-white rounded-3xl shadow-sm max-w-lg mx-auto mt-20">
        <h2 className="text-xl font-black text-red-600 uppercase">Acesso Negado</h2>
        <p className="text-slate-500 mt-2">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm w-full sm:w-auto">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Equipe de Auditoria</h2>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-1">Gestão de Acessos e Permissões</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} title="Recarregar" className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-colors shadow-sm active:scale-90">
            <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-blue-100 active:scale-95 uppercase text-xs tracking-widest">
            <UserPlus className="w-6 h-6" /> CRIAR USUÁRIO
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Lojas Visíveis para você</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Selecione quais lojas deseja visualizar no painel</p>
          </div>
          <button
            onClick={saveAdminLojas}
            disabled={isSavingLojas}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95 uppercase text-[10px] tracking-widest disabled:opacity-50"
          >
            {isSavingLojas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            SALVAR PREFERÊNCIAS
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {allAvailableLojas.length === 0 ? (
              <p className="text-slate-400 text-[10px] font-black uppercase italic">Nenhuma loja detectada no histórico ainda...</p>
            ) : (
              allAvailableLojas.map(lojaId => (
                <button
                  key={lojaId}
                  onClick={() => toggleAdminLoja(lojaId)}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${adminLojas.includes(lojaId)
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                >
                  <Store className={`w-4 h-4 ${adminLojas.includes(lojaId) ? 'text-blue-100' : 'text-slate-200'}`} />
                  Loja {lojaId}
                </button>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-slate-50">
            <button
              onClick={selectAllLojas}
              className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors flex items-center gap-2"
            >
              <Check className="w-3 h-3" /> Selecionar Tudo
            </button>
            <div className="w-1 h-1 bg-slate-200 rounded-full" />
            <button
              onClick={clearAllLojas}
              className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors flex items-center gap-2"
            >
              <X className="w-3 h-3" /> Limpar Seleção
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Sincronizando Banco...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Usuário</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nível</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Loja</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Regional</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 group-hover:bg-white transition-colors">
                          <User className="w-6 h-6 text-slate-600" />
                        </div>
                        <p className="font-black text-slate-900 text-lg leading-none">{user.username}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${user.role === 'admin' ? 'bg-indigo-600 text-white' :
                        (user.role === 'viewer' ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-emerald-50 text-emerald-700')
                        }`}>
                        {user.role === 'admin' ? <Shield className="w-3 h-3" /> : (user.role === 'viewer' ? <Eye className="w-3 h-3" /> : <Shield className="w-3 h-3" />)}
                        {user.role === 'admin' ? 'ADMIN' : (user.role === 'viewer' ? 'VIEWER' : 'USER')}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
                        <Store className="w-4 h-4 opacity-40" /> {user.loja || '---'}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
                        <FileText className="w-4 h-4 opacity-40" /> {user.regional || '---'}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-3 transition-opacity">
                        <button onClick={() => handleOpenModal(user)} title="Editar" className="p-3 text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors border border-blue-100">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, userId: user.id, username: user.username })}
                          disabled={user.username === 'admin'}
                          className="p-3 text-red-600 hover:bg-red-50 rounded-2xl transition-colors border border-red-100 disabled:opacity-30"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 uppercase">
                  {editingUser ? <Edit2 className="w-7 h-7 text-blue-600" /> : <UserPlus className="w-7 h-7 text-blue-600" />}
                  {editingUser ? 'Alterar Acesso' : 'Novo Usuário'}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 text-left">Configurações de Perfil</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-2 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-7 h-7" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-10 space-y-6">
              {formError && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl border-2 bg-red-50 border-red-200 text-red-700 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="text-xs font-black uppercase leading-tight text-left">{formError.message}</span>
                  </div>
                  {formError.sql && (
                    <div className="bg-slate-900 p-4 rounded-2xl overflow-hidden group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                          <Terminal className="w-3 h-3" /> Script de Correção SQL
                        </span>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(formError.sql!); onShowToast("SQL Copiado!"); }} className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase underline">Copiar</button>
                      </div>
                      <code className="text-[10px] font-mono text-emerald-400 block break-all leading-relaxed bg-black/40 p-3 rounded-lg border border-white/5 text-left">
                        {formError.sql}
                      </code>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-5 text-left">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Usuário</label>
                  <input type="text" required disabled={!!editingUser || formLoading} value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value.replace(/\s+/g, '').toLowerCase() })} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{editingUser ? 'Nova Senha (opcional)' : 'Senha'}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!editingUser}
                      minLength={8}
                      disabled={formLoading}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? "Deixe vazio para manter" : "No mínimo 8 dígitos"}
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Função</label>
                    <select disabled={formLoading} value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 outline-none appearance-none"><option value="user">USER</option><option value="viewer">VIEWER</option><option value="admin">ADMIN</option></select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Loja Base</label>
                      <input
                        type="text"
                        placeholder="Ex: 204"
                        value={formData.loja}
                        onChange={e => setFormData({ ...formData, loja: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Regional</label>
                      <input
                        type="text"
                        placeholder="Ex: NE 2"
                        value={formData.regional}
                        onChange={e => setFormData({ ...formData, regional: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" disabled={formLoading} onClick={() => setIsModalOpen(false)} className="flex-1 px-5 py-4 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Cancelar</button>
                <button type="submit" disabled={formLoading} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 text-[10px] tracking-widest uppercase">{formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{editingUser ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalConfirm
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmDeleteUser}
        title="Remover Usuário?"
        message={`Deseja remover PERMANENTEMENTE o usuário ${confirmModal.username}? As auditorias criadas por ele serão preservadas na base de dados.`}
        confirmLabel="Remover Agora"
        isLoading={formLoading}
        variant="danger"
      />
    </div>
  );
};

export default AdminPanel;
