import React from 'react';
import { EventFilters, ParticipantRole, EventLocation, EventType } from '../types';

interface EventFilterProps {
    filters: EventFilters;
    onFilterChange: (newFilters: EventFilters) => void;
    onResetFilters: () => void;
}

const EventFilter: React.FC<EventFilterProps> = ({ filters, onFilterChange, onResetFilters }) => {

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        onFilterChange({ ...filters, [name]: value });
    };

    return (
        <div className="card filter-card">
            <h4>Фильтры</h4>
            <div className="filter-grid">
                <div className="form-group">
                    <label htmlFor="startDate">Дата начала</label>
                    <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={filters.startDate || ''}
                        onChange={handleInputChange}
                        className="form-control"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="endDate">Дата окончания</label>
                    <input
                        type="date"
                        id="endDate"
                        name="endDate"
                        value={filters.endDate || ''}
                        onChange={handleInputChange}
                         min={filters.startDate || ''}
                        className="form-control"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="role">Роль</label>
                    <select
                        id="role"
                        name="role"
                        value={filters.role || ''}
                        onChange={handleInputChange}
                        className="form-control"
                    >
                        <option value="">Любая</option>
                        {Object.values(ParticipantRole).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                </div>
                 <div className="form-group">
                    <label htmlFor="location">Место</label>
                    <select
                        id="location"
                        name="location"
                        value={filters.location || ''}
                        onChange={handleInputChange}
                        className="form-control"
                    >
                        <option value="">Любое</option>
                         {Object.values(EventLocation).map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>
                 <div className="form-group">
                    <label htmlFor="type">Направление</label>
                    <select
                        id="type"
                        name="type"
                        value={filters.type || ''}
                        onChange={handleInputChange}
                        className="form-control"
                    >
                        <option value="">Любое</option>
                         {Object.values(EventType).map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                 <div className="form-group filter-reset-button">
                     <button onClick={onResetFilters} className="secondary-btn small-btn">Сбросить</button>
                </div>
            </div>
        </div>
    );
};

export default EventFilter;