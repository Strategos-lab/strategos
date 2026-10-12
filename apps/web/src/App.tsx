import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ModulesPage } from './pages/ModulesPage';
import { LessonPage } from './pages/LessonPage';
import { DataPage } from './pages/DataPage';
import { DevPage } from './pages/DevPage';
import { UpdateBanner } from './components/UpdateBanner';

export default function App() {
  return (
    <HashRouter>
      <UpdateBanner />
      <Routes>
        <Route path="/" element={<ModulesPage />} />
        <Route path="/lesson/:lessonId" element={<LessonPage />} />
        <Route path="/data" element={<DataPage />} />
        {/* Developer mode: not linked from the learner UI. */}
        <Route path="/dev" element={<DevPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
