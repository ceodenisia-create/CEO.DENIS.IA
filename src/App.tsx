import { useState } from 'react';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout, { type Page } from './components/Layout';
import Agenda from './pages/Agenda';
import Objetivos from './pages/Objetivos';
import Metas from './pages/Metas';
import Proyectos from './pages/Proyectos';
import AiAssistant from './pages/AiAssistant';
import MapaDeFuturo from './pages/MapaDeFuturo';
import Disciplina from './pages/Disciplina';
import RadarPage from './pages/Radar';
import Bitacora from './pages/Bitacora';
import MemoriaIA from './pages/MemoriaIA';
import UserManagement from './pages/UserManagement';
import Login from './pages/Login';
import { Crown } from 'lucide-react';

function AppContent() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('agenda');
  const [cierreSignal, setCierreSignal] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-plata-900 via-plata-800 to-bordo-900 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-bordo-600 shadow-pm-lg">
          <Crown size={32} className="text-dorado-300" />
        </div>
        <div className="w-8 h-8 border-4 border-dorado-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-plata-400 text-sm">Cargando CEO DENIS...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  const cerrarDia = () => { setCierreSignal(s => s + 1); setCurrentPage('bitacora'); };

  const renderPage = () => {
    switch (currentPage) {
      // Agenda unifica Hoy + Kanban + nuevas vistas
      case 'agenda':    return <Agenda onCerrarDia={cerrarDia} defaultTab="hoy" />;
      // Rutas legacy — redirigen a Agenda con su tab correspondiente
      case 'hoy':       return <Agenda onCerrarDia={cerrarDia} defaultTab="hoy" />;
      case 'kanban':    return <Agenda onCerrarDia={cerrarDia} defaultTab="kanban" />;
      // Resto de páginas sin cambios
      case 'objetivos': return <Objetivos />;
      case 'metas':     return <Metas />;
      case 'proyectos': return <Proyectos />;
      case 'mapa-futuro':  return <MapaDeFuturo />;
      case 'disciplina':   return <Disciplina />;
      case 'radar':        return <RadarPage />;
      case 'bitacora':     return <Bitacora openCierreSignal={cierreSignal} />;
      case 'ai-assistant': return <AiAssistant />;
      case 'memoria-ia':   return <MemoriaIA />;
      case 'users':        return isAdmin ? <UserManagement /> : <Agenda onCerrarDia={cerrarDia} />;
      default:             return <Agenda onCerrarDia={cerrarDia} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      isAdmin={isAdmin}
      onLogout={signOut}
    >
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
