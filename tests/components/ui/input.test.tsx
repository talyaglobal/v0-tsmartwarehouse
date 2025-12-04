import { render, screen } from '@/tests/utils/test-utils'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input data-testid="test-input" />)
    const input = screen.getByTestId('test-input')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('accepts text input', async () => {
    const user = userEvent.setup()
    render(<Input data-testid="test-input" />)
    const input = screen.getByTestId('test-input') as HTMLInputElement

    await user.type(input, 'test value')
    expect(input.value).toBe('test value')
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" data-testid="test-input" />)
    const input = screen.getByTestId('test-input')
    expect(input).toHaveClass('custom-class')
  })

  it('supports different input types', () => {
    const { rerender } = render(<Input type="text" data-testid="test-input" />)
    let input = screen.getByTestId('test-input') as HTMLInputElement
    expect(input.type).toBe('text')

    rerender(<Input type="email" data-testid="test-input" />)
    input = screen.getByTestId('test-input') as HTMLInputElement
    expect(input.type).toBe('email')

    rerender(<Input type="password" data-testid="test-input" />)
    input = screen.getByTestId('test-input') as HTMLInputElement
    expect(input.type).toBe('password')
  })

  it('supports placeholder', () => {
    render(<Input placeholder="Enter text" data-testid="test-input" />)
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
  })

  it('can be disabled', () => {
    render(<Input disabled data-testid="test-input" />)
    const input = screen.getByTestId('test-input') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('supports value prop', () => {
    render(<Input value="initial value" readOnly data-testid="test-input" />)
    const input = screen.getByTestId('test-input') as HTMLInputElement
    expect(input.value).toBe('initial value')
  })
})

