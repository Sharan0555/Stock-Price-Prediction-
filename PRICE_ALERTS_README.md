# Price Alert System Implementation

This document describes the complete Price Alert System implementation for the StockPricePrediction project.

## Overview

The Price Alert System allows users to set up notifications for stock price movements and volatility. It includes:

- **Backend**: FastAPI services for alert management, evaluation, and notifications
- **Frontend**: React components for creating alerts and viewing notifications
- **Database**: PostgreSQL for alert storage, MongoDB for notifications
- **Background Processing**: Automated alert evaluation every 60 seconds

## Backend Implementation

### Database Models

#### Alerts Table (PostgreSQL)
```sql
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),  -- Nullable for now
    symbol VARCHAR(10) NOT NULL,
    alert_type VARCHAR(20) NOT NULL,  -- "price_above", "price_below", "volatility"
    threshold FLOAT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Notifications Collection (MongoDB)
```javascript
{
  _id: String (UUID),
  symbol: String,
  message: String,
  alert_type: String,
  triggered_at: Date,
  is_read: Boolean,
  alert_id: Number,
  user_id: String
}
```

### API Endpoints

#### Alert Management
- `POST /api/v1/alerts` - Create new alert
- `GET /api/v1/alerts` - List alerts (with optional filters)
- `GET /api/v1/alerts/{id}` - Get specific alert
- `PATCH /api/v1/alerts/{id}` - Update alert (activate/deactivate)
- `DELETE /api/v1/alerts/{id}` - Delete alert

#### Notifications
- `GET /api/v1/notifications` - Get notifications (unread by default)
- `PATCH /api/v1/notifications/{id}/read` - Mark notification as read
- `PATCH /api/v1/notifications/read-all` - Mark all notifications as read

#### Alert Evaluation
- `POST /api/v1/alerts/evaluate` - Manually trigger alert evaluation

### Services

#### AlertService (`app/services/alert_service.py`)
- `evaluate_alerts()` - Evaluates all active alerts against current prices
- `check_volatility()` - Calculates rolling standard deviation of prices
- `_get_latest_price()` - Fetches current price from YFinance service

#### NotificationService (`app/services/notification_service.py`)
- `send_in_app_notification()` - Stores notifications in MongoDB
- `send_email_notification()` - Email notification stub (ready for SMTP integration)
- `get_notifications()` - Retrieves notifications with filtering
- `mark_notification_read()` - Marks individual notifications as read
- `mark_all_notifications_read()` - Marks all notifications as read

### Background Scheduler

The system uses APScheduler to run alert evaluation every 60 seconds:
- Automatically starts with the FastAPI application
- Evaluates all active alerts
- Sends notifications for triggered alerts
- Gracefully shuts down with the application

## Frontend Implementation

### Components

#### AlertPanel (`components/alerts/AlertPanel.tsx`)
- Form to create new alerts
- List of active alerts with management controls
- Collapsible interface
- Symbol-specific filtering when used on stock pages

#### NotificationBell (`components/alerts/NotificationBell.tsx`)
- Bell icon in navbar with unread count badge
- Dropdown showing recent notifications
- Mark as read functionality
- Auto-refreshes every 30 seconds

### API Hooks

#### useAlerts (`hooks/useAlerts.ts`)
- `fetchAlerts()` - Retrieve alerts with filtering
- `createAlert()` - Create new alert
- `deleteAlert()` - Delete alert
- `updateAlert()` - Update alert properties

#### useNotifications (`hooks/useNotifications.ts`)
- `fetchNotifications()` - Get notifications
- `markAsRead()` - Mark individual notification as read
- `markAllAsRead()` - Mark all notifications as read
- Auto-refreshes every 30 seconds

### Integration

#### Navigation Bar
- NotificationBell integrated into `app/app-header.tsx`
- Shows unread count badge
- Dropdown with notification management

#### Prediction Page
- AlertPanel integrated into `app/prediction/page.tsx`
- Symbol-specific alerts when viewing stock predictions
- Collapsible section below strategy cards

## Alert Types

### Price Above
- Triggers when stock price exceeds threshold
- Example: Alert when AAPL price goes above $150

### Price Below  
- Triggers when stock price falls below threshold
- Example: Alert when TSLA price goes below $200

### High Volatility
- Triggers when price volatility exceeds threshold
- Uses rolling standard deviation of daily returns
- Annualized volatility percentage
- Example: Alert when NVDA volatility exceeds 25%

## Setup Instructions

### 1. Database Setup
```bash
# Run the migration script
cd backend
python app/migrations/create_alerts_table.py
```

### 2. Install Dependencies
```bash
# Backend
cd backend
pip install apscheduler>=3.10.4

