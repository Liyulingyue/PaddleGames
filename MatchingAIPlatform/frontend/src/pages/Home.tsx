import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';
import HomeTitle from '../components/pages/home/HomeTitle';
import HomeDescription from '../components/pages/home/HomeDescription';
import StartButton from '../components/pages/home/StartButton';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      <HomeTitle>Matching</HomeTitle>
      <HomeDescription>在这里，您可以体验智能匹配的乐趣，与AI对手进行精彩的对战。点击下方按钮开始您的游戏之旅！</HomeDescription>
      <StartButton onClick={() => navigate('/level-select')}>
        开始游戏
      </StartButton>
      <button
        className="home-about-button"
        onClick={() => navigate('/about')}
      >
        📖 了解项目
      </button>
    </div>
  );
}

export default Home;