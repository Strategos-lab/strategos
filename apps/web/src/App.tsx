import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LessonPage } from './pages/LessonPage';
import { DataPage } from './pages/DataPage';
import { DevPage } from './pages/DevPage';
import { UpdateBanner } from './components/UpdateBanner';

export default function App() {
  return (
    <HashRouter>
      <UpdateBanner />
      <Routes>
        <Route path="/" element={<LessonPage lessonId="m1.l1" />} />
        <Route path="/data" element={<DataPage />} />
        {/* Developer mode: not linked from the learner UI. */}
        <Route path="/dev" element={<DevPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
