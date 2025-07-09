import { useNavigate } from 'react-router-dom';
import BookingForm from '../components/BookingForm';

export default function BookingPage({ user, bookingData, setBookingData }) {
  const navigate = useNavigate();

  const handleBookingCreated = (booking) => {
    navigate('/chat');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b">
        <h2 className="text-lg font-semibold">预约咨询</h2>
      </div>
      <div className="flex-1 overflow-auto">
        <BookingForm 
          user={user} 
          onBookingCreated={handleBookingCreated}
          bookingData={bookingData}
          onBookingDataChange={setBookingData}
        />
      </div>
    </div>
  );
}
