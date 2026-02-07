
import React, { useState } from 'react';
import { pb } from '../services/pocketbase';
import { Lock, User, Loader2, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanUsername = usernameInput.trim().toLowerCase();

      if (!cleanUsername || !password) {
        throw new Error('Por favor, informe o usuário e a senha.');
      }

      // No PocketBase, tentamos logar diretamente.
      // Se você configurou para logar com e-mail, usamos o e-mail.
      // Se configurou para logar com username, usamos o username.
      const isEmail = cleanUsername.includes('@');

      const tryLogin = async (identity: string) => {
        return await pb.collection('users').authWithPassword(identity, password);
      };

      if (isEmail) {
        await tryLogin(cleanUsername);
      } else {
        // Usa o último domínio que funcionou ou tenta o novo padrão
        const lastDomain = localStorage.getItem('last_auth_domain') || '@auditoria.com';
        const fallbackDomain = lastDomain === '@auditoria.com' ? '@sistema.local' : '@auditoria.com';

        try {
          await tryLogin(`${cleanUsername}${lastDomain}`);
          localStorage.setItem('last_auth_domain', lastDomain);
        } catch (authErr: any) {
          if (authErr.status === 400 || authErr.status === 404) {
            console.log(`Tentando domínio alternativo ${fallbackDomain}...`);
            await tryLogin(`${cleanUsername}${fallbackDomain}`);
            localStorage.setItem('last_auth_domain', fallbackDomain);
          } else {
            throw authErr;
          }
        }
      }

      onLoginSuccess();
    } catch (err: any) {
      // Prevenção robusta contra [object Object]
      let finalMessage = 'Erro ao realizar login.';

      if (typeof err === 'string') {
        finalMessage = err;
      } else if (err instanceof Error) {
        finalMessage = err.message;
      } else if (err.error_description) {
        finalMessage = err.error_description;
      } else if (err.message) {
        finalMessage = err.message;
      }

      setError(finalMessage);
      console.error('Auth Error Detail:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-10">
          <div className="bg-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Lock className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            AUDITORIA LOJAS
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-2 uppercase tracking-widest">
            Acesso por Usuário
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 font-bold leading-tight">
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nome de Usuário</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
              <input
                type="text"
                required
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                placeholder="Ex: pablo.silva"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                placeholder="••••••••"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4.5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm tracking-widest"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <LogIn className="w-6 h-6" /> ENTRAR NO SISTEMA
              </>
            )}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
            autoria de Marcos Silva
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
