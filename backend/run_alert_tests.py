#!/usr/bin/env python3
"""
Simple test runner for Price Alert System tests that avoids TensorFlow/FastAPI imports.
"""

import subprocess
import sys
import os

def run_alert_tests():
    """Run the alert system tests without loading conftest.py."""
    
    # Change to backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    # Test files to run
    test_files = [
        'tests/test_alerts_standalone.py',
        'tests/test_alerts_validation.py'
    ]
    
    # Pytest arguments
    pytest_args = [
        'python', '-m', 'pytest',
        *test_files,
        '-v',
        '--ignore=tests/conftest.py',
        '--tb=short'
    ]
    
    print("Running Price Alert System Tests...")
    print("=" * 50)
    
    try:
        result = subprocess.run(pytest_args, capture_output=False, text=True)
        return result.returncode
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        return 1
    except Exception as e:
        print(f"Error running tests: {e}")
        return 1

def run_alert_tests_with_coverage():
    """Run alert tests with coverage report."""
    
    # Change to backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    # Test files to run
    test_files = [
        'tests/test_alerts_standalone.py',
        'tests/test_alerts_validation.py'
    ]
    
    # Pytest arguments with coverage
    pytest_args = [
        'python', '-m', 'pytest',
        *test_files,
        '-v',
        '--ignore=tests/conftest.py',
        '--cov=app.services.alert_service',
        '--cov=app.routers.alerts',
        '--cov-report=html',
        '--cov-report=term-missing',
        '--tb=short'
    ]
    
    print("Running Price Alert System Tests with Coverage...")
    print("=" * 60)
    
    try:
        result = subprocess.run(pytest_args, capture_output=False, text=True)
        if result.returncode == 0:
            print("\nCoverage report generated in htmlcov/index.html")
        return result.returncode
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        return 1
    except Exception as e:
        print(f"Error running tests: {e}")
        return 1

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--coverage':
        exit_code = run_alert_tests_with_coverage()
    else:
        exit_code = run_alert_tests()
    
    sys.exit(exit_code)
