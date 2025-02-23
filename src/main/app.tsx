import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useEventStore } from '../store/eventStore';
import EventCalendar from '../components/calendar';
import EventList from '../components/eventList';
import EventForm from '../components/eventForm';
import ThemeToggle from '../components/themeToggle';

// Componentes de página
const Home = ({ isDarkMode, toggleTheme }: { isDarkMode: boolean; toggleTheme: () => void }) => {
  const navigate = useNavigate();
  
  const handleEditEvent = (id: number) => {
    console.log(`Navegando para editar evento ${id}`);
    navigate(`/editar/${id}`);
  };
  
  return (
    <div className="home-container">
      <header className="app-header">
        <h1>Minha Agenda</h1>
        <div className="header-actions">
          <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
          <Link to="/novo" className="new-event-button">Novo Evento</Link>
        </div>
      </header>
      
      <main>
        <section className="calendar-section">
          <EventCalendar />
        </section>
        
        <section className="events-section">
          <EventList onEditEvent={handleEditEvent} />
        </section>
      </main>
    </div>
  );
};

// Páginas de criação e edição de eventos
const NewEventPage = () => {
  const navigate = useNavigate();
  
  // Funções de callback para sucesso e cancelamento
  const handleSuccess = () => {
    console.log("Evento criado com sucesso, redirecionando");
    navigate('/', { replace: true });
  };
  
  const handleCancel = () => {
    console.log("Criação cancelada, voltando");
    navigate('/', { replace: true });
  };
  
  return (
    <div className="new-event-page">
      <header>
        <h1>Novo Evento</h1>
        <button className="back-button" onClick={handleCancel}>Voltar</button>
      </header>
      
      <EventForm
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

// Página de edição de eventos
const EditEventPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || '0');
  
  // Funções de callback para sucesso e cancelamento
  const handleSuccess = () => {
    console.log("Evento atualizado com sucesso, redirecionando");
    navigate('/', { replace: true });
  };
  
  const handleCancel = () => {
    console.log("Edição cancelada, voltando");
    navigate('/', { replace: true });
  };
  
  useEffect(() => {
    if (!id || isNaN(eventId) || eventId <= 0) {
      console.log("ID inválido, redirecionando");
      navigate('/', { replace: true });
    }
  }, [id, eventId, navigate]);
  
  if (!id || isNaN(eventId) || eventId <= 0) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <div className="edit-event-page">
      <header>
        <h1>Editar Evento</h1>
        <button className="back-button" onClick={handleCancel}>Voltar</button>
      </header>
      
      <EventForm
        eventId={eventId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

// Componente principal
const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const { initializeStore } = useEventStore();

  // Efeito para carregar preferência de tema do localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && 
                       window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Definir tema baseado na preferência salva ou nas preferências do sistema
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, []);

  // Função para alternar o tema
  const toggleTheme = () => {
    setIsDarkMode(prevMode => {
      const newMode = !prevMode;
      
      // Salvar preferência no localStorage
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      
      // Aplicar ou remover classe do body para estilização
      if (newMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      
      return newMode;
    });
  };

  // Efeito para inicializar a store de eventos
  useEffect(() => {
    console.log("4. App.tsx - useEffect iniciado");
    
    const init = async () => {
      try {
        console.log("5. App.tsx - Iniciando store");
        await initializeStore();
        console.log("6. App.tsx - Store inicializado com sucesso");
      } catch (err) {
        console.error("7. App.tsx - Erro na inicialização:", err);
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [initializeStore]);

  if (isLoading) {
    return <div className="loading-screen">Carregando...</div>;
  }

  if (error) {
    return (
      <div className="error-screen">
        <h1>Erro ao inicializar aplicação</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home isDarkMode={isDarkMode} toggleTheme={toggleTheme} />} />
        <Route path="/novo" element={<NewEventPage />} />
        <Route path="/editar/:id" element={<EditEventPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;