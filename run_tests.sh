#!/bin/bash
# Test runner script for CIV Enterprises Customer Prospecting System

set -e  # Exit on error

echo "=========================================="
echo "CIV Enterprises - Test Suite Runner"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if pytest is installed
if ! python -m pytest --version > /dev/null 2>&1; then
    echo -e "${RED}Error: pytest is not installed${NC}"
    echo "Installing test dependencies..."
    pip install -r requirements.txt
fi

# Parse command line arguments
TEST_TYPE="${1:-all}"
COVERAGE="${2:-true}"

echo "Test Type: $TEST_TYPE"
echo "Coverage: $COVERAGE"
echo ""

# Run tests based on type
case "$TEST_TYPE" in
    "unit")
        echo -e "${YELLOW}Running unit tests only...${NC}"
        python -m pytest tests/unit/ -v
        ;;
    "integration")
        echo -e "${YELLOW}Running integration tests only...${NC}"
        python -m pytest tests/integration/ -v
        ;;
    "fast")
        echo -e "${YELLOW}Running fast tests (unit only, no coverage)...${NC}"
        python -m pytest tests/unit/ -v --no-cov
        ;;
    "coverage")
        echo -e "${YELLOW}Running all tests with detailed coverage...${NC}"
        python -m pytest --cov=utils --cov=scripts --cov=config --cov-report=html --cov-report=term-missing
        echo ""
        echo -e "${GREEN}Coverage report generated in htmlcov/index.html${NC}"
        ;;
    "all"|*)
        echo -e "${YELLOW}Running all tests...${NC}"
        if [ "$COVERAGE" = "true" ]; then
            python -m pytest
        else
            python -m pytest --no-cov
        fi
        ;;
esac

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "✓ All tests passed!"
    echo -e "==========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "✗ Some tests failed"
    echo -e "==========================================${NC}"
    exit 1
fi
