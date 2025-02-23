import { create } from 'zustand';
import { db, type Event, type CreateEvent, type UpdateEvent } from '../db/database';
import { isBefore, parseISO } from 'date-fns';

// Interface para o cache
interface CacheEntry {
  timestamp: number;
  events: Event[];
}

interface EventCache {
  [key: string]: CacheEntry;
}

// Interface para o store
interface EventStore {
  isDBReady: boolean;
  events: Event[];
  loading: boolean;
  error: string | null;
  selectedDate: string | null;
  
  initializeStore: () => Promise<void>;
  fetchEvents: () => Promise<void>;
  fetchEventsByDate: (date: string) => Promise<void>;
  addEvent: (event: CreateEvent) => Promise<void>;
  updateEvent: (id: number, updates: UpdateEvent) => Promise<void>;
  deleteEvent: (id: number) => Promise<void>;
  setSelectedDate: (date: string | null) => void;
  markEventAsCompleted: (id: number, completed: boolean) => Promise<void>;
  clearError: () => void;
  clearCache: () => void;
  cleanup: () => void;
}

// Store de eventos(com utilização de cache)
export const useEventStore = create<EventStore>((set, get) => {
  const cache: EventCache = {};
  const CACHE_DURATION = 5000; // 5 segundos
  let scheduledChecks: Map<number, ReturnType<typeof setTimeout>> = new Map();

  // Função para verificar se o cache é válido
  const isCacheValid = (key: string): boolean => {
    const entry = cache[key];
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_DURATION;
  };

  // Função para atualizar o cache
  const updateCache = (key: string, events: Event[]) => {
    cache[key] = {
      timestamp: Date.now(),
      events
    };
  };

  // Função para invalidar o cache após mutações
  const invalidateCache = () => {
    Object.keys(cache).forEach(key => delete cache[key]);
  };

  // Função otimizada para verificar eventos passados
  const checkAndUpdatePastEvents = async (events: Event[]): Promise<Event[]> => {
    const now = new Date();
    const eventsToUpdate: number[] = [];
    
    // Identifica eventos passados e atualiza a flag completed(autocomplete)
    const updatedEvents = events.map(event => {
      if (!event.completed) {
        const eventDateTime = parseISO(`${event.date}T${event.time}`);
        if (isBefore(eventDateTime, now)) {
          eventsToUpdate.push(event.id);
          return { ...event, completed: true };
        }
      }
      return event;
    });

    // Atualiza a situação dos eventos passados no banco de dados
    if (eventsToUpdate.length > 0) {
      await Promise.all(eventsToUpdate.map(id => 
        db.markEventAsCompleted(id, true)
      ));
    }

    return updatedEvents;
  };

  // Função para agendar verificação futura de um evento
  const scheduleEventCheck = (event: Event) => {
    if (event.completed) return;

    const eventDateTime = parseISO(`${event.date}T${event.time}`);
    const now = new Date();
    
    // Se já passou, não agenda
    if (isBefore(eventDateTime, now)) return;

    // Remove agendamento anterior se existir
    if (scheduledChecks.has(event.id)) {
      clearTimeout(scheduledChecks.get(event.id));
      scheduledChecks.delete(event.id);
    }

    // Agenda nova verificação
    const timeout = setTimeout(async () => {
      await db.markEventAsCompleted(event.id, true);
      await refreshEvents();
      scheduledChecks.delete(event.id);
    }, eventDateTime.getTime() - now.getTime());

    scheduledChecks.set(event.id, timeout);
  };

  // Função para atualizar(recarregar) eventos
  const refreshEvents = async () => {
    if (!get().isDBReady) {
      console.warn('Tentativa de refresh antes da inicialização do DB');
      return;
    }

    // Verifica se o cache é válido e atualiza a store
    const { selectedDate } = get();
    const cacheKey = selectedDate || 'all';

    if (isCacheValid(cacheKey)) {
      const cachedEvents = await checkAndUpdatePastEvents(cache[cacheKey].events);
      set({ events: cachedEvents, loading: false });
      return;
    }

    try {
      let events = selectedDate 
        ? await db.getEventsByDate(selectedDate)
        : await db.getAllEvents();
      
      events = await checkAndUpdatePastEvents(events);
      
      // Agenda verificações futuras para novos eventos
      events.forEach(scheduleEventCheck);
      
      // Atualiza o cache e a store
      updateCache(cacheKey, events);
      set({ events, loading: false });
    } catch (error) {
      console.error("Erro ao atualizar eventos:", error);
      set({ error: (error as Error).message, loading: false });
    }
  };

  // Limpa todos os timeouts ao desmontar
  const cleanup = () => {
    scheduledChecks.forEach(timeout => clearTimeout(timeout));
    scheduledChecks.clear();
  };

  return {
    isDBReady: false,
    events: [],
    loading: false,
    error: null,
    selectedDate: null,

    cleanup,
    clearError: () => set({ error: null }),
    clearCache: () => invalidateCache(),

    // Initializa a store e o banco de dados
    initializeStore: async () => {
      try {
        set({ loading: true });
        await db.initDB();
        set({ isDBReady: true, loading: false });
        await refreshEvents();
      } catch (error) {
        set({ 
          error: (error as Error).message, 
          loading: false 
        });
        console.error('Erro na inicialização:', error);
      }
    },

    // Função para selecionar uma data específica
    setSelectedDate: (date: string | null) => {
      set({ selectedDate: date, loading: true });
      refreshEvents();
    },

    // Função para buscar todos os eventos
    fetchEvents: async () => {
      if (!get().isDBReady) {
        console.warn('Tentativa de fetch antes da inicialização do DB');
        return;
      }
      
      try {
        set({ loading: true, error: null });
        await refreshEvents();
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
      }
    },

    // Função para buscar eventos por data
    fetchEventsByDate: async (date: string) => {
      if (!get().isDBReady) {
        console.warn('Tentativa de fetch por data antes da inicialização do DB');
        return;
      }

      try {
        set({ loading: true, error: null, selectedDate: date });
        await refreshEvents();
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
      }
    },

    // Função para adicionar um evento
    addEvent: async (event: CreateEvent) => {
      if (!get().isDBReady) {
        throw new Error('DB não está inicializado');
      }
    
      try {
        set({ loading: true, error: null });
        await db.addEvent(event);
        invalidateCache();
        await refreshEvents(); // O refreshEvents já agenda as verificações necessárias
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
      }
    },

    // Função para atualizar um evento
    updateEvent: async (id: number, updates: UpdateEvent) => {
      if (!get().isDBReady) {
        throw new Error('DB não está inicializado');
      }

      try {
        set({ loading: true, error: null });
        await db.updateEvent(id, updates);
        
        // Limpa o agendamento anterior se existir
        if (scheduledChecks.has(id)) {
          clearTimeout(scheduledChecks.get(id));
          scheduledChecks.delete(id);
        }
        
        invalidateCache();
        await refreshEvents();
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
      }
    },

    // Função para deletar um evento
    deleteEvent: async (id: number) => {
      if (!get().isDBReady) {
        throw new Error('DB não está inicializado');
      }

      try {
        set({ loading: true, error: null });
        
        // Limpa o agendamento se existir
        if (scheduledChecks.has(id)) {
          clearTimeout(scheduledChecks.get(id));
          scheduledChecks.delete(id);
        }
        
        await db.deleteEvent(id);
        invalidateCache();
        await refreshEvents();
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
      }
    },

    // Função para marcar um evento como completo
    markEventAsCompleted: async (id: number, completed: boolean) => {
      if (!get().isDBReady) {
        throw new Error('DB não está inicializado');
      }

      try {
        set({ loading: true, error: null });
        
        // Se marcar como completo, remove o agendamento
        if (completed && scheduledChecks.has(id)) {
          clearTimeout(scheduledChecks.get(id));
          scheduledChecks.delete(id);
        }
        
        await db.markEventAsCompleted(id, completed);
        invalidateCache();
        await refreshEvents();
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
      }
    },
  };
});