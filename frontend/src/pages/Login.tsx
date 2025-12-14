import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

type Step = 'input' | 'verify';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('input');
  const [phone, setPhone] = useState('');
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
      const response = await api.requestSmsCode(phone);
      if (response.success) {
        setStep('verify');
        if (response.warning) {
          setWarning(response.warning);
        }
      } else {
        setError(response.error || 'Failed to send code');
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
          <img src="/logo.png" alt="Eli's Pizza Picker" className="h-32 w-auto mx-auto mb-2" />
          <p className="text-text-muted mt-2">Vote on pizza for group dinners</p>
        </div>

        {/* Login form */}
        <div className="bg-surface rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 'input' ? (
            <>
              <form onSubmit={handleRequestCode}>
                <Input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                >
                  Send Code
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
