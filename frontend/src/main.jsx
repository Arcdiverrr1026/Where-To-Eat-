import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, EntriesProvider, useAuth } from './library/state';
import MapWorkspace from './map/MapWorkspace';
import './library/styles.css';
import './map/map.css';

function App() {
  const { user } = useAuth();
  return <EntriesProvider key={user?.id || 'guest'} enabled={Boolean(user)}><MapWorkspace /></EntriesProvider>;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></React.StrictMode>
);
