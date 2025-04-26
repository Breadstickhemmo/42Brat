import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from flask_socketio import SocketIO
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta, timezone
from config import Config
from auth_routes import register_auth_routes
from models import db, bcrypt, Event, User, EventLocation, EventType, ParticipantRole
from logging_config import setup_logging
from event_routes import parse_datetime, get_user_or_404
from sqlalchemy import func, or_

setup_logging()
logger = logging.getLogger(__name__)

async_mode = 'eventlet'
app = Flask(__name__)
app.config.from_object(Config)

if not app.config.get('SECRET_KEY'):
    logger.error("FLASK_SECRET_KEY не установлен! SocketIO может работать некорректно.")

socketio = SocketIO(app, cors_allowed_origins=Config.CORS_ORIGINS, async_mode=async_mode)

CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}}, supports_credentials=True)
db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)
migrate = Migrate(app, db)

register_auth_routes(app)

@app.route('/api/events', methods=['GET'])
@jwt_required()
def get_events():
    try:
        query = Event.query
        start_date_str = request.args.get('startDate')
        end_date_str = request.args.get('endDate')
        role_str = request.args.get('role')
        location_str = request.args.get('location')
        type_str = request.args.get('type')
        search_term = request.args.get('search')

        if search_term:
            search_pattern = f"%{search_term}%"
            query = query.filter(or_(Event.title.ilike(search_pattern), Event.description.ilike(search_pattern)))
        if start_date_str:
            start_date_utc = parse_datetime(start_date_str)
            if start_date_utc:
                query = query.filter((Event.end_datetime >= start_date_utc) | (Event.start_datetime >= start_date_utc))
        if end_date_str:
            end_date_utc = parse_datetime(end_date_str)
            if end_date_utc:
               end_date_utc = datetime(end_date_utc.year, end_date_utc.month, end_date_utc.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
               query = query.filter(Event.start_datetime <= end_date_utc)
        if role_str:
            try:
                role_enum = ParticipantRole(role_str)
                query = query.filter(Event.roles_available.like(f"%{role_enum.value}%"))
            except ValueError: logger.warning(f"Invalid role filter value: {role_str}")
        if location_str:
            try:
                location_enum = EventLocation(location_str)
                query = query.filter(Event.location == location_enum)
            except ValueError: logger.warning(f"Invalid location filter value: {location_str}")
        if type_str:
            try:
                type_enum = EventType(type_str)
                query = query.filter(Event.event_type == type_enum)
            except ValueError: logger.warning(f"Invalid type filter value: {type_str}")

        query = query.order_by(Event.start_datetime.asc())
        events = query.all()
        return jsonify([event.to_dict() for event in events]), 200
    except Exception as e:
        logger.error(f"Error fetching events: {e}", exc_info=True)
        return jsonify({"error": "Не удалось загрузить мероприятия"}), 500

@app.route('/api/events/<int:event_id>', methods=['GET'])
@jwt_required()
def get_event(event_id):
    try:
        event = Event.query.get(event_id)
        if event: return jsonify(event.to_dict()), 200
        else: return jsonify({"error": "Мероприятие не найдено"}), 404
    except Exception as e:
        logger.error(f"Error fetching event {event_id}: {e}", exc_info=True)
        return jsonify({"error": "Ошибка сервера"}), 500

@app.route('/api/events', methods=['POST'])
@jwt_required()
def create_event():
    current_user_id = get_jwt_identity()
    user = get_user_or_404(current_user_id)
    if not user or not user.is_admin: return jsonify({"error": "Требуются права администратора"}), 403
    data = request.get_json()
    if not data: return jsonify({"error": "Нет данных"}), 400
    required_fields = ['title', 'description', 'start_datetime', 'location', 'event_type', 'roles_available']
    if not all(field in data and data[field] for field in required_fields):
        missing = [f for f in required_fields if f not in data or not data[f]]
        return jsonify({"error": f"Не все обязательные поля заполнены: {', '.join(missing)}"}), 400
    try:
        start_dt_utc = parse_datetime(data['start_datetime'])
        end_dt_utc = parse_datetime(data.get('end_datetime'))
        if not start_dt_utc: return jsonify({"error": "Неверный формат или отсутствует дата начала"}), 400
        if data.get('end_datetime') and not end_dt_utc: return jsonify({"error": "Неверный формат даты окончания"}), 400
        if end_dt_utc and start_dt_utc and end_dt_utc < start_dt_utc: return jsonify({"error": "Дата окончания не может быть раньше даты начала"}), 400
        try:
            location_enum = EventLocation(data['location'])
            type_enum = EventType(data['event_type'])
            roles_list = []
            if isinstance(data['roles_available'], list):
                for role_val in data['roles_available']:
                   try: roles_list.append(ParticipantRole(role_val))
                   except ValueError: return jsonify({"error": f"Недопустимая роль: {role_val}"}), 400
            else: return jsonify({"error": "'roles_available' должно быть списком строк ролей"}), 400
            if not roles_list: return jsonify({"error": "Необходимо указать хотя бы одну роль"}), 400
        except ValueError as e: return jsonify({"error": f"Недопустимое значение для location или event_type: {e}"}), 400
        except TypeError as e: return jsonify({"error": f"Неверный тип данных для location или event_type: {e}"}), 400

        new_event = Event(
            title=data['title'], description=data['description'], start_datetime=start_dt_utc,
            end_datetime=end_dt_utc, location=location_enum, location_details=data.get('location_details'),
            event_type=type_enum, registration_link_participant=data.get('registration_link_participant'),
            registration_link_volunteer=data.get('registration_link_volunteer'),
            registration_link_organizer=data.get('registration_link_organizer'), author_id=current_user_id
        )
        new_event.set_roles_list(roles_list)
        db.session.add(new_event)
        db.session.commit()
        logger.info(f"Event '{new_event.title}' (ID: {new_event.id}) created by user {current_user_id}")

        try:
            notification_data = {
                'eventId': new_event.id,
                'eventTitle': new_event.title
            }
            socketio.emit('new_event_added', notification_data)
            logger.info(f"Отправлено уведомление 'new_event_added' для события ID: {new_event.id}")
        except Exception as e:
             logger.error(f"Ошибка при отправке уведомления 'new_event_added' для события ID {new_event.id}: {e}", exc_info=True)

        return jsonify(new_event.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating event: {e}", exc_info=True)
        return jsonify({"error": "Ошибка при создании мероприятия"}), 500

@app.route('/api/events/<int:event_id>', methods=['PUT'])
@jwt_required()
def update_event(event_id):
    current_user_id = get_jwt_identity()
    user = get_user_or_404(current_user_id)
    if not user or not user.is_admin: return jsonify({"error": "Требуются права администратора"}), 403
    event = Event.query.get(event_id)
    if not event: return jsonify({"error": "Мероприятие не найдено"}), 404
    data = request.get_json()
    if not data: return jsonify({"error": "Нет данных для обновления"}), 400
    try:
        if 'title' in data: event.title = data['title']
        if 'description' in data: event.description = data['description']
        if 'start_datetime' in data:
             start_dt_utc = parse_datetime(data['start_datetime'])
             if not start_dt_utc: return jsonify({"error": "Неверный формат даты начала"}), 400
             event.start_datetime = start_dt_utc
        if 'end_datetime' in data:
             end_dt_utc = parse_datetime(data['end_datetime'])
             if data['end_datetime'] and not end_dt_utc: return jsonify({"error": "Неверный формат даты окончания"}), 400
             event.end_datetime = end_dt_utc
        if event.end_datetime and event.start_datetime and event.end_datetime < event.start_datetime: return jsonify({"error": "Дата окончания не может быть раньше даты начала"}), 400
        if 'location' in data:
            try: event.location = EventLocation(data['location'])
            except ValueError: return jsonify({"error": "Недопустимое местоположение"}), 400
        if 'location_details' in data: event.location_details = data.get('location_details')
        if 'event_type' in data:
            try: event.event_type = EventType(data['event_type'])
            except ValueError: return jsonify({"error": "Недопустимый тип мероприятия"}), 400
        if 'roles_available' in data:
            if isinstance(data['roles_available'], list):
                roles_list = []
                for role_val in data['roles_available']:
                    try: roles_list.append(ParticipantRole(role_val))
                    except ValueError: return jsonify({"error": f"Недопустимая роль: {role_val}"}), 400
                if not roles_list: return jsonify({"error": "Необходимо указать хотя бы одну роль"}), 400
                event.set_roles_list(roles_list)
            else: return jsonify({"error": "'roles_available' должно быть списком строк ролей"}), 400
        if 'registration_link_participant' in data: event.registration_link_participant = data.get('registration_link_participant')
        if 'registration_link_volunteer' in data: event.registration_link_volunteer = data.get('registration_link_volunteer')
        if 'registration_link_organizer' in data: event.registration_link_organizer = data.get('registration_link_organizer')
        db.session.commit()
        logger.info(f"Event ID {event_id} updated by user {current_user_id}")
        return jsonify(event.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating event {event_id}: {e}", exc_info=True)
        return jsonify({"error": "Ошибка при обновлении мероприятия"}), 500

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_event(event_id):
    current_user_id = get_jwt_identity()
    user = get_user_or_404(current_user_id)
    if not user or not user.is_admin: return jsonify({"error": "Требуются права администратора"}), 403
    event = Event.query.get(event_id)
    if not event: return jsonify({"error": "Мероприятие не найдено"}), 404
    try:
        db.session.delete(event)
        db.session.commit()
        logger.info(f"Event ID {event_id} deleted by user {current_user_id}")
        return jsonify({"message": "Мероприятие успешно удалено"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting event {event_id}: {e}", exc_info=True)
        return jsonify({"error": "Ошибка при удалении мероприятия"}), 500

upcoming_event_notifications_sent = set()

def check_upcoming_events():
    with app.app_context():
        now = datetime.now(timezone.utc)
        soon_threshold = now + timedelta(days=1)
        upcoming = Event.query.filter(
            Event.start_datetime > now,
            Event.start_datetime <= soon_threshold,
            Event.id.notin_(upcoming_event_notifications_sent)
        ).all()

        if upcoming:
            logger.info(f"Найдены предстоящие события (за день) для уведомления: {[e.id for e in upcoming]}")

        for event in upcoming:
            try:
                logger.info(f"Отправка уведомления о событии ID: {event.id} ('{event.title}')")
                notification_data = {
                    'eventId': event.id,
                    'title': 'Скоро начнется!',
                    'message': f"Мероприятие '{event.title}' начнется {event.start_datetime.strftime('%d.%m.%Y в %H:%M')} (UTC).",
                }
                socketio.emit('upcoming_event', notification_data)
                upcoming_event_notifications_sent.add(event.id)
                logger.info(f"Уведомление 'upcoming_event' о событии ID: {event.id} отправлено.")
            except Exception as e:
                 logger.error(f"Ошибка при отправке уведомления 'upcoming_event' о событии ID {event.id}: {e}", exc_info=True)

        cleanup_threshold = now - timedelta(days=1)
        expired_ids = set()
        current_sent_ids = list(upcoming_event_notifications_sent)

        for event_id in current_sent_ids:
            event = Event.query.get(event_id)
            if event is None:
                expired_ids.add(event_id)
                continue

            event_start_dt_naive = event.start_datetime
            if event_start_dt_naive.tzinfo is None:
                 event_start_dt_aware = event_start_dt_naive.replace(tzinfo=timezone.utc)
            else:
                 event_start_dt_aware = event_start_dt_naive

            if event_start_dt_aware < cleanup_threshold:
                expired_ids.add(event_id)

        if expired_ids:
             upcoming_event_notifications_sent.difference_update(expired_ids)
             logger.info(f"Очищены старые ID уведомлений: {expired_ids}")

scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(check_upcoming_events, 'interval', minutes=5)
scheduler.start()
logger.info("Планировщик уведомлений запущен.")

@socketio.on('connect')
def handle_connect():
    logger.info(f'Клиент подключился: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Клиент отключился: {request.sid}')


if __name__ == '__main__':
    logger.info("Запуск Flask-SocketIO приложения...")
    socketio.run(app, debug=Config.DEBUG, host='0.0.0.0', port=5000, use_reloader=Config.DEBUG)