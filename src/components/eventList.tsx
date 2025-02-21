import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { Event, Priority, getPriorityText } from '../db/database';
import { format, parseISO, isToday, isTomorrow, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEventStore } from '../store/eventStore';
import { Pencil, Trash2 } from 'lucide-react';

interface EventListProps {
  onEditEvent?: (id: number) => void;
  showTitle?: boolean;
  title?: string;
  filterDate?: string;
  groupByDate?: boolean;
}

const EventList: React.FC<EventListProps> = ({
  onEditEvent,
  showTitle = true,
  title = "Eventos",
  filterDate,
  groupByDate = false
}) => {
  const { events, loading, error, markEventAsCompleted, fetchEvents, deleteEvent, cleanup } = useEventStore();
  const mounted = useRef(true);

  // Cleanup on unmount with proper resource cleanup
  useEffect(() => {
    return () => {
      mounted.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Initial events fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getPriorityClass = useCallback((priority: Priority): string => {
    switch (priority) {
      case Priority.LOW:
        return 'priority-low';
      case Priority.MEDIUM:
        return 'priority-medium';
      case Priority.HIGH:
        return 'priority-high';
      default:
        return '';
    }
  }, []);

  const handleCheckboxChange = useCallback(async (id: number, completed: boolean) => {
    try {
      await markEventAsCompleted(id, !completed);
    } catch (error) {
      console.error('Erro ao atualizar status do evento:', error);
    }
  }, [markEventAsCompleted]);

  const handleDeleteEvent = useCallback(async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este evento?')) {
      try {
        await deleteEvent(id);
      } catch (error) {
        console.error('Erro ao excluir evento:', error);
      }
    }
  }, [deleteEvent]);

  const handleEditEvent = useCallback((id: number) => {
    if (onEditEvent) {
      onEditEvent(id);
    } else {
      console.warn('Função onEditEvent não fornecida');
    }
  }, [onEditEvent]);

  const formatEventDate = useCallback((date: string, time: string) => {
    const eventDate = parseISO(`${date}T${time}`);
    if (isToday(eventDate)) {
      return `Hoje às ${format(eventDate, 'HH:mm')}`;
    } else if (isTomorrow(eventDate)) {
      return `Amanhã às ${format(eventDate, 'HH:mm')}`;
    }
    return format(eventDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  }, []);

  const processedEvents = useMemo(() => {
    let filteredEvents = [...events];

    if (filterDate) {
      filteredEvents = filteredEvents.filter(event => event.date === filterDate);
    }

    filteredEvents.sort((a, b) => {
      const dateA = `${a.date}T${a.time}`;
      const dateB = `${b.date}T${b.time}`;
      const timeCompare = dateA.localeCompare(dateB);
      if (timeCompare !== 0) return timeCompare;
      return b.priority - a.priority;
    });

    if (groupByDate) {
      const grouped = new Map<string, Event[]>();
      filteredEvents.forEach(event => {
        const key = event.date;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)?.push(event);
      });
      return grouped;
    }

    return filteredEvents;
  }, [events, filterDate, groupByDate]);

  if (loading) {
    return (
      <div className="event-list-loading">
        <div className="spinner"></div>
        <p>Carregando eventos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-list-error">
        <p>Erro ao carregar eventos: {error}</p>
        <button onClick={() => fetchEvents()}>Tentar novamente</button>
      </div>
    );
  }

  if ((!groupByDate && !events.length) || (groupByDate && processedEvents instanceof Map && !processedEvents.size)) {
    return (
      <div className="event-list-empty">
        <p>Nenhum evento encontrado.</p>
      </div>
    );
  }

  const renderEvent = (event: Event) => (
    <li 
      key={event.id}
      className={`event-item ${event.completed ? 'completed' : ''} 
                 ${getPriorityClass(event.priority)}
                 ${isBefore(parseISO(`${event.date}T${event.time}`), new Date()) ? 'past' : ''}`}
    >
      <div className="event-checkbox">
        <input
          type="checkbox"
          checked={event.completed}
          onChange={() => handleCheckboxChange(event.id, event.completed)}
          aria-label={`Marcar "${event.title}" como ${event.completed ? 'não concluído' : 'concluído'}`}
        />
      </div>
  
      <div className="event-content">
        <div className="event-header">
          <h3 className="event-title">{event.title}</h3>
          <span className={`event-priority ${getPriorityClass(event.priority)}`}>
            {getPriorityText(event.priority)}
          </span>
        </div>
  
        <div className="event-time">
          {formatEventDate(event.date, event.time)}
        </div>
  
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
  
        <div className="event-actions">
          <button
            className="action-button edit-button"
            onClick={() => handleEditEvent(event.id)}
            aria-label={`Editar evento "${event.title}"`}
          >
            <Pencil size={20} />
          </button>
          
          <button
            className="action-button delete-button"
            onClick={() => handleDeleteEvent(event.id)}
            aria-label={`Excluir evento "${event.title}"`}
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </li>
  );

  return (
    <div className="event-list">
      {showTitle && <h2>{title}</h2>}

      {groupByDate && processedEvents instanceof Map ? (
        Array.from(processedEvents.entries()).map(([date, dateEvents]) => (
          <div key={date} className="event-group">
            <h3 className="event-group-title">
              {format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h3>
            <ul>{dateEvents.map(renderEvent)}</ul>
          </div>
        ))
      ) : (
        <ul>{(processedEvents as Event[]).map(renderEvent)}</ul>
      )}
    </div>
  );
};

export default EventList;