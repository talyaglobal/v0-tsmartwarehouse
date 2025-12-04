# Testing Guide

This directory contains all tests for the TSmart Warehouse Management System.

## Test Structure

```
tests/
├── unit/              # Unit tests for utilities and pure functions
├── components/         # Component tests using React Testing Library
├── integration/        # Integration tests for API routes
└── utils/              # Test utilities and mocks

e2e/                    # End-to-end tests using Playwright
```

## Running Tests

### Unit Tests
```bash
npm run test:unit
```

### Component Tests
```bash
npm run test:component
```

### Integration Tests
```bash
npm run test:integration
```

### All Jest Tests
```bash
npm run test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Run All Tests
```bash
npm run test:all
```

## Writing Tests

### Unit Tests

Test pure functions and utilities:

```typescript
import { formatCurrency } from '@/lib/utils/format'

describe('formatCurrency', () => {
  it('formats numbers correctly', () => {
    expect(formatCurrency(100)).toBe('$100.00')
  })
})
```

### Component Tests

Test React components:

```typescript
import { render, screen } from '@/tests/utils/test-utils'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

### Integration Tests

Test API routes:

```typescript
import { GET } from '@/app/api/v1/bookings/route'

describe('/api/v1/bookings', () => {
  it('returns bookings', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/bookings')
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
```

### E2E Tests

Test user flows:

```typescript
import { test, expect } from '@playwright/test'

test('user can login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*dashboard/)
})
```

## Test Utilities

### Custom Render

Use the custom render function for components that need providers:

```typescript
import { render } from '@/tests/utils/test-utils'

render(<YourComponent />)
```

### Mocks

Use predefined mocks:

```typescript
import { mockUser, mockBooking } from '@/tests/utils/mocks'
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it

2. **Use Descriptive Test Names**
   - `it('should format currency with two decimal places')`

3. **Arrange-Act-Assert Pattern**
   ```typescript
   // Arrange
   const input = 100
   
   // Act
   const result = formatCurrency(input)
   
   // Assert
   expect(result).toBe('$100.00')
   ```

4. **Keep Tests Isolated**
   - Each test should be independent
   - Use `beforeEach` and `afterEach` for setup/cleanup

5. **Mock External Dependencies**
   - Mock API calls, database queries, etc.
   - Use `jest.mock()` for module mocks

6. **Test Edge Cases**
   - Empty inputs, null values, boundary conditions

7. **Maintain Test Coverage**
   - Aim for >80% coverage
   - Focus on critical paths

## Coverage

View coverage report:
```bash
npm run test:coverage
```

Open HTML report:
```bash
open coverage/lcov-report/index.html
```

## CI/CD Integration

Tests run automatically in CI/CD pipelines. Ensure all tests pass before merging:

```bash
npm run test:all
```

## Troubleshooting

### Tests failing with module not found
- Clear Jest cache: `npm test -- --clearCache`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### E2E tests timing out
- Increase timeout in `playwright.config.ts`
- Check if dev server is running

### Coverage not updating
- Delete `coverage` directory
- Run `npm run test:coverage` again

