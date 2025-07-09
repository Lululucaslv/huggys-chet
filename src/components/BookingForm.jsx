import { useState, useEffect } from 'react';
import { createBooking, validateTherapistCode } from '../utils/api';
import BookingAssistant from './BookingAssistant';
import { format, parseISO } from 'date-fns';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function BookingForm({ onBookingCreated, user, bookingData, onBookingDataChange }) {
  const [therapistCode, setTherapistCode] = useState('');
  const [therapistInfo, setTherapistInfo] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [appointmentTime, setAppointmentTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAssistant, setShowAssistant] = useState(true);

  useEffect(() => {
    if (bookingData?.therapistCode) {
      setTherapistCode(bookingData.therapistCode);
      validateTherapist(bookingData.therapistCode);
    }
  }, [bookingData]);

  const validateTherapist = async (code) => {
    if (!code.trim()) {
      setTherapistInfo(null);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/therapists/validate?code=${code}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setTherapistInfo(data.therapist);
        setError('');
      } else {
        setTherapistInfo(null);
        setError('咨询师代码无效，请检查后重新输入');
      }
    } catch (error) {
      console.error('Error validating therapist code:', error);
      setTherapistInfo(null);
      setError('验证咨询师代码时出错');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!therapistInfo || !appointmentDate || !appointmentTime) {
      setError('请填写所有必填字段');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!appointmentDate) {
        setError('请选择预约日期');
        return;
      }
      
      const formattedDate = format(appointmentDate, 'yyyy-MM-dd');
      const appointmentDateTime = parseISO(`${formattedDate}T${appointmentTime}`);
      
      const bookingData = {
        therapistId: therapistInfo.id,
        therapistCode: therapistCode,
        appointmentDate: appointmentDateTime.toISOString(),
        serviceType: '心理咨询',
        duration: 60,
        clientInfo: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      };

      const result = await createBooking(bookingData);
      
      if (result.success) {
        onBookingCreated?.(result.booking);
        setTherapistCode('');
        setTherapistInfo(null);
        setAppointmentDate(null);
        setAppointmentTime('');
      } else {
        setError(result.error || '预约失败，请重试');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      setError('预约失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-xs text-gray-600">预约人: {user?.name}</p>
          <p className="text-xs text-gray-600">邮箱: {user?.email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            咨询师代码 *
          </label>
          <input
            type="text"
            value={therapistCode}
            onChange={(e) => {
              setTherapistCode(e.target.value);
              validateTherapist(e.target.value);
            }}
            placeholder="请输入咨询师提供的专属代码"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            required
          />
          {therapistInfo && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
              <p className="font-medium text-green-800">{therapistInfo.name}</p>
              <p className="text-green-600">{therapistInfo.specialization}</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            预约日期 *
          </label>
          <DatePicker
            selected={appointmentDate}
            onChange={(date) => {
              console.log('DatePicker onChange triggered with date:', date);
              setAppointmentDate(date);
            }}
            dateFormat="yyyy-MM-dd"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholderText="选择预约日期"
            minDate={new Date()}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !therapistInfo}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? '预约中...' : '确认预约'}
        </button>
      </form>

      {showAssistant && (
        <div className="border-t pt-4">
          <BookingAssistant 
            user={user} 
            onBookingAction={(action) => {
              console.log('BookingForm: Received booking action:', action);
              if (action.type === 'setTherapistCode') {
                setTherapistCode(action.code);
                validateTherapist(action.code);
              } else if (action.type === 'setDateTime') {
                console.log('BookingForm: AI Assistant triggered setDateTime action');
                console.log('BookingForm: AI provided date value:', action.date);
                console.log('BookingForm: AI provided time value:', action.time);
                const dateObj = action.date ? parseISO(action.date) : null;
                setAppointmentDate(dateObj);
                setAppointmentTime(action.time);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
