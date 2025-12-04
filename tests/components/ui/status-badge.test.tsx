import { render, screen } from '@/tests/utils/test-utils'
import { StatusBadge, SeverityBadge, PriorityBadge } from '@/components/ui/status-badge'

describe('StatusBadge', () => {
  it('renders pending status correctly', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders confirmed status correctly', () => {
    render(<StatusBadge status="confirmed" />)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('renders active status correctly', () => {
    render(<StatusBadge status="active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders completed status correctly', () => {
    render(<StatusBadge status="completed" />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders cancelled status correctly', () => {
    render(<StatusBadge status="cancelled" />)
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('renders invoice statuses correctly', () => {
    const { rerender } = render(<StatusBadge status="draft" />)
    expect(screen.getByText('Draft')).toBeInTheDocument()

    rerender(<StatusBadge status="paid" />)
    expect(screen.getByText('Paid')).toBeInTheDocument()

    rerender(<StatusBadge status="overdue" />)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('renders task statuses correctly', () => {
    const { rerender } = render(<StatusBadge status="assigned" />)
    expect(screen.getByText('Assigned')).toBeInTheDocument()

    rerender(<StatusBadge status="in-progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('renders claim statuses correctly', () => {
    const { rerender } = render(<StatusBadge status="submitted" />)
    expect(screen.getByText('Submitted')).toBeInTheDocument()

    rerender(<StatusBadge status="under-review" />)
    expect(screen.getByText('Under Review')).toBeInTheDocument()

    rerender(<StatusBadge status="approved" />)
    expect(screen.getByText('Approved')).toBeInTheDocument()

    rerender(<StatusBadge status="rejected" />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<StatusBadge status="pending" className="custom-class" />)
    const badge = screen.getByText('Pending')
    expect(badge).toHaveClass('custom-class')
  })
})

describe('SeverityBadge', () => {
  it('renders all severity levels correctly', () => {
    const { rerender } = render(<SeverityBadge severity="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()

    rerender(<SeverityBadge severity="medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()

    rerender(<SeverityBadge severity="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()

    rerender(<SeverityBadge severity="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<SeverityBadge severity="high" className="custom-class" />)
    const badge = screen.getByText('High')
    expect(badge).toHaveClass('custom-class')
  })
})

describe('PriorityBadge', () => {
  it('renders all priority levels correctly', () => {
    const { rerender } = render(<PriorityBadge priority="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()

    rerender(<PriorityBadge priority="medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()

    rerender(<PriorityBadge priority="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()

    rerender(<PriorityBadge priority="urgent" />)
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<PriorityBadge priority="urgent" className="custom-class" />)
    const badge = screen.getByText('Urgent')
    expect(badge).toHaveClass('custom-class')
  })
})

