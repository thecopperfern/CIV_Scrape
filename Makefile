.PHONY: help test test-unit test-integration test-fast test-coverage clean install lint

help:
	@echo "CIV Enterprises Customer Prospecting - Available Commands:"
	@echo ""
	@echo "  make install          Install dependencies"
	@echo "  make test             Run all tests with coverage"
	@echo "  make test-unit        Run unit tests only"
	@echo "  make test-integration Run integration tests only"
	@echo "  make test-fast        Run fast tests (no coverage)"
	@echo "  make test-coverage    Run tests with detailed coverage report"
	@echo "  make clean            Clean up temporary files"
	@echo "  make lint             Run code linters"
	@echo ""

install:
	@echo "Installing dependencies..."
	pip install -r requirements.txt

test:
	@echo "Running all tests..."
	./run_tests.sh all

test-unit:
	@echo "Running unit tests..."
	./run_tests.sh unit

test-integration:
	@echo "Running integration tests..."
	./run_tests.sh integration

test-fast:
	@echo "Running fast tests..."
	./run_tests.sh fast

test-coverage:
	@echo "Running tests with coverage..."
	./run_tests.sh coverage

clean:
	@echo "Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name ".coverage" -delete
	@echo "Clean complete"

lint:
	@echo "Running linters..."
	@command -v flake8 >/dev/null 2>&1 && flake8 utils/ scripts/ || echo "flake8 not installed, skipping..."
	@command -v black >/dev/null 2>&1 && black --check utils/ scripts/ || echo "black not installed, skipping..."
	@command -v mypy >/dev/null 2>&1 && mypy utils/ scripts/ || echo "mypy not installed, skipping..."
