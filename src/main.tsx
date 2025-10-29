import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { NotesPage } from './pages/NotesPage';
import './styles.css';

const router = createBrowserRouter([
    { path: '/', element: <App /> },
    { path: '/notes', element: <NotesPage /> },
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);

