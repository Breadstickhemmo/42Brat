import React from 'react';

interface ControlBarProps {
    searchTerm: string;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onFilterClick: () => void;
    onAddClick: () => void;
    isAdmin: boolean;
    isFiltered: boolean;
}

const FilterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="18" height="18">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.572a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
);

const AddIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="18" height="18">
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
</svg>
);


const ControlBar: React.FC<ControlBarProps> = ({
    searchTerm,
    onSearchChange,
    onFilterClick,
    onAddClick,
    isAdmin,
    isFiltered
}) => {
    return (
        <div className="control-bar card"> {/* Use card styling */}
            <div className="search-input-wrapper">
                <input
                    type="search" // Use type="search" for better semantics/potential browser UI
                    placeholder="Поиск по названию или описанию..."
                    value={searchTerm}
                    onChange={onSearchChange}
                    className="form-control search-input" // Reuse form-control styles
                />
                 {/* Basic clear button - can enhance later */}
                 {searchTerm && (
                     <button
                         onClick={() => onSearchChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
                         className="clear-search-btn"
                         aria-label="Очистить поиск"
                     >
                         ×
                     </button>
                 )}
            </div>
            <div className="control-buttons">
                <button onClick={onFilterClick} className={`secondary-btn filter-btn ${isFiltered ? 'filter-active' : ''}`}>
                    <FilterIcon />
                    Фильтры {isFiltered && <span className="filter-indicator" title="Фильтры применены">•</span>}
                </button>
                {isAdmin && (
                    <button onClick={onAddClick} className="primary-btn add-btn">
                         <AddIcon />
                        Добавить
                    </button>
                )}
            </div>
        </div>
    );
};

export default ControlBar;