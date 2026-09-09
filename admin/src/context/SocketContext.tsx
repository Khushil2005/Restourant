import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Resolve target Socket.IO URL
const getSocketUrl = (): string | undefined => {
  const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (envSocketUrl && typeof envSocketUrl === 'string' && envSocketUrl.trim()) {
    return envSocketUrl.trim().replace(/\/+$/, '');
  }

  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim()) {
    return envApiUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }

  // Production fallback: ALWAYS connect to Render backend, never Vercel frontend
  if (import.meta.env.PROD) {
    return 'https://restourant-eoj3.onrender.com';
  }

  // Local development default (routes through Vite dev proxy)
  return undefined;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const targetUrl = getSocketUrl();

    const newSocket = targetUrl
      ? io(targetUrl, {
          auth: { token },
          autoConnect: true,
          transports: ['websocket', 'polling'],
          withCredentials: true
        })
      : io({
          auth: { token },
          autoConnect: true,
          transports: ['websocket', 'polling'],
          withCredentials: true
        });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
