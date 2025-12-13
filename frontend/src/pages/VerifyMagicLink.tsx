import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pizza, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import Button from '../components/ui/Button';

export default function VerifyMagicLink() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('Invalid or missing token');
      return;
    }

    const verify = async () => {
      try {
        const response = await api.verifyMagicLink(token);
        if (response.success && response.data) {
          login(response.data.user);
          setStatus('success');
          // Redirect after a short delay
          setTimeout(() => navigate('/'), 1500);
        } else {
          setStatus('error');
          setError(response.error || 'Verification failed');
        }
      } catch {
        setStatus('error');
        setError('Something went wrong. Please try again.');
      }
    };

    verify();
  }, [searchParams, login, navigate, isAuthenticated]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-full mb-4">
          <Pizza className="w-10 h-10 text-white" />
        </div>

        {status === 'loading' && (
          <>
            <h1 className="text-xl font-semibold text-text mb-2">Verifying...</h1>
            <p className="text-text-muted">Please wait while we verify your login</p>
            <div className="mt-6">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-text mb-2">Success!</h1>
            <p className="text-text-muted">Redirecting you to the app...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-text mb-2">Verification Failed</h1>
            <p className="text-text-muted mb-6">{error}</p>
            <Button onClick={() => navigate('/login')}>Back to Login</Button>
          </>
        )}
      </div>
    </div>
  );
}
