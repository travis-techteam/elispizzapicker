import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pizza, Users, AlertTriangle, Printer, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../services/api';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function AdminReport() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data: reportResponse, isLoading } = useQuery({
    queryKey: ['report', eventId],
    queryFn: () => api.getReport(eventId!),
    enabled: !!eventId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const report = reportResponse?.data;

  if (!report) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/events')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-text">Order Report</h1>
        </div>
        <Card className="text-center py-12">
          <Pizza className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text mb-2">No Data Yet</h2>
          <p className="text-text-muted">
            {reportResponse?.message || 'No votes have been submitted yet.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <button onClick={() => navigate('/admin/events')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">Order Report</h1>
          <p className="text-text-muted">{report.event.name}</p>
        </div>
        <Button onClick={() => navigate(`/admin/events/${eventId}/find-pizza`)} variant="outline" size="sm">
          <MapPin className="w-4 h-4 mr-1" />
          Find Pizza Places
        </Button>
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="w-4 h-4 mr-1" />
          Print
        </Button>
      </div>

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Pizza Order - {report.event.name}</h1>
        <p className="text-sm text-gray-500">
          Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 print:grid-cols-4">
        <Card className="text-center py-4">
          <div className="text-3xl font-bold text-primary">{report.totalPizzas}</div>
          <div className="text-sm text-text-muted">Total Pizzas</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-3xl font-bold text-secondary">{report.totalSlices}</div>
          <div className="text-sm text-text-muted">Total Slices</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-3xl font-bold text-accent">{report.summary.totalVoters}</div>
          <div className="text-sm text-text-muted">Voters</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-3xl font-bold text-text">{report.summary.totalSlicesRequested}</div>
          <div className="text-sm text-text-muted">Slices Requested</div>
        </Card>
      </div>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pizza Orders */}
          {report.pizzaOrders.length > 0 ? (
            <div className="space-y-2">
              {report.pizzaOrders.map((pizza, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {pizza.quantity}
                    </span>
                    <span className="font-medium">{pizza.name}</span>
                  </div>
                  <span className="text-sm text-text-muted">{pizza.slicesRequested} slices requested</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-muted py-4">
              Not enough votes to calculate an order
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dropped Options */}
      {report.droppedOptions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Dropped Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-3">
              These options couldn't be included in the order:
            </p>
            <ul className="space-y-1">
              {report.droppedOptions.map((option, index) => (
                <li key={index} className="text-sm text-amber-600">
                  • {option}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Voter Breakdown */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center justify-between w-full print:pointer-events-none"
          >
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Voter Breakdown
            </CardTitle>
            {showBreakdown ? (
              <ChevronUp className="w-5 h-5 text-text-muted print:hidden" />
            ) : (
              <ChevronDown className="w-5 h-5 text-text-muted print:hidden" />
            )}
          </button>
        </CardHeader>
        {(showBreakdown || true) && ( // Always show for print
          <CardContent className={`${showBreakdown ? 'block' : 'hidden'} print:block`}>
            <div className="space-y-4">
              {report.voterBreakdown.map((voter) => (
                <div
                  key={voter.userId}
                  className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{voter.userName}</span>
                    <div className="text-right">
                      <span className="text-sm text-text-muted">{voter.sliceCount} slices</span>
                      <span className="text-xs text-primary ml-2">→ {voter.allocatedTo}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {voter.choices.map((choice, index) => (
                      <span
                        key={index}
                        className={`text-xs px-2 py-1 rounded-full ${
                          choice.pizzaName === voter.allocatedTo
                            ? 'bg-green-100 text-green-800 ring-1 ring-green-500'
                            : choice.priority === 1
                            ? 'bg-accent-100 text-accent-800'
                            : choice.priority === 2
                            ? 'bg-secondary-100 text-secondary-800'
                            : 'bg-primary-100 text-primary-800'
                        }`}
                      >
                        {choice.priority}. {choice.pizzaName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
