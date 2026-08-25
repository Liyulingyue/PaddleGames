import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import MatchingRoom from './pages/MatchingRoom';
import LevelSelect from './pages/LevelSelect';
import About from './pages/About';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <Router>
      <Sidebar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/level-select" element={<LevelSelect />} />
        <Route path="/matching-room" element={<MatchingRoom />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;
