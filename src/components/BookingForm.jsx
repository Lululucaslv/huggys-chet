import { useState, useEffect } from 'react';
import { createBooking, getTherapists } from '../utils/api';
import BookingAssistant from './BookingAssistant';

export default function BookingForm({ onBookingCreated, user }) {
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAssistant, setShowAssistant] = useState(false);

  useEffect(() => {
    loadTherapists();
  }, []);

  const loadTherapists = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/therapists', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setTherapists(data.therapists || []);
    } catch (error) {
      console.error('Error loading therapists:', error);
      setError('Failed to load therapists');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedTherapist || !appointmentDate || !appointmentTime || !clientInfo.name || !clientInfo.email) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
      
      const bookingData = {
        therapistId: selectedTherapist,
        appointmentDate: appointmentDateTime.toISOString(),
        serviceType: '心理咨询',
        duration: 60,
        clientInfo: {
          ...clientInfo,
          id: `client_${Date.now()}`
        }
      };

      const result = await createBooking(bookingData);
      
      if (result.success) {
        onBookingCreated?.(result.booking);
        setSelectedTherapist('');
        setAppointmentDate('');
        setAppointmentTime('');
        setClientInfo({ name: '', email: '' });
      } else {
        setError(result.error || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      setError('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">预约心理咨询</h2>
        <button
          onClick={() => setShowAssistant(!showAssistant)}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {showAssistant ? '隐藏' : '显示'} AI 助手
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-sm text-gray-600">预约人: {user?.name}</p>
          <p className="text-sm text-gray-600">邮箱: {user?.email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            选择心理师 *
          </label>
          <select
            value={selectedTherapist}
            onChange={(e) => setSelectedTherapist(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">请选择心理师</option>
            {therapists.map(therapist => (
              <option key={therapist.id} value={therapist.id}>
                {therapist.name} - {therapist.specialization}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            预约日期 *
          </label>
          <input
            type="date"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            预约时间 *
          </label>
          <input
            type="time"
            value={appointmentTime}
            onChange={(e) => setAppointmentTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '预约中...' : '确认预约'}
        </button>
      </form>
    </div>

    {showAssistant && (
      <div>
        <BookingAssistant 
          user={user} 
          onBookingAction={(action) => {
            if (action.type === 'selectTherapist') {
              setSelectedTherapist(action.therapistId);
            }
          }}
        />
      </div>
    )}
  </div>
</div>
  );
}
