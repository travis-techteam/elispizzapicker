import { Pizza } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="animate-bounce">
        <Pizza className="w-16 h-16 text-primary" />
      </div>
      <p className="mt-4 text-text-muted">Loading...</p>
    </div>
  );
}
