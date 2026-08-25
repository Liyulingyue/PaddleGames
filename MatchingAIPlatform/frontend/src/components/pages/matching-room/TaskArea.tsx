import React from 'react';

interface Task {
  id: number;
  requirement: string;
  completed: boolean;
}

interface TaskAreaProps {
  tasks: Task[];
  completedTasks: number[];
}

const TaskArea: React.FC<TaskAreaProps> = ({ tasks, completedTasks }) => {
  return (
    <div className="task-area">
      <div className="task-container">
        <div className="task-header">
          <h2>🎯 任务目标</h2>
          <div className="drag-tip">
            <span className="drag-tip-icon">✨</span>
            <span className="drag-tip-text">拖拽匹配相同颜色和结果的卡片</span>
          </div>
        </div>
        <div className="tasks-list">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className={`task-item ${completedTasks.includes(index) ? 'completed' : ''} ${completedTasks.includes(index) ? 'animate-pulse' : ''}`}
            >
              <span className="task-status">
                {completedTasks.includes(index) ? '✅' : '⭕'}
              </span>
              <span className="task-text">{task.requirement}</span>
              {completedTasks.includes(index) && <div className="task-sparkle">✨</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskArea;