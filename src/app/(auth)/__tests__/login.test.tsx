import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

const mockSignIn = vi.fn()
const mockResend = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      resend: mockResend,
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockReset()
    mockResend.mockReset()
    mockResend.mockResolvedValue({ error: null })
  })

  it('renders the login form and account link', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: /pick up where you left off/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /create an account/i })
    expect(link).toHaveAttribute('href', '/register')
  })

  it('exposes validation errors to assistive technology', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/email and password are required/i)
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('toggles password visibility with an accessible control', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const password = screen.getByLabelText(/^password$/i)
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /^show password$/i }))

    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /^hide password$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('calls signInWithPassword with the entered credentials', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })

  it('displays authentication failures as an alert', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid login credentials/i)
  })

  it('redirects to the dashboard after a successful sign in', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('disables the form and visibility control while signing in', async () => {
    mockSignIn.mockImplementationOnce(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<LoginPage />)

    const email = screen.getByLabelText(/email address/i)
    const password = screen.getByLabelText(/^password$/i)
    await user.type(email, 'test@example.com')
    await user.type(password, 'password123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    expect(email).toBeDisabled()
    expect(password).toBeDisabled()
    expect(screen.getByRole('button', { name: /^show password$/i })).toBeDisabled()
  })

  it('resends confirmation for an unconfirmed account', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'Email not confirmed' },
    })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'unconfirmed@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    const resendButton = await screen.findByRole('button', {
      name: /resend confirmation email/i,
    })
    await user.click(resendButton)

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'unconfirmed@example.com',
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/confirmation email sent/i)
  })
})
