import { useState, useEffect } from 'react';
import { getBookings, getSummary } from '../utils/api';

export default function TherapistDashboard({ user }) {
  const [bookings, setBookings] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/bookings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSummary = async (bookingId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/summary-generator?bookingId=${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSelectedSummary(data.summary);
      } else {
        setError('No summary available for this booking yet');
      }
    } catch (error) {
      console.error('Error loading summary:', error);
      setError('Failed to load summary');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">心理师工作台</h1>
        <div className="text-sm text-gray-600">
          欢迎, {user?.name}
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">即将到来的预约</h2>
        
        {bookings.length === 0 ? (
          <p className="text-gray-500">暂无预约</p>
        ) : (
          <div className="space-y-4">
            {bookings.map(booking => (
              <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-800">{booking.clientName}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(booking.appointmentDate).toLocaleString('zh-CN')}
                    </p>
                    <p className="text-sm text-gray-600">{booking.serviceType}</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      booking.status === 'CONFIRMED' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                  <button
                    onClick={() => handleViewSummary(booking.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    查看AI摘要
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">AI 咨询前摘要</h3>
                <button
                  onClick={() => setSelectedSummary(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedSummary.summaryText}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                <p>生成时间: {new Date(selectedSummary.generatedDate).toLocaleString('zh-CN')}</p>
                <p>分析聊天记录: {selectedSummary.chatLogsCount} 条</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
