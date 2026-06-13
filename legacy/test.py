import cv2
import numpy as np
import random
import math

# 游戏窗口大小
WINDOW_WIDTH = 640
WINDOW_HEIGHT = 480

# 颜色定义
PLAYER_COLOR = (0, 255, 0)  # 绿色表示玩家
OBSTACLE_COLOR = (0, 0, 255)  # 蓝色表示障碍物


class Game:
    def __init__(self):
        self.player_pos = (WINDOW_WIDTH // 2, WINDOW_HEIGHT - 50)  # 玩家初始位置在屏幕底部中央
        self.obstacles = []  # 存储障碍物的列表
        self.game_over = False  # 游戏结束标志
        self.speed_range = [2, 5]  # 障碍物移动速度的范围
        self.duration_range = [50, 150]  # 障碍物持续时间的范围
        self.window_name = "Pixel Run"  # 窗口名称
        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)  # 创建一个可调整大小的窗口
        cv2.resizeWindow(self.window_name, 320, 240)  # 设置窗口的大小（例如：640x480）
        cv2.setMouseCallback(self.window_name, self.mouse_callback)  # 设置鼠标回调函数


    def mouse_callback(self, event, x, y, flags, param):
        """鼠标事件回调函数"""
        if event == cv2.EVENT_MOUSEMOVE:  # 鼠标移动事件
            self.player_pos = (x, y)  # 更新玩家位置为鼠标位置

    def generate_obstacle(self):
        """随机生成障碍物"""
        x = random.randint(0, WINDOW_WIDTH - 50)  # 随机x坐标
        y = 0  # y坐标从屏幕顶部开始
        speed = random.randint(*self.speed_range)  # 随机移动速度
        duration = random.randint(*self.duration_range)  # 随机持续时间
        obstacle = [x, y, speed, duration]
        self.obstacles.append(obstacle)

    def update(self):
        """更新游戏状态"""
        if not self.game_over:
            for obstacle in self.obstacles:
                obstacle[1] += obstacle[2]  # 更新障碍物的y坐标
                if obstacle[1] > WINDOW_HEIGHT:  # 如果障碍物移出了屏幕底部
                    self.obstacles.remove(obstacle)  # 删除该障碍物
            if random.random() < 0.02:  # 有2%的概率生成新的障碍物
                self.generate_obstacle()

                # 检查玩家与障碍物之间的距离
            for obstacle in self.obstacles:
                distance = math.sqrt((obstacle[0] - self.player_pos[0]) ** 2 + (obstacle[1] - self.player_pos[1]) ** 2)
                if distance < 50:  # 设置阈值为50（可根据需要调整）
                    self.game_over = True

            frame = np.zeros((WINDOW_HEIGHT, WINDOW_WIDTH, 3), dtype=np.uint8)  # 创建黑色背景的游戏窗口
            cv2.circle(frame, self.player_pos, 25, PLAYER_COLOR, -1)  # 绘制玩家（一个圆）
            for obstacle in self.obstacles:
                cv2.circle(frame, (obstacle[0], obstacle[1]), 25, OBSTACLE_COLOR, -1)  # 绘制障碍物（一个圆）
            cv2.imshow(self.window_name, frame)  # 显示游戏窗口
            if cv2.waitKey(1) & 0xFF == ord('q'):  # 按'q'键退出游戏
                self.game_over = True
        else:
            cv2.destroyAllWindows()  # 关闭游戏窗口
            print("Game Over!")
            exit()  # 结束游戏程序


if __name__ == "__main__":
    game = Game()
    while True:
        frame = np.zeros((WINDOW_HEIGHT, WINDOW_WIDTH, 3), dtype=np.uint8)  # 创建黑色背景的游戏窗口
        game.update()  # 更新游戏状态并绘制游戏画面