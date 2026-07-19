import { useState } from 'react';
import { updatePassword } from '../lib/auth';
import { useAuth } from '../lib/AuthContext';
import { Crown, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const { clearPasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      console.error('[ResetPassword] Error:', err);
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    // La sesión de recuperación ya quedó activa con la nueva contraseña:
    // cerramos sesión para forzar un login limpio con las credenciales nuevas.
    await signOut();
    clearPasswordRecovery();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-plata-900 via-plata-800 to-dorado-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-plata-700 rounded-2xl mb-4 shadow-lg shadow-dorado-600/30">
            <Crown size={32} className="text-dorado-300" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CEO DENIS</h1>
          <p className="text-dorado-300/80 mt-1 text-sm">Nueva contraseña</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-4 border border-white/10 shadow-2xl">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-sm">
                <CheckCircle2 size={16} />
                Contraseña actualizada
              </div>
              <button
                onClick={handleContinue}
                className="w-full py-3 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg font-semibold transition-colors text-sm shadow-lg shadow-dorado-600/30"
              >
                Ir a iniciar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña nueva</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirmar contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-dorado-500 focus:border-transparent transition-all"
                  placeholder="Repetí la contraseña"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-dorado-600 hover:bg-dorado-500 disabled:opacity-50 text-plata-900 rounded-lg font-semibold transition-colors text-sm shadow-lg shadow-dorado-600/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar contraseña'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
