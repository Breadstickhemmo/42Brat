import React from 'react';
import { Calendar, momentLocalizer, EventPropGetter } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Event } from '../types';

moment.locale('ru');
const localizer = momentLocalizer(moment);

interface EventCalendarViewProps {
    events: Event[];
    isLoading: boolean;
    error: string | null;
    onViewDetails: (event: Event) => void;
}

interface CalendarEvent {
    title: string;
    start: Date;
    end: Date;
    resource: Event;
}

const EventCalendarView: React.FC<EventCalendarViewProps> = ({
    events,
    isLoading,
    error,
    onViewDetails,
}) => {
    const calendarEvents: CalendarEvent[] = events.map((event) => {
        const startDate = new Date(event.start_datetime);
        const endDate = event.end_datetime ? new Date(event.end_datetime) : startDate;

        return {
            title: event.title,
            start: startDate,
            end: endDate,
            resource: event,
        };
    });

    const handleSelectEvent = (calendarEvent: CalendarEvent) => {
        onViewDetails(calendarEvent.resource);
    };

    const eventStyleGetter = (event: CalendarEvent): { className?: string; style?: React.CSSProperties } => {
        const style: React.CSSProperties = {
            backgroundColor: '#007bff',
            borderRadius: '5px',
            opacity: 0.8,
            color: 'white',
            border: '0px',
            display: 'block',
            fontSize: '0.85em',
            padding: '2px 5px'
        };
        return {
            style: style,
        };
    };


    if (isLoading) {
        return <div className="event-list-loading card">Загрузка календаря...</div>;
    }
    if (error) {
        return <div className="event-list-error card">Ошибка загрузки календаря: {error}</div>;
    }

    return (
        <div className="card event-calendar-card">
            <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                views={['month', 'week', 'day', 'agenda']}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                messages={{
                    next: "След.",
                    previous: "Пред.",
                    today: "Сегодня",
                    month: "Месяц",
                    week: "Неделя",
                    day: "День",
                    agenda: "Повестка дня",
                    date: "Дата",
                    time: "Время",
                    event: "Событие",
                    noEventsInRange: "Нет событий в этом диапазоне.",
                    showMore: total => `+ Показать еще (${total})`
                 }}
            />
        </div>
    );
};

export default EventCalendarView;