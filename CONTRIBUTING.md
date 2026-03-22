# Contributing to Stock Price Prediction Platform

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Environment Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL and MongoDB (Redis optional)
- Docker (optional, for containerized development)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sharan0555/Stock-Price-Prediction-.git
   cd Stock-Price-Prediction
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

5. **Database Setup**
   ```bash
   bash backend/setup_db.sh
   ```

## Running Tests

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
# Run backend and frontend, then:
npm run test:e2e
```

## Code Style Guidelines

### Python (Backend)
- Follow PEP 8 standards
- Use Black for code formatting
- Use isort for import sorting
- Maximum line length: 88 characters
- Use type hints for all function signatures

```bash
# Install dev dependencies
pip install black isort flake8 mypy

# Format code
black .
isort .

# Lint code
flake8 .
mypy .
```

### JavaScript/TypeScript (Frontend)
- Use ESLint and Prettier
- Follow Airbnb style guide
- Use TypeScript for all new code
- Maximum line length: 100 characters

```bash
# Format code
npm run format

# Lint code
npm run lint
```

## Pull Request Guidelines

### Branch Naming
- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Message Format
Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(api): add stock prediction endpoint
fix(frontend): resolve chart rendering issue
docs(readme): update installation instructions
```

### Pull Request Process

1. **Update Documentation**
   - Update README.md if adding new features
   - Update API documentation for backend changes
   - Add comments to complex code sections

2. **Testing**
   - Add unit tests for new functionality
   - Ensure all existing tests pass
   - Test manually in the browser

3. **Code Review**
   - Request review from at least one maintainer
   - Address all feedback before merging
   - Keep PRs focused and small

4. **Before Merging**
   - Rebase onto the latest main branch
   - Resolve all merge conflicts
   - Ensure CI/CD pipeline passes

## Development Workflow

### Making Changes
1. Create a feature branch from `main`
2. Make your changes following the style guidelines
3. Add tests for your changes
4. Update documentation as needed
5. Submit a pull request

### Debugging Tips
- Use `print()` statements for quick debugging (backend)
- Use browser DevTools for frontend debugging
- Check backend logs at `http://localhost:8001/api/docs`
- Use `npm run dev` for hot-reloading frontend

### Common Issues
- **Port conflicts**: Kill processes using ports 3000/8001
- **API limits**: Check your API key quotas
- **Database errors**: Ensure PostgreSQL/MongoDB are running
- **Environment variables**: Verify `.env` file configuration

## Reporting Issues

When reporting bugs, please include:
- Operating system and version
- Browser and version (for frontend issues)
- Steps to reproduce the issue
- Expected vs actual behavior
- Error messages and logs

## Feature Requests

For new features:
- Open an issue with "Feature Request" label
- Describe the use case and expected behavior
- Consider implementation complexity
- Discuss with maintainers before starting work

## Community Guidelines

- Be respectful and constructive
- Help others with their questions
- Follow the code of conduct
- Focus on what's best for the community
- Show empathy towards other community members

Thank you for contributing! 🚀
