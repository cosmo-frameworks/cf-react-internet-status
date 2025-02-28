import React from 'react';
import { useInternetStatusContext } from '../context/InternetStatusProvider';

const InternetStatus: React.FC = () => {
  const { isOnline } = useInternetStatusContext();

  return (
    <div>
      {isOnline ? (
        <p style={{ color: 'green' }}>You are online!</p>
      ) : (
        <p style={{ color: 'red' }}>You are offline!</p>
      )}
    </div>
  );
};

export default InternetStatus;
