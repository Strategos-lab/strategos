import { HashRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { UpdateBanner } from './components/UpdateBanner';

export default function App() {
  return (
    <HashRouter>
      <UpdateBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </HashRouter>
  );
}
