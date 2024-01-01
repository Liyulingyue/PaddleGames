import cv2
import math
import time
import random

class Balance(object):
    def __init__(self):
        self.length = 200 # 板面单边长度
        self.angle = 0 # 模板角度
        self.angle_speed = 0 # 角速度
        self.angle_acc = 0 # 角加速度
        self.weight = 100000

        self.player_wight = 1 # 玩家的重量
        self.player_position = 0 # 玩家在板面上的位置
        self.player_speed = 0
        self.player_acc = 0
        self.barrier_list = []

        self.time = time.time()
        self.show_time = "0:0:0"

    def update(self, angle): # F 代表玩家在杠杆方向的力

        self.angle += self.player_position / self.length * 0.05
        for i in range(len(self.barrier_list)):
            self.angle += self.barrier_list[i][0] / self.length * 0.01
        # self.angle += self.angle_speed
        # self.angle_speed += self.angle_acc
        # self.angle_acc = self.player_position * self.player_wight * math.cos(self.angle) / self.weight

        # self.player_acc = angle / 10 + self.player_wight * math.sin(self.angle) / self.player_wight / 100000
        self.player_speed = angle*10 + math.sin(self.angle)*2

        # self.angle += self.player_position / self.length * 0.05
        self.player_position = self.player_position + self.player_speed

        # update barrier
        for i in range(len(self.barrier_list)-1,-1,-1):
            self.barrier_list[i][2] = math.sin(self.angle)
            self.barrier_list[i][1] += self.barrier_list[i][2]
            self.barrier_list[i][0] += self.barrier_list[i][1]
            if abs(self.barrier_list[i][0])>self.length:
                del self.barrier_list[i]

        if random.random()<0.05:
            self.barrier_list.append([int((random.random()*2-1)*200), 0, 0])

    def get_status(self):
        game_status = False
        game_over_reason = ""
        if abs(self.player_position)>self.length:
            game_status = True
            game_over_reason = "滑出木板！"
        elif abs(self.angle)>math.pi/2:
            game_status = True
            game_over_reason = "木板侧翻！"
        return game_status, game_over_reason

    def draw_canvas(self, img):
        # draw balance
        cv2.circle(img, (250, 250), 5, (255, 0, 0), 3) # draw circle
        cv2.line(img, (int(250 - self.length * math.cos(self.angle)),
                       int(250 - self.length * math.sin(self.angle))),
                      (int(250 + self.length * math.cos(self.angle)),
                       int(250 + self.length * math.sin(self.angle))), (0, 0, 0), 3)  # draw line

        # draw object in balance
        x0 = self.player_position + 250
        y0 = -10 + 250
        x = (x0 - 250) * math.cos(self.angle) - (y0 - 250) * math.sin(self.angle) + 250
        y = (x0 - 250) * math.sin(self.angle) + (y0 - 250) * math.cos(self.angle) + 250
        cv2.circle(img, (int(x), int(y)), 5, (0, 255, 0), 3)  # draw circle

        # draw barrier
        for i in range(len(self.barrier_list)):
            x0 = self.barrier_list[i][0] + 250
            y0 = -10 + 250
            x = (x0 - 250) * math.cos(self.angle) - (y0 - 250) * math.sin(self.angle) + 250
            y = (x0 - 250) * math.sin(self.angle) + (y0 - 250) * math.cos(self.angle) + 250
            cv2.circle(img, (int(x), int(y)), 5, (0, 0, 255), 3)  # draw circle

        now_time = time.time()
        blance_time = now_time - self.time
        hour = int(blance_time/3600)
        minute = int((blance_time - hour*3600)/60)
        second = int(blance_time - hour*3600 - minute*60)
        self.show_time = "{}:{}:{}".format(hour,minute,second)
        cv2.putText(img, self.show_time, (5, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)
