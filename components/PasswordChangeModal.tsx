
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, Lock, Check, Loader2, KeyRound, AlertCircle } from 'lucide-react';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ isOpen, onClose, username }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error: upError } = await supabase.auth.updateUser({
        password: password
      });

      if (upError) throw upError;

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg">
                <KeyRound className="w-5 h-5 text-white" />
             </div>
             <div className="text-left">
                <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Alterar Senha</h3>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mt-1">Conta: {username}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 p-2 hover:bg-white rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center flex flex-col items-center">
             <div className="bg-emerald-100 p-6 rounded-full mb-6">
                <Check className="w-12 h-12 text-emerald-600" />
             </div>
             <h4 className="text-2xl font-black text-slate-800 uppercase mb-2">Senha Atualizada!</h4>
             <p className="text-slate-500 font-bold text-sm">Sua nova senha já está ativa.</p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="p-10 space-y-6">
            {error && (
              <div className="p-4 rounded-2xl border-2 bg-red-50 border-red-200 text-red-700 flex items-start gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="text-xs font-black uppercase leading-tight text-left">{error}</span>
              </div>
            )}

            <div className="space-y-5 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nova Senha</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
                  <input 
                    type="password" 
                    required 
                    minLength={6}
                    autoFocus
                    disabled={loading} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="No mínimo 6 caracteres"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirmar Senha</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
                  <input 
                    type="password" 
                    required 
                    minLength={6}
                    disabled={loading} 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    placeholder="Repita a nova senha"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button 
                type="button" 
                disabled={loading} 
                onClick={onClose} 
                className="flex-1 px-5 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 text-[10px] tracking-widest uppercase transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Confirmar Alteração
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PasswordChangeModal;
