import { useState } from 'react';
import { supabase } from '../lib/offlineClient';
import { requestPasswordReset } from '../lib/auth';
import { Crown, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        await requestPasswordReset(email);
        setSuccess('Si el email existe, te enviamos un link para restablecer la contraseña.');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-plata-900 via-plata-800 to-dorado-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-plata-700 rounded-2xl mb-4 shadow-lg shadow-dorado-600/30">
            <Crown size={32} className="text-dorado-300" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CEO DENIS</h1>
          <p className="text-dorado-300/80 mt-1 text-sm">Centro de Operaciones Denis</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-4 border border-white/10 shadow-2xl">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-sm">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-dorado-500 focus:border-transparent transition-all"
              placeholder="tu@email.com"
            />
          </div>

          {mode === 'login' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-dorado-500 focus:border-transparent transition-all pr-10"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-dorado-600 hover:bg-dorado-500 disabled:opacity-50 text-plata-900 rounded-lg font-semibold transition-colors text-sm shadow-lg shadow-dorado-600/30 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mode === 'login' ? 'Iniciando...' : 'Enviando...'}
              </>
            ) : (
              mode === 'login' ? 'Iniciar Sesión' : 'Enviar link de recuperación'
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'forgot' : 'login');
                setError('');
                setSuccess('');
              }}
              className="text-dorado-400 hover:text-dorado-300 text-sm"
            >
              {mode === 'login'
                ? '¿Olvidaste tu contraseña?'
                : '← Volver a iniciar sesión'}
            </button>
          </div>
        </form>

        <p className="text-center text-gray-500 text-xs mt-4">
          Solo personal autorizado
        </p>
      </div>
    </div>
  );
}
