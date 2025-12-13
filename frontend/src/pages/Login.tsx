import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pizza, Phone, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

type AuthMethod = 'phone' | 'email';
type Step = 'input' | 'verify';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [method, setMethod] = useState<AuthMethod>('phone');
  const [step, setStep] = useState<Step>('input');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [warning, setWarning] = useState('');

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setWarning('');
    setIsLoading(true);

    try {
      if (method === 'phone') {
        const response = await api.requestSmsCode(phone);
        if (response.success) {
          setStep('verify');
          if (response.warning) {
            setWarning(response.warning);
          }
        } else {
          setError(response.error || 'Failed to send code');
        }
      } else {
        const response = await api.requestMagicLink(email);
        if (response.success) {
          setWarning('Check your email for the login link!');
          if (response.warning) {
            setWarning(response.warning);
          }
        } else {
          setError(response.error || 'Failed to send magic link');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.verifySmsCode(phone, code);
      if (response.success && response.data) {
        login(response.data.user);
        navigate('/');
      } else {
        setError(response.error || 'Invalid code');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-full mb-4">
            <Pizza className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text">Eli's Pizza Picker</h1>
          <p className="text-text-muted mt-2">Vote on pizza for group dinners</p>
        </div>

        {/* Login form */}
        <div className="bg-surface rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 'input' ? (
            <>
              {/* Method toggle */}
              <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
                <button
                  onClick={() => setMethod('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    method === 'phone'
                      ? 'bg-white text-text shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Phone
                </button>
                <button
                  onClick={() => setMethod('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    method === 'email'
                      ? 'bg-white text-text shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
              </div>

              <form onSubmit={handleRequestCode}>
                {method === 'phone' ? (
                  <Input
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoFocus
                  />
                ) : (
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                )}

                {error && (
                  <p className="mt-2 text-sm text-red-500">{error}</p>
                )}

                {warning && (
                  <p className="mt-2 text-sm text-accent-600">{warning}</p>
                )}

                <Button
                  type="submit"
                  className="w-full mt-4"
                  size="lg"
                  isLoading={isLoading}
                >
                  {method === 'phone' ? 'Send Code' : 'Send Magic Link'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep('input');
                  setCode('');
                  setError('');
                }}
                className="text-sm text-primary hover:text-primary-hover mb-4"
              >
                ← Back
              </button>

              <p className="text-text-muted text-sm mb-4">
                Enter the 6-digit code sent to <strong>{phone}</strong>
              </p>

              <form onSubmit={handleVerifyCode}>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                  required
                  autoFocus
                />

                {error && (
                  <p className="mt-2 text-sm text-red-500">{error}</p>
                )}

                {warning && (
                  <p className="mt-2 text-sm text-accent-600">{warning}</p>
                )}

                <Button
                  type="submit"
                  className="w-full mt-4"
                  size="lg"
                  isLoading={isLoading}
                  disabled={code.length !== 6}
                >
                  Verify Code
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-text-muted text-sm mt-6">
          Don't have an account? Contact an admin for an invite.
        </p>
      </div>
    </div>
  );
}
