import '../styles/About.css';

function About() {

  return (
    <div className="about">
      <div className="about-container">
        <div className="about-header">
          <h1>关于 Matching</h1>
          <p className="about-subtitle">智能配对挑战平台</p>
        </div>

        <div className="about-content">
          <section className="about-section">
            <h2>🎯 项目简介</h2>
            <p>
              Matching 是一个基于 React + TypeScript 开发的智能配对挑战平台，
              旨在为用户提供有趣的配对游戏体验。通过与 AI 的对抗，用户可以锻炼思维逻辑和反应能力。
            </p>
          </section>

          <section className="about-section">
            <h2>✨ 主要特色</h2>
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">🎮</div>
                <h3>多样化游戏</h3>
                <p>支持多种主题的配对挑战，包括数学、词汇、诗词等多种类型</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🤖</div>
                <h3>AI 对抗</h3>
                <p>与智能 AI 进行实时对抗，提供个性化难度调节</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <h3>进度追踪</h3>
                <p>详细的游戏统计和进度追踪，帮助用户了解自己的提升</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🎨</div>
                <h3>现代化界面</h3>
                <p>采用现代化的 UI 设计，提供流畅的用户体验</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>🛠️ 技术栈</h2>
            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-name">Frontend</span>
                <div className="tech-details">
                  <span className="tech-badge">React</span>
                  <span className="tech-badge">TypeScript</span>
                  <span className="tech-badge">Vite</span>
                  <span className="tech-badge">CSS3</span>
                </div>
              </div>
              <div className="tech-item">
                <span className="tech-name">Backend</span>
                <div className="tech-details">
                  <span className="tech-badge">Python</span>
                  <span className="tech-badge">Flask</span>
                  <span className="tech-badge">FastAPI</span>
                </div>
              </div>
              <div className="tech-item">
                <span className="tech-name">AI/ML</span>
                <div className="tech-details">
                  <span className="tech-badge">TensorFlow</span>
                  <span className="tech-badge">PyTorch</span>
                  <span className="tech-badge">Scikit-learn</span>
                </div>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>📖 如何开始</h2>
            <div className="getting-started">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>选择关卡</h4>
                  <p>在关卡选择页面选择您感兴趣的主题和难度</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>开始游戏</h4>
                  <p>拖拽卡片进行配对，挑战自己的反应速度和逻辑思维</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>查看成绩</h4>
                  <p>游戏结束后查看详细的成绩统计和改进建议</p>
                </div>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>🤝 贡献</h2>
            <p>
              这是一个开源项目，欢迎所有开发者参与贡献！
              您可以通过 GitHub 提交 Issue 或 Pull Request 来帮助改进这个项目。
            </p>
            <div className="contribution-links">
              <button
                className="contribution-button primary"
                onClick={() => window.open('https://github.com/Liyulingyue/MatchingAIPlatform', '_blank')}
              >
                📖 查看源码
              </button>
              <button
                className="contribution-button secondary"
                onClick={() => window.open('https://github.com/Liyulingyue/MatchingAIPlatform/issues', '_blank')}
              >
                🐛 报告问题
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default About;