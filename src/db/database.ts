// src/db/database.ts

enum Priority {
  LOW = 1,      // Pouco importante
  MEDIUM = 2,   // Razoavelmente importante
  HIGH = 3      // Muito importante
}

interface CreateEvent {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: Priority;
}

interface Event extends CreateEvent {
  id: number;
  completed: boolean;
  created_at: string;
  updated_at: string | null;
}

interface UpdateEvent {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  priority?: Priority;
}

class InvalidPriorityError extends Error {
  constructor(value: number) {
    super(`Prioridade inválida: ${value}. Use 1 (pouco importante), 2 (razoavelmente importante) ou 3 (muito importante)`);
    this.name = 'InvalidPriorityError';
  }
}

class EventDatabase {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'EventsDB';
  private readonly STORE_NAME = 'events';
  private readonly VERSION = 1;

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

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

  private validatePriority(priority: number): void {
    if (![1, 2, 3].includes(priority)) {
      throw new InvalidPriorityError(priority);
    }
  }

  async getAllEvents(): Promise<Event[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const events = request.result.sort((a, b) => {
          return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        });
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getEventsByDate(date: string): Promise<Event[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('date');
      const request = index.getAll(date);

      request.onsuccess = () => {
        const events = request.result.sort((a, b) => a.time.localeCompare(b.time));
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addEvent(event: CreateEvent): Promise<number> {
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

  async updateEvent(id: number, updates: UpdateEvent): Promise<void> {
    if (updates.priority !== undefined) {
      this.validatePriority(updates.priority);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const event = getRequest.result;
        if (!event) {
          reject(new Error('Evento não encontrado'));
          return;
        }

        const needsUpdate = Object.entries(updates).some(
          ([key, value]) => value !== undefined && event[key] !== value
        );

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

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteEvent(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => 
      event.date >= startDate && event.date <= endDate
    );
  }

  async markEventAsCompleted(id: number, completed: boolean = true): Promise<void> {
    return this.updateEvent(id, { completed } as any);
  }

  async getEventsByPriority(priority: Priority): Promise<Event[]> {
    this.validatePriority(priority);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('priority');
      const request = index.getAll(priority);

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

const db = new EventDatabase();

export {
  db,
  Priority,
  getPriorityText,
  type Event,
  type CreateEvent,
  type UpdateEvent
};