# Frontend (no additional dependencies needed)
```

### 3. Environment Variables
Ensure your `.env` file includes:
```env
POSTGRES_DSN=postgresql+psycopg2://postgres:postgres@localhost:5432/stocks
MONGO_DSN=mongodb://localhost:27017/stocks
```

### 4. Start Services
```bash
# Start backend
cd backend
python -m uvicorn app.main:app --reload

# Start frontend  
cd frontend
npm run dev
```

## Usage

### Creating Alerts
1. Navigate to the Stock Prediction page
2. Search for a stock symbol
3. Expand the "Price Alerts" section
4. Fill in the alert form:
   - Symbol (auto-filled if on stock page)
   - Alert type (Price Above/Below/High Volatility)
   - Threshold value
5. Click "Create Alert"

### Managing Alerts
- View active alerts in the AlertPanel
- Toggle alerts on/off with the bell icon
- Delete alerts with the trash icon
- All alerts are symbol-specific when created from stock pages

### Viewing Notifications
- Click the notification bell in the navbar
- See unread count badge
- View recent notifications in dropdown
- Mark notifications as read individually or all at once
- Notifications auto-refresh every 30 seconds

## Technical Details

### Alert Evaluation Process
1. Background job runs every 60 seconds
2. Fetches all active alerts from PostgreSQL
3. For each alert:
   - Gets current price from YFinance
   - For volatility alerts, calculates 10-day rolling std dev
   - Checks if alert condition is met
4. If triggered:
   - Marks alert as triggered and inactive
   - Creates notification in MongoDB
   - Sends email notification (stub - ready for SMTP)

### Error Handling
- Graceful error handling for API failures
- Comprehensive logging for debugging
- User-friendly error messages in UI
- Fallback behavior for missing data

### Performance Considerations
- Efficient database queries with proper indexing
- Background processing doesn't block API requests
- Frontend polling limited to 30-second intervals
- Caching of stock price data

## Future Enhancements

### Planned Features
- User authentication integration
- Email notifications with SMTP
- SMS notifications
- Webhook notifications
- Alert history and analytics
- Bulk alert operations
- Alert templates
- Advanced volatility calculations

### Database Optimizations
- Add database indexes for performance
- Partition alerts table by user_id
- Implement data retention policies

### UI/UX Improvements
- Alert analytics dashboard
- Mobile-responsive design improvements
- Alert sound notifications
- Browser push notifications

## Troubleshooting

### Common Issues

#### Alerts Not Triggering
- Check that background scheduler is running
- Verify database connections
- Check logs for evaluation errors
- Ensure alerts are marked as active

#### Notifications Not Showing
- Verify MongoDB connection
- Check notification service logs
- Ensure frontend polling is working
- Check browser console for errors

#### Database Issues
- Run migration script to create tables
- Check database connection strings
- Verify proper permissions

### Logging
Check application logs for:
- `[alerts]` prefix for alert-related messages
- `[startup]` prefix for scheduler initialization
- Error messages with full stack traces

## API Documentation

Once running, visit `http://localhost:8000/api/docs` to see the full OpenAPI documentation for all alert endpoints.
