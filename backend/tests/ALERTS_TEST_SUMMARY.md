# Price Alert System Tests

This document summarizes the comprehensive test suite created for the Price Alert System.

## Test Files Created

### 1. `test_alert_service.py`
Tests for the AlertService business logic and alert evaluation functionality.

#### Test Coverage:
- **Empty alerts handling**: Returns empty list when no alerts exist
- **Price Above alerts**: 
  - Triggers when price > threshold
  - Does NOT trigger when price <= threshold
- **Price Below alerts**:
  - Triggers when price < threshold  
  - Does NOT trigger when price >= threshold
- **Volatility alerts**:
  - Triggers when std dev > threshold
  - Does NOT trigger when std dev <= threshold
- **Error resilience**:
  - Single symbol lookup failure doesn't stop other alerts
  - Total failure returns empty list instead of exception
- **Edge cases**:
  - Insufficient data for volatility calculation
  - Service failure handling
  - Inactive alerts are ignored

#### Key Test Scenarios:
```python
# Price above threshold triggers
test_price_above_alert_triggers_when_price_above_threshold()

# Price at threshold does not trigger  
test_price_above_alert_does_not_trigger_when_price_equals_threshold()

# Single failure doesn't crash evaluation
test_single_symbol_lookup_failure_does_not_stop_other_alerts()

# Total failure returns empty list
test_evaluate_alerts_returns_empty_list_on_total_failure()
```

### 2. `test_alerts_router.py`
Tests for all API endpoints in the alerts router.

#### Test Coverage:
- **POST /api/v1/alerts**:
  - Creates alert successfully (201 status)
  - Validates required fields (422 status for missing/invalid data)
  - Handles database errors (400 status)
  - Auto-converts symbol to uppercase
- **GET /api/v1/alerts**:
  - Returns list of alerts
  - Supports symbol and is_active filtering
  - Handles empty results
- **GET /api/v1/alerts/{id}**:
  - Returns specific alert
  - Returns 404 for non-existent alerts
- **DELETE /api/v1/alerts/{id}**:
  - Successfully removes alert (204 status)
  - Returns 404 for non-existent alerts
- **PATCH /api/v1/alerts/{id}**:
  - Updates alert properties
  - Validates update data
  - Returns 404 for non-existent alerts
- **Notification endpoints**:
  - GET /api/v1/notifications
  - PATCH /api/v1/notifications/{id}/read
  - PATCH /api/v1/notifications/read-all
- **Manual evaluation**:
  - POST /api/v1/alerts/evaluate

#### Validation Tests:
```python
# Missing symbol returns 422
test_post_alerts_with_missing_symbol_returns_422()

# Negative threshold returns 422
test_post_alerts_with_negative_threshold_returns_422()

# Invalid alert type returns 422
test_post_alerts_with_invalid_alert_type_returns_422()
```

## Testing Patterns Used

### Mocking Strategy
- **Database mocking**: Uses `MagicMock(spec=Session)` for database sessions
- **Service mocking**: Mocks external services (YFinance, NotificationService)
- **Model mocking**: Mocks SQLAlchemy models for database operations

### Test Fixtures
```python
@pytest.fixture
def alert_service():
    return AlertService()

@pytest.fixture  
def mock_db_session():
    return MagicMock(spec=Session)

@pytest.fixture
def sample_alert():
    return Alert(...)
```

### Error Simulation
- Database connection failures
- External service API failures  
- Invalid data scenarios
- Missing resource scenarios

## Running the Tests

### Prerequisites
Ensure pytest and pytest-asyncio are installed:
```bash
pip install pytest pytest-asyncio
```

### Run All Tests
```bash
cd backend
pytest tests/test_alert_service.py tests/test_alerts_router.py -v
```

### Run Specific Test File
```bash
# Alert service tests
pytest tests/test_alert_service.py -v

# API router tests  
pytest tests/test_alerts_router.py -v
```

### Run Specific Test
```bash
pytest tests/test_alert_service.py::test_price_above_alert_triggers_when_price_above_threshold -v
```

### Run with Coverage
```bash
pytest tests/test_alert_service.py tests/test_alerts_router.py --cov=app.services.alert_service --cov=app.routers.alerts --cov-report=html
```

## Test Data Management

### Sample Alert Creation
```python
@pytest.fixture
def sample_alerts():
    alerts = [
        Alert(id=1, symbol="AAPL", alert_type="price_above", threshold=150.0, is_active=True),
        Alert(id=2, symbol="TSLA", alert_type="price_below", threshold=200.0, is_active=True),
        Alert(id=3, symbol="NVDA", alert_type="volatility", threshold=25.0, is_active=True),
        Alert(id=4, symbol="GOOGL", alert_type="price_above", threshold=2500.0, is_active=False)
    ]
    return alerts
```

### Mock Service Responses
```python
# Mock price lookup
with patch.object(alert_service, '_get_latest_price', return_value=160.0):

# Mock volatility calculation  
with patch.object(alert_service, 'check_volatility', return_value=30.0):

# Mock notification service
with patch.object(alert_service.notification_service, 'send_in_app_notification') as mock_notify:
```

## Test Coverage Summary

### Alert Service Tests: 15 test cases
- 7 functional tests (alert types, thresholds)
- 4 error handling tests  
- 4 edge case tests

### Alert Router Tests: 25+ test cases
- 8 POST /alerts tests (creation + validation)
- 4 GET /alerts tests (listing + filtering)
- 4 GET /alerts/{id} tests  
- 4 DELETE /alerts/{id} tests
- 4 PATCH /alerts/{id} tests
- 3 notification endpoint tests
- 2 manual evaluation tests

### Total Coverage: ~40 test cases covering:
- All CRUD operations
- Input validation
- Error scenarios
- Edge cases
- Business logic
- API contracts

## Best Practices Implemented

1. **Isolation**: Each test is independent with proper mocking
2. **Comprehensive coverage**: Happy path, error paths, edge cases
3. **Clear naming**: Test names describe exactly what they test
4. **Proper fixtures**: Reusable test data and setup
5. **Mock verification**: Assert mocks were called correctly
6. **Status code testing**: Verify HTTP status codes
7. **Data validation**: Test both valid and invalid inputs
8. **Error simulation**: Test failure scenarios

This test suite provides confidence that the Price Alert System works correctly under various conditions and handles errors gracefully.
