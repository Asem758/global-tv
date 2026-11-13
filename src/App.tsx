import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { DirectoryPage } from './pages/DirectoryPage.tsx';
import { CountriesPage } from './pages/CountriesPage.tsx';
import { SportsCenterPage } from './pages/SportsCenterPage.tsx';
import { WatchPage } from './pages/WatchPage.tsx';
import { TvGuidePage } from './pages/TvGuidePage.tsx';
import { FavoritesPage } from './pages/FavoritesPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#070B14] text-white">
          <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-400">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#070B14] dark:text-slate-100">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/live" element={<DirectoryPage />} />
                  <Route path="/countries" element={<CountriesPage />} />
                  <Route path="/countries/:countryCode" element={<DirectoryPage />} />
                  <Route path="/sports" element={<SportsCenterPage />} />
                  <Route path="/category/:slug" element={<DirectoryPage />} />
                  <Route path="/watch/:slug" element={<WatchPage />} />
                  <Route path="/guide" element={<TvGuidePage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/admin" element={<AdminDashboardPage />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
