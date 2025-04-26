import React, { useEffect, useState, useCallback } from 'react';
import 'react-toastify/dist/ReactToastify.css';

import './styles/global.css';
import './styles/common.css';
import './styles/Header.css';
import './styles/Modal.css';
import './styles/EventFilter.css';
import './styles/EventList.css';
import './styles/EventDetailModal.css';
import './styles/EventFormModal.css';
import './styles/AdminControls.css';

import Header from './components/Header';
import AuthModal from './components/AuthModal';
import EventFilter from './components/EventFilter';
import EventList from './components/EventList';
import EventDetailModal from './components/EventDetailModal';
import EventFormModal from './components/EventFormModal';
import { ToastContainer, toast } from 'react-toastify';
import { fetchWithAuth as fetchWithAuthHelper } from './utils/fetchWithAuth';
import { User, Event, EventFilters, EventFormData } from './types';

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState<boolean>(true);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const [events, setEvents] = useState<Event[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
    const [eventError, setEventError] = useState<string | null>(null);
    const [filters, setFilters] = useState<EventFilters>({});
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setCurrentUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        setEvents([]);
        setFilters({});
        toast.info("Вы вышли из системы.");
    }, []);

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        try {
            return await fetchWithAuthHelper(url, options, handleLogout);
        } catch (error) {
            if (error instanceof Error && error.message.includes('401')) {

            } else if (error instanceof Error) {
                 toast.error(`Сетевая ошибка: ${error.message}`);
            } else {
                 toast.error("Неизвестная сетевая ошибка.");
            }
            throw error;
        }
    }, [handleLogout]);

    useEffect(() => {
        const tokenFromStorage = localStorage.getItem('authToken');
        if (tokenFromStorage) {
            setAuthToken(tokenFromStorage);
        } else {
            setAuthLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authToken) {
            setAuthLoading(true);
            fetchWithAuth('/api/me')
                .then(async response => {
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        if (response.status !== 401) {
                             throw new Error(errorData.error || `Ошибка проверки пользователя: ${response.status}`);
                        }
                        return null;
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && data.user) {
                        setCurrentUser(data.user);
                        setIsAuthenticated(true);
                        setAuthError(null);
                    } else if (!localStorage.getItem('authToken')) {
                        setIsAuthenticated(false);
                        setCurrentUser(null);
                    }
                })
                .catch((err) => {
                     if (!(err instanceof Error && err.message.includes('401 Unauthorized'))) {
                        console.error("Error fetching /api/me:", err);
                     }
                })
                .finally(() => {
                    setAuthLoading(false);
                });
        } else {
             setIsAuthenticated(false);
             setCurrentUser(null);
             setAuthLoading(false);
             setEvents([]);
        }
    }, [authToken, fetchWithAuth]);


    const fetchEvents = useCallback(async (currentFilters: EventFilters) => {
        if (!isAuthenticated) {
            console.log("fetchEvents called while not authenticated. Skipping.");
            setEvents([]);
            return;
        };

        setIsLoadingEvents(true);
        setEventError(null);

        const queryParams = new URLSearchParams();
        Object.entries(currentFilters).forEach(([key, value]) => {
            if (value) {
                queryParams.append(key, value);
            }
        });
        const queryString = queryParams.toString();
        const url = `/api/events${queryString ? `?${queryString}` : ''}`;

        console.log(`Fetching events with URL: ${url}`);

        try {
            const response = await fetchWithAuth(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Не удалось загрузить мероприятия');
            }
            const data: Event[] = await response.json();
            setEvents(data);
            console.log(`Fetched ${data.length} events.`);
        } catch (err) {
             if (!(err instanceof Error && err.message.includes('401'))) {
                 const message = err instanceof Error ? err.message : 'Ошибка при загрузке мероприятий';
                 console.error("Error in fetchEvents:", err);
                 setEventError(message);
                 setEvents([]);
             }
        } finally {
            setIsLoadingEvents(false);
        }
    }, [fetchWithAuth, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            console.log("Authentication confirmed, triggering initial event fetch.");
            fetchEvents(filters);
        } else {
             setEvents([]);
        }
    }, [isAuthenticated, fetchEvents, filters]);

    const handleFilterChange = useCallback((newFilters: EventFilters) => {
        setFilters(newFilters);
        fetchEvents(newFilters);
    }, [fetchEvents]);

    const handleResetFilters = useCallback(() => {
        setFilters({});
        fetchEvents({});
    }, [fetchEvents]);

    const handleViewDetails = (event: Event) => {
        setSelectedEvent(event);
        setIsDetailModalOpen(true);
    };

    const handleOpenAddForm = () => {
        setEventToEdit(null);
        setIsFormModalOpen(true);
    };

     const handleOpenEditForm = (event: Event) => {
        setEventToEdit(event);
        setIsFormModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedEvent(null);
    };

     const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
        setEventToEdit(null);
    };

     const handleRegister = async (formData: Record<string, string>) => {
         setAuthError(null);
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка регистрации');
            }
            setIsRegisterOpen(false);
            toast.success(data.message || 'Регистрация успешна! Теперь вы можете войти.');
            setIsLoginOpen(true);
        } catch (err) {
             const message = err instanceof Error ? err.message : 'Произошла неизвестная ошибка';
             setAuthError(message);
             toast.error(message);
             throw err;
        }
    };

    const handleLogin = async (formData: Record<string, string>) => {
         setAuthError(null);
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка входа');
            }
            if (!data.access_token || !data.user) {
                 throw new Error('Сервер не вернул токен или данные пользователя');
            }
            localStorage.setItem('authToken', data.access_token);
            setAuthToken(data.access_token);
            setIsLoginOpen(false);
            toast.success(`Добро пожаловать, ${data.user.username}!`);
        } catch (err) {
             const message = err instanceof Error ? err.message : 'Произошла неизвестная ошибка';
             setAuthError(message);
             toast.error(message);
             throw err;
        }
    };

    const handleSaveEvent = async (formData: EventFormData) => {
        const url = eventToEdit ? `/api/events/${eventToEdit.id}` : '/api/events';
        const method = eventToEdit ? 'PUT' : 'POST';

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                body: JSON.stringify(formData),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка ${eventToEdit ? 'обновления' : 'создания'} мероприятия`);
            }
            const savedEvent: Event = await response.json();

            fetchEvents(filters);

            toast.success(eventToEdit ? "Мероприятие успешно обновлено!" : "Мероприятие успешно создано!");
            handleCloseFormModal();

        } catch (err) {
            if (!(err instanceof Error && err.message.includes('401'))) {
                const message = err instanceof Error ? err.message : 'Произошла ошибка';
                toast.error(message);
            }
             throw err;
        }
    };

    const handleDeleteEvent = async (eventId: number) => {
        if (!window.confirm("Вы уверены, что хотите удалить это мероприятие?")) {
            return;
        }
        try {
            const response = await fetchWithAuth(`/api/events/${eventId}`, { method: 'DELETE' });
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(errorData.error || 'Ошибка удаления мероприятия');
            }
             fetchEvents(filters);
             toast.success("Мероприятие успешно удалено!");

             if (selectedEvent?.id === eventId) {
                 handleCloseDetailModal();
             }
        } catch (err) {
             if (!(err instanceof Error && err.message.includes('401'))) {
                const message = err instanceof Error ? err.message : 'Произошла ошибка';
                toast.error(message);
             }
        }
    };

    if (authLoading) {
        return <div style={{ textAlign: 'center', margin: '4rem 0', fontSize: '1.2em' }}>Загрузка...</div>;
    }

    const closeLoginModal = () => setIsLoginOpen(false);
    const closeRegisterModal = () => setIsRegisterOpen(false);

    return (
      <div className="container">
          <Header
              isAuthenticated={isAuthenticated}
              user={currentUser}
              onLoginClick={() => setIsLoginOpen(true)}
              onRegisterClick={() => setIsRegisterOpen(true)}
              onLogoutClick={handleLogout}
          />

          {isAuthenticated ? (
              <>
                  <EventFilter
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      onResetFilters={handleResetFilters}
                  />

                   {currentUser?.is_admin && (
                        <div className="admin-controls card">
                            <button onClick={handleOpenAddForm} className="primary-btn">
                                Добавить мероприятие
                            </button>
                        </div>
                    )}

                  <EventList
                      events={events}
                      isLoading={isLoadingEvents}
                      error={eventError}
                      onViewDetails={handleViewDetails}
                      onEdit={currentUser?.is_admin ? handleOpenEditForm : undefined}
                      onDelete={currentUser?.is_admin ? handleDeleteEvent : undefined}
                      isAdmin={currentUser?.is_admin ?? false}
                  />
              </>
          ) : (
              <div className="card" style={{ textAlign: 'center', marginTop: '2rem' }}>
                  <h2>Агрегатор мероприятий КемГУ</h2>
                  <p>Войдите или зарегистрируйтесь, чтобы просматривать и управлять мероприятиями.</p>
              </div>
          )}

          <AuthModal
              isOpen={isRegisterOpen}
              onClose={closeRegisterModal}
              onSubmit={handleRegister}
              title="Регистрация"
              submitButtonText="Зарегистрироваться"
          />
          <AuthModal
              isOpen={isLoginOpen}
              onClose={closeLoginModal}
              onSubmit={handleLogin}
              title="Вход"
              submitButtonText="Войти"
          />
          {selectedEvent && (
              <EventDetailModal
                  isOpen={isDetailModalOpen}
                  onClose={handleCloseDetailModal}
                  event={selectedEvent}
              />
          )}
           {isFormModalOpen && (
               <EventFormModal
                   isOpen={isFormModalOpen}
                   onClose={handleCloseFormModal}
                   onSubmit={handleSaveEvent}
                   eventToEdit={eventToEdit}
               />
           )}

          <ToastContainer
              position="bottom-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
          />
        </div>
    );
};

export default App;