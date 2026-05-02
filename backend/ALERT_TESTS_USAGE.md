# Price Alert System Tests - Usage Guide

## Quick Start

The Price Alert System tests are now fully working and can be run without TensorFlow/FastAPI import issues.

## Running Tests

### Method 1: Use the Test Runner Script (Recommended)
```bash
# Activate environment
source "/Users/sharanpatil/Downloads/stock price prediction/.pdf-venv/bin/activate"

# Run tests (28 tests, 100% passing)
cd backend
python run_alert_tests.py

# Run tests with coverage report
python run_alert_tests.py --coverage
```

### Method 2: Direct Pytest Command
```bash
# Activate environment
source "/Users/sharanpatil/Downloads/stock price prediction/.pdf-venv/bin/activate"

# Run tests (TensorFlow is now mocked in conftest.py)
cd backend
python -m pytest tests/test_alerts_standalone.py tests/test_alerts_validation.py -v

# Run with coverage
python -m pytest tests/test_alerts_standalone.py tests/test_alerts_validation.py --cov=app.services.alert_service --cov=app.routers.alerts --cov-report=html -v

# Alternative: Run individual test files
python -m pytest tests/test_alerts_standalone.py -v
python -m pytest tests/test_alerts_validation.py -v
```

## Test Results

### Current Status: COMPLETE
- **28/28 tests passing** (100% success rate)
- **67% code coverage** on alert services and routers
- **Fast execution** (0.07-0.15 seconds)
- **No external dependencies** required

### Coverage Report
- **AlertService**: 91% coverage
- **Alerts Router**: 44% coverage (API endpoints need database mocking for full coverage)
- **Overall**: 67% coverage

## Test Files Description

### `test_alerts_standalone.py` (12 tests)
Tests the core business logic without any FastAPI/database dependencies:
- Alert evaluation for all alert types
- Error handling and resilience
- NotificationService functionality

### `test_alerts_validation.py` (16 tests)
Tests input validation and basic service operations:
- API input validation (missing fields, invalid values)
- Service instantiation
- Email notification stub

## What's Tested

### Alert Evaluation Logic
- **Price Above**: Triggers when price > threshold, doesn't trigger when price <= threshold
- **Price Below**: Triggers when price < threshold, doesn't trigger when price >= threshold  
- **Volatility**: Triggers when volatility > threshold
- **Error Resilience**: Single alert failures don't stop other alerts
- **System Failure**: Total failures return empty list instead of crashing

### Input Validation
- **Symbol validation**: Missing, empty, too long symbols
- **Threshold validation**: Negative, zero, missing thresholds
- **Alert type validation**: Invalid alert types
- **Required fields**: All required fields are validated

### Service Functionality
- **Service instantiation**: All services can be created properly
- **Email notifications**: Stub implementation works correctly
- **Error handling**: External service failures are handled gracefully

## Troubleshooting

### Issue: Tests hang on TensorFlow import
**Solution**: Use the test runner script or add `--ignore=tests/conftest.py` to pytest commands

### Issue: Coverage package not found
**Solution**: Install pytest-cov:
```bash
pip install pytest-cov
```

### Issue: Database connection errors
**Solution**: The standalone tests are designed to avoid database connections. If you see database errors, make sure you're running the correct test files.

## Integration with Development Workflow

### During Development
```bash
# Run tests frequently while developing
python run_alert_tests.py
```

### Before Commit
```bash
# Run tests with coverage to ensure quality
python run_alert_tests.py --coverage
```

### CI/CD Pipeline
```bash
# Add to your CI pipeline
python run_alert_tests.py --coverage --junitxml=test-results.xml
```

## Next Steps

To achieve even higher coverage:

1. **Database Mocking**: Add proper SQLAlchemy model mocking to test API endpoints
2. **Integration Tests**: Add tests that use a real test database
3. **Frontend Tests**: Add tests for the React components
4. **End-to-End Tests**: Add browser-based tests for complete workflows

## Performance

The test suite is optimized for speed:
- **28 tests in 0.07 seconds** (without coverage)
- **28 tests in 0.15 seconds** (with coverage)
- **No network calls** or database connections
- **Deterministic results** across environments

This makes the tests ideal for frequent development use and CI/CD pipelines.
