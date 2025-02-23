import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useEventStore } from '../store/eventStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EventCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { 
    events, 
    loading, 
    fetchEvents, 
    fetchEventsByDate, 
    setSelectedDate: storeSetSelectedDate 
  } = useEventStore();

  // Controle de montagem do componente
  const mounted = useRef(true);


  useEffect(() => {
    mounted.current = true; // Definir como true na montagem
    return () => {
      mounted.current = false;
    };
  }, []);

  // Inicialização do calendário com proteção contra memory leaks
  useEffect(() => {
    const initializeCalendar = async () => {
      try {
        if (mounted.current) {
          await fetchEvents();
        }
      } catch (error) {
        if (mounted.current) {
          console.error('Erro ao carregar eventos:', error);
        }
      }
    };
    
    initializeCalendar();
  }, [fetchEvents]);

  // Atualização de eventos com debounce e proteção
  useEffect(() => {
    if (!selectedDate) return;

    const timeoutId = setTimeout(async () => {
      try {
        if (mounted.current) {
          await fetchEventsByDate(selectedDate);
        }
      } catch (error) {
        if (mounted.current) {
          console.error('Erro ao atualizar eventos:', error);
        }
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [selectedDate, fetchEventsByDate]);

  // Memoização do mapa de eventos por data
  const eventsByDate = useMemo(() => {
    const map = new Map<string, boolean>();
    events.forEach(event => {
      const eventDate = typeof event.date === 'string' 
        ? event.date 
        : format(new Date(event.date), 'yyyy-MM-dd');
      map.set(eventDate, true);
    });
    return map;
  }, [events]);

  // Geração dos dias do calendário memoizada
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: JSX.Element[] = [];
    
    // Células vazias
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = format(date, 'yyyy-MM-dd');
      const isSelected = selectedDate === dateString;
      const hasEvents = eventsByDate.has(dateString);
      
      days.push(
        <div
          key={dateString}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${hasEvents ? 'has-events' : ''}`}
          onClick={() => handleDateClick(dateString)}
        >
          <div className="day-number">{day}</div>
          {hasEvents && <div className="event-indicator"></div>}
        </div>
      );
    }
    
    return days;
  }, [currentDate, selectedDate, eventsByDate]);

  // Tratamento de clique em uma data
  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(prev => {
      const newDate = prev === date ? null : date;
      storeSetSelectedDate(newDate);
      return newDate;
    });
  }, [storeSetSelectedDate]);

  // Tratamento de mudança de mês
  const handleMonthChange = useCallback((increment: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + increment);
      return newDate;
    });
    setSelectedDate(null);
    storeSetSelectedDate(null);
  }, [storeSetSelectedDate]);

  if (!mounted.current) return null;

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={() => handleMonthChange(-1)}>&lt;</button>
        <h2>
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <button onClick={() => handleMonthChange(1)}>&gt;</button>
      </div>
      
      <div className="weekdays">
        <div>Dom</div>
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sáb</div>
      </div>
      
      <div className="calendar-grid">
        {calendarDays}
      </div>
      
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default EventCalendar;