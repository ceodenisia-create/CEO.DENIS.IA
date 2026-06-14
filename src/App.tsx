import { useState } from 'react';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout, { type Page } from './components/Layout';
import Hoy from './pages/Hoy';
import Kanban from './pages/Kanban';
import Objetivos from './pages/Objetivos';
import Metas from './pages/Metas';
import Proyectos from './pages/Proyectos';
import AiAssistant from './pages/AiAssistant';
import MapaDeFuturo from './pages/MapaDeFuturo';
import Disciplina from './pages/Disciplina';
import RadarPage from './pages/Radar';
import Bitacora from './pages/Bitacora';
import UserManagement from './pages/UserManagement';
import Login from './pages/Login';
import { Crown } from 'lucide-react';

function AppContent() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('hoy');
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

  const renderPage = () => {
    switch (currentPage) {
      case 'hoy':          return <Hoy onCerrarDia={() => { setCierreSignal(s => s + 1); setCurrentPage('bitacora'); }} />;
      case 'kanban':       return <Kanban />;
      case 'objetivos':    return <Objetivos />;
      case 'metas':        return <Metas />;
      case 'proyectos':    return <Proyectos />;
      case 'mapa-futuro':  return <MapaDeFuturo />;
      case 'disciplina':   return <Disciplina />;
      case 'radar':        return <RadarPage />;
      case 'bitacora':     return <Bitacora openCierreSignal={cierreSignal} />;
      case 'ai-assistant': return <AiAssistant />;
      case 'users':        return isAdmin ? <UserManagement /> : <Hoy />;
      default:             return <Hoy />;
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
