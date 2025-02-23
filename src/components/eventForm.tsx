import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEventStore } from '../store/eventStore';
import { 
  CreateEvent, 
  UpdateEvent, 
  Priority, 
  getPriorityText
} from '../db/database';

// Definição das propriedades e estado do componente
interface EventFormProps {
  eventId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface EventFormState {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: Priority;
}

interface EventFormErrors {
  title?: string;
  date?: string;
  time?: string;
}

const initialFormState: EventFormState = {
  title: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  time: '12:00',
  priority: Priority.MEDIUM
};

// Componente de formulário de eventos
const EventForm: React.FC<EventFormProps> = ({ 
  eventId, 
  onSuccess, 
  onCancel 
}) => {
  const [formState, setFormState] = useState<EventFormState>(initialFormState);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    events, 
    error: storeError, 
    addEvent, 
    updateEvent, 
    fetchEvents
  } = useEventStore();

  // Memoize o evento atual para evitar re-renders desnecessários
  const currentEvent = useMemo(() => {
    return eventId ? events.find(e => e.id === eventId) : null;
  }, [eventId, events]);
  
  // Carrega o evento para edição
  useEffect(() => {
    const loadEvent = async () => {
      if (eventId && !currentEvent && events.length === 0) {
        await fetchEvents();
      }
    };
    
    loadEvent();
  }, [eventId, currentEvent, events.length, fetchEvents]);
  
  // Atualiza o formulário quando o evento atual muda
  useEffect(() => {
    if (currentEvent) {
      setFormState({
        title: currentEvent.title,
        description: currentEvent.description,
        date: currentEvent.date,
        time: currentEvent.time,
        priority: currentEvent.priority
      });
    }
  }, [currentEvent]);
  
  const validateForm = useCallback((): boolean => {
    const newErrors: EventFormErrors = {};
    
    if (!formState.title.trim()) {
      newErrors.title = 'O título é obrigatório';
    }
    
    if (!formState.date) {
      newErrors.date = 'A data é obrigatória';
    }
    
    if (!formState.time) {
      newErrors.time = 'O horário é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState]);
  
  // Trata a mudança de valores nos campos do formulário
  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    setFormState(prev => ({
      ...prev,
      [name]: name === 'priority' ? parseInt(value) as Priority : value
    }));
    
    setErrors(prev => ({
      ...prev,
      [name]: undefined
    }));
  }, []);
  
  // Trata o envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (eventId) {
        await updateEvent(eventId, formState as UpdateEvent);
      } else {
        await addEvent(formState as CreateEvent);
        setFormState(initialFormState);
      }
      
      onSuccess?.();
    } catch (err) {
      console.error('Erro ao salvar evento:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoize as opções de prioridade
  const priorityOptions = useMemo(() => [
    { value: Priority.LOW, label: getPriorityText(Priority.LOW) },
    { value: Priority.MEDIUM, label: getPriorityText(Priority.MEDIUM) },
    { value: Priority.HIGH, label: getPriorityText(Priority.HIGH) }
  ], []);
  
  return (
    <div className="event-form-container">
      <form onSubmit={handleSubmit} className="event-form">
        <div className="form-group">
          <label htmlFor="title">Título*</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formState.title}
            onChange={handleChange}
            className={errors.title ? 'error' : ''}
            disabled={isSubmitting}
          />
          {errors.title && <div className="error-message">{errors.title}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            name="description"
            value={formState.description}
            onChange={handleChange}
            rows={4}
            disabled={isSubmitting}
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">Data*</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formState.date}
              onChange={handleChange}
              className={errors.date ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.date && <div className="error-message">{errors.date}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="time">Hora*</label>
            <input
              type="time"
              id="time"
              name="time"
              value={formState.time}
              onChange={handleChange}
              className={errors.time ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.time && <div className="error-message">{errors.time}</div>}
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="priority">Prioridade</label>
          <select
            id="priority"
            name="priority"
            value={formState.priority}
            onChange={handleChange}
            disabled={isSubmitting}
          >
            {priorityOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        {storeError && <div className="form-error">{storeError}</div>}
        
        <div className="form-actions">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              disabled={isSubmitting}
              className="cancel-button"
            >
              Cancelar
            </button>
          )}
          
          <button 
            type="submit"
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting 
              ? (eventId ? 'Atualizando...' : 'Salvando...') 
              : (eventId ? 'Atualizar' : 'Salvar')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventForm;