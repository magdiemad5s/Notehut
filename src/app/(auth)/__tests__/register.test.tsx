import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from '@/app/(auth)/register/page'

process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSignUp = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignUp.mockReset()
  })

  it('renders the registration form and sign-in link', () => {
    render(<RegisterPage />)

    expect(screen.getByRole('heading', { name: /create your notehut account/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login')
  })

  it('shows the password requirements and updates their status', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    const requirements = screen.getByRole('list', { name: /password requirements/i })
    expect(within(requirements).getByText(/at least 6 characters/i)).toBeInTheDocument()
    expect(within(requirements).getByText(/password entries match/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/^confirm password$/i), 'password123')

    expect(requirements).toHaveTextContent(/requirement met: at least 6 characters/i)
    expect(requirements).toHaveTextContent(/requirement met: password entries match/i)
  })

  it('toggles both password fields independently', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    const password = screen.getByLabelText(/^password$/i)
    const confirmation = screen.getByLabelText(/^confirm password$/i)

    await user.click(screen.getByRole('button', { name: /^show password$/i }))
    expect(password).toHaveAttribute('type', 'text')
    expect(confirmation).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show confirm password/i }))
    expect(confirmation).toHaveAttribute('type', 'text')
  })

  it('shows an accessible error when email is empty', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/email is required/i)
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows an accessible error when the password is too short', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), '12345')
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /password must be at least 6 characters/i,
    )
  })

  it('shows an accessible error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/^confirm password$/i), 'different123')
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i)
  })

  it('calls signUp with the existing redirect contract', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/^confirm password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: 'http://localhost:3000/login?registered=true',
        },
      })
    })
  })

  it('displays sign-up failures as an alert', async () => {
    mockSignUp.mockResolvedValueOnce({
      error: { message: 'User already registered' },
    })
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/email address/i), 'existing@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/^confirm password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/user already registered/i)
  })

  it('redirects to login after successful registration', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/email address/i), 'new@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/^confirm password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?registered=true')
    })
  })

  it('disables every control while creating the account', async () => {
    mockSignUp.mockImplementationOnce(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<RegisterPage />)

    const email = screen.getByLabelText(/email address/i)
    const password = screen.getByLabelText(/^password$/i)
    const confirmation = screen.getByLabelText(/^confirm password$/i)
    await user.type(email, 'new@example.com')
    await user.type(password, 'password123')
    await user.type(confirmation, 'password123')
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
    expect(email).toBeDisabled()
    expect(password).toBeDisabled()
    expect(confirmation).toBeDisabled()
    expect(screen.getByRole('button', { name: /^show password$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /show confirm password/i })).toBeDisabled()
  })
})
