import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import TransitionLayer from './components/transition/TransitionLayer.jsx'
import LanguageProvider from './i18n/LanguageProvider.jsx'
import LanguageToggle from './i18n/LanguageToggle.jsx'
import Home from './Pages/Home.jsx'
import Welcome from './Pages/Welcome.jsx'

function RootLayout() {
  return (
    <LanguageProvider>
      <TransitionLayer>
        <Outlet />
        <LanguageToggle />
      </TransitionLayer>
    </LanguageProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Welcome /> },
      { path: '/home', element: <Home /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
