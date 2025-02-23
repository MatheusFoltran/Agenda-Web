// Definição de prioridades
enum Priority {
  LOW = 1,      // Pouco importante
  MEDIUM = 2,   // Razoavelmente importante
  HIGH = 3      // Muito importante
}

// Definição de eventos(criação)
interface CreateEvent {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: Priority;
}

// Definição de eventos(pós criação)
interface Event extends CreateEvent {
  id: number;
  completed: boolean;
  created_at: string;
  updated_at: string | null;
}

// Definição de eventos(atualização)
interface UpdateEvent {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  priority?: Priority;
}

// Erro de prioridade inválida
class InvalidPriorityError extends Error {
  constructor(value: number) {
    super(`Prioridade inválida: ${value}. Use 1 (pouco importante), 2 (razoavelmente importante) ou 3 (muito importante)`);
    this.name = 'InvalidPriorityError';
  }
}

// Classe de banco de dados de eventos
class EventDatabase {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'EventsDB';
  private readonly STORE_NAME = 'events';
  private readonly VERSION = 1;

  // Inicialização do banco de dados
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.VERSION);

      // Tratamento de erros na inicialização
      request.onerror = () => reject(request.error);
      // Inicialização do banco de dados
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      // Configuração do banco de dados
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const store = db.createObjectStore(this.STORE_NAME, { 
          keyPath: 'id', 
          autoIncrement: true 
        });

        // Criar índices para consultas
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('priority', 'priority', { unique: false });
      };
    });
  }

  // Validação de prioridade
  private validatePriority(priority: number): void {
    if (![1, 2, 3].includes(priority)) {
      throw new InvalidPriorityError(priority);
    }
  }

  // Obter todos os eventos
  async getAllEvents(): Promise<Event[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      // Ordenação dos eventos por data e hora + tratamento de erros
      request.onsuccess = () => {
        const events = request.result.sort((a, b) => {
          return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        });
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Obter eventos por data
  async getEventsByDate(date: string): Promise<Event[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('date');
      const request = index.getAll(date);

      // Ordenação dos eventos por data e hora + tratamento de erros
      request.onsuccess = () => {
        const events = request.result.sort((a, b) => a.time.localeCompare(b.time));
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Adicionar evento
  async addEvent(event: CreateEvent): Promise<number> {
    // Validação de prioridade
    this.validatePriority(event.priority);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const newEvent = {
        ...event,
        completed: false,
        created_at: new Date().toISOString(),
        updated_at: null
      };

      const request = store.add(newEvent);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  // Atualizar evento
  async updateEvent(id: number, updates: UpdateEvent): Promise<void> {
    // Validação de prioridade
    if (updates.priority !== undefined) {
      this.validatePriority(updates.priority);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      // Obter evento a ser atualizado
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const event = getRequest.result;
        if (!event) {
          reject(new Error('Evento não encontrado'));
          return;
        }

        // Obtem informações do evento
        const needsUpdate = Object.entries(updates).some(
          ([key, value]) => value !== undefined && event[key] !== value
        );

        // Atualizar informações do evento + data de modificação
        if (needsUpdate) {
          const updatedEvent = {
            ...event,
            ...updates,
            updated_at: new Date().toISOString()
          };

          const updateRequest = store.put(updatedEvent);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      // Tratamento de erros
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Deletar evento
  async deleteEvent(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Obter eventos por intervalo de datas
  async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => 
      event.date >= startDate && event.date <= endDate
    );
  }

  // Marcar evento como completo
  async markEventAsCompleted(id: number, completed: boolean = true): Promise<void> {
    return this.updateEvent(id, { completed } as any);
  }

  // Obter eventos por prioridade
  async getEventsByPriority(priority: Priority): Promise<Event[]> {
    this.validatePriority(priority);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('priority');
      const request = index.getAll(priority);

      // Ordenação dos eventos por data e hora + tratamento de erros
      request.onsuccess = () => {
        const events = request.result.sort((a, b) => {
          return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        });
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Obter texto de prioridade
function getPriorityText(priority: Priority): string {
  switch (priority) {
    case Priority.LOW:
      return "Pouco importante";
    case Priority.MEDIUM:
      return "Razoavelmente importante";
    case Priority.HIGH:
      return "Muito importante";
    default:
      throw new InvalidPriorityError(priority);
  }
}

// Instância do banco de dados
const db = new EventDatabase();

export {
  db,
  Priority,
  getPriorityText,
  type Event,
  type CreateEvent,
  type UpdateEvent
};