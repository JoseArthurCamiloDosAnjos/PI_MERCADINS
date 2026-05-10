import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
// import Dashboard from './pages/Dashboard'

function Rotas() {
  const { usuario, carregando } = useAuth()

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ fontFamily: 'Nunito, sans-serif', color: '#8892a4' }}>Carregando...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/auth"          element={!usuario ? <Login />    : <Navigate to="/dashboard" />} />
      <Route path="/auth/register" element={!usuario ? <Register /> : <Navigate to="/dashboard" />} />
      {/* <Route path="/dashboard"  element={ usuario ? <Dashboard /> : <Navigate to="/auth" />} /> */}
      <Route path="*"              element={<Navigate to="/auth" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}