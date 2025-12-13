import { useNavigate } from 'react-router-dom';
import { Pizza } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
          <Pizza className="w-12 h-12 text-text-muted" />
        </div>
        <h1 className="text-4xl font-bold text-text mb-2">404</h1>
        <p className="text-xl text-text-muted mb-8">Page not found</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    </div>
  );
}
