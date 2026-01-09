
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';
import { UserPlus, Trash2, Edit2, Shield, Store, User, X, Check, Loader2, AlertCircle, RefreshCw, Database, EyeOff, Lock, Eye, Terminal } from 'lucide-react';
import ModalConfirm from './ModalConfirm';

const supabaseUrl = 'https://uijltxipibmuucrjejzw.supabase.co';
const supabaseKey = 'sb_publishable_inbwxI-hC2PBz3ZCFTfeZw_gSshCX5C';
const tempSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

interface AdminPanelProps {
  onShowToast: (message: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onShowToast }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
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
    loja: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<{message: string, type: 'error' | 'warning' | 'info', sql?: string} | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });

      if (fetchError) {
        setError(`Erro ao carregar usuários: ${fetchError.message}`);
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch (err: any) {
      setError('Falha crítica ao conectar com o banco de dados.');
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
        loja: user.loja
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        role: 'user',
        loja: ''
      });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const extractErrorMessage = (err: any): {message: string, sql?: string} => {
    const rawMessage = err?.message || err?.error_description || (typeof err === 'string' ? err : 'Erro desconhecido');
    
    if (rawMessage.includes('profiles_role_check')) {
      return {
        message: 'ERRO DE BANCO: O nível "VIEWER" ainda não foi habilitado no seu Supabase.',
        sql: "ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;\nALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'viewer'));"
      };
    }

    if (rawMessage.includes('violates foreign key constraint') || rawMessage.includes('audit_history_user_id_fkey')) {
      return {
        message: 'ERRO: Histórico de auditoria bloqueando exclusão. É necessário atualizar a regra do banco.',
        sql: "-- Execute isto no SQL Editor:\nALTER TABLE audit_history DROP CONSTRAINT IF EXISTS audit_history_user_id_fkey;\nALTER TABLE audit_history ADD CONSTRAINT audit_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;"
      };
    }

    if (rawMessage.includes('admin_delete_user') || rawMessage.includes('function not found')) {
      return {
        message: 'ERRO: Função de exclusão total não configurada no Supabase.',
        sql: "CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nBEGIN\n  DELETE FROM public.profiles WHERE id = target_user_id;\n  DELETE FROM auth.users WHERE id = target_user_id;\nEND;\n$$;"
      };
    }

    return { message: rawMessage };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const cleanUsername = formData.username.trim().toLowerCase();
      const cleanLoja = formData.loja.trim() || '204';
      
      if (editingUser) {
        const { error: upError } = await supabase
          .from('profiles')
          .update({ role: formData.role, loja: cleanLoja })
          .eq('id', editingUser.id);
        
        if (upError) throw upError;

        if (formData.password.trim() !== '') {
          const { error: rpcError } = await supabase.rpc('admin_update_user_password', {
            target_user_id: editingUser.id,
            new_password: formData.password
          });
          if (rpcError) throw rpcError;
        }
        onShowToast("Usuário atualizado!");
      } else {
        const internalEmail = `${cleanUsername}@sistema.local`;
        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: internalEmail,
          password: formData.password,
          options: {
            data: { display_name: cleanUsername, loja: cleanLoja, role: formData.role }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              username: cleanUsername,
              role: formData.role,
              loja: cleanLoja
            });
          if (profileError) throw profileError;
        }
        onShowToast("Usuário criado!");
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      const errDetail = extractErrorMessage(err);
      setFormError({ message: errDetail.message, type: 'error', sql: errDetail.sql });
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    const { userId } = confirmModal;
    setFormLoading(true);
    try {
      const { error: delError } = await supabase.rpc('admin_delete_user', {
        target_user_id: userId
      });

      if (delError) throw delError;
      
      setConfirmModal({ ...confirmModal, isOpen: false });
      onShowToast("Usuário excluído!");
      fetchUsers();
    } catch (err: any) {
      console.error('Delete error:', err);
      const errDetail = extractErrorMessage(err);
      setFormError({ message: errDetail.message, type: 'error', sql: errDetail.sql });
      setIsModalOpen(true);
      setConfirmModal({ ...confirmModal, isOpen: false });
    } finally {
      setFormLoading(false);
    }
  };

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
                      <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-indigo-600 text-white' : 
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
                    <td className="px-8 py-6 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <input type="text" required disabled={!!editingUser || formLoading} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.replace(/\s+/g, '').toLowerCase()})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{editingUser ? 'Nova Senha (opcional)' : 'Senha'}</label>
                  <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" /><input type="password" required={!editingUser} minLength={6} disabled={formLoading} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 transition-all outline-none" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Função</label>
                    <select disabled={formLoading} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 outline-none appearance-none"><option value="user">USER</option><option value="viewer">VIEWER</option><option value="admin">ADMIN</option></select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Loja</label>
                    <input type="text" required disabled={formLoading} value={formData.loja} onChange={e => setFormData({...formData, loja: e.target.value.toUpperCase()})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 outline-none" />
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
