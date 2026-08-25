import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 20, left: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 从localStorage加载按钮位置
  useEffect(() => {
    const savedPosition = localStorage.getItem('sidebar-button-position');
    if (savedPosition) {
      try {
        const position = JSON.parse(savedPosition);
        setButtonPosition(position);
      } catch (e) {
        console.warn('Failed to parse saved button position');
      }
    }
  }, []);

  // 保存按钮位置到localStorage
  const saveButtonPosition = (position: { top: number; left: number }) => {
    localStorage.setItem('sidebar-button-position', JSON.stringify(position));
  };

  // 根据当前页面调整悬浮按钮位置（仅在没有自定义位置时）
  useEffect(() => {
    const savedPosition = localStorage.getItem('sidebar-button-position');
    if (savedPosition) return; // 如果有保存的位置，不自动调整

    const adjustButtonPosition = () => {
      const path = location.pathname;

      switch (path) {
        case '/':
          // 首页：放在右下角，避免遮挡标题
          setButtonPosition({ top: window.innerHeight - 80, left: window.innerWidth - 80 });
          break;
        case '/level-select':
          // 选关页面：放在右上角
          setButtonPosition({ top: 20, left: window.innerWidth - 80 });
          break;
        default:
          // 默认位置
          setButtonPosition({ top: 20, left: 20 });
      }
    };

    adjustButtonPosition();
    window.addEventListener('resize', adjustButtonPosition);
    return () => window.removeEventListener('resize', adjustButtonPosition);
  }, [location.pathname]);

  // 拖拽功能
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;

    setIsDragging(true);
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    // 防止文本选择
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newLeft = Math.max(0, Math.min(window.innerWidth - 64, e.clientX - dragOffset.x));
    const newTop = Math.max(0, Math.min(window.innerHeight - 64, e.clientY - dragOffset.y));

    const newPosition = { top: newTop, left: newLeft };
    setButtonPosition(newPosition);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      saveButtonPosition(buttonPosition);
    }
  };

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // 防止拖拽时选中文本
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset, buttonPosition]);

  const handleNavigation = (path: string) => {
    // 如果是选关挑战页面，清除查询参数
    if (path === '/level-select') {
      navigate('/level-select');
    } else {
      navigate(path);
    }
    setIsOpen(false);
  };

  const handleGitHubLink = () => {
    window.open('https://github.com/Liyulingyue/MatchingAIPlatform', '_blank');
    setIsOpen(false);
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 主sidebar */}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          {/* 头部 */}
          <div className="sidebar-header">
            <h3>Matching</h3>
            <p>智能配对挑战平台</p>
          </div>

          {/* 导航菜单 */}
          <nav className="sidebar-nav">
            <button
              className={`sidebar-button ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => handleNavigation('/')}
            >
              🏠 主页
            </button>
            <button
              className={`sidebar-button ${location.pathname === '/level-select' ? 'active' : ''}`}
              onClick={() => handleNavigation('/level-select')}
            >
              🎯 选关挑战
            </button>
            <button
              className={`sidebar-button ${location.pathname === '/about' ? 'active' : ''}`}
              onClick={() => handleNavigation('/about')}
            >
              📖 关于
            </button>
            <button
              className="sidebar-button github-link"
              onClick={handleGitHubLink}
              title="查看项目源码和文档"
            >
              🔗 GitHub
            </button>
          </nav>

          {/* 页脚 */}
          <div className="sidebar-footer">
            <p>享受配对的乐趣</p>
          </div>
        </div>
      </div>

      {/* 智能悬浮按钮 */}
      <button
        ref={buttonRef}
        className={`floating-sidebar-btn ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''}`}
        onClick={() => !isDragging && setIsOpen(!isOpen)}
        onMouseDown={handleMouseDown}
        style={{
          top: `${buttonPosition.top}px`,
          left: `${buttonPosition.left}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        title="长按拖拽可移动位置，点击打开导航菜单"
      >
        <span className="button-icon">
          {isOpen ? '✕' : '☰'}
        </span>
        {!isOpen && (
          <span className="button-label">
            {location.pathname === '/level-select' ? '菜单' : '菜单'}
          </span>
        )}
        {/* 拖拽提示 */}
        <div className="drag-hint">
          {isDragging ? '松开定位' : '拖拽移动'}
        </div>
      </button>
    </>
  );
}

export default Sidebar;