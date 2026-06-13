import random
import cv2
import time

class car(object):
    def __init__(self):
        # init game object
        self.bias = 100 # 真实绘制地图大于实际展示部分，需要适当便宜绘制位点
        self.x = 250
        self.car = cv2.resize(cv2.imread('./Source/BlueCar.png'),(50, 100))
        self.enemy = cv2.resize(cv2.imread('./Source/RedCar.png'),(50, 100))
        self.barrier_list = []
        self.is_collision = 0 # 撞车标识 0 正常 1 撞车

        # 得分计数器
        self.time = time.time()
        self.now_time = time.time()
        self.show_time = "0:0:0"

        # 更新车道线
        self.COUNT = -50
        self.COUNT2 = 250

    def update(self, angle = 0): # angle 检测到的方向盘角度
        # 更新x信息
        self.x -= int(10*angle)

        # 更新障碍物
        if len(self.barrier_list) == 0 or random.random()<0.02:
            # x,y,speed
            self.barrier_list.append([int(random.random() * 200 + 150), -50, int(random.random() * 8 + 3)])

        # 更新位置
        for i in range(len(self.barrier_list)):
            self.barrier_list[i][1] += self.barrier_list[i][2]

        # 更新game_over status
        # TODO: 之后应该通过更灵活的方式实现
        for i in range(len(self.barrier_list)):
            if abs(self.barrier_list[i][1] - 450) < (self.car.shape[0] + self.enemy.shape[0]) * 0.9 / 2:
                if abs(self.barrier_list[i][0] - self.x) < (self.car.shape[1] + self.enemy.shape[1]) * 0.9 / 2:
                    self.is_collision = 1

        # 删除无效数据
        self.barrier_list = [barrier for barrier in self.barrier_list if barrier[1]<549]
        if self.x < 120: self.x = 120
        if self.x > 380: self.x = 380

        # 车道线位置更新
        self.COUNT += 25
        self.COUNT2 += 25
        if self.COUNT >= 550: self.COUNT = -50
        if self.COUNT2 >= 550: self.COUNT2 = -50

        # 时间更新
        self.now_time = time.time()

    # 绘制
    def draw(self, img): # angle 检测到的方向盘角度
        # 绘制车道线
        for i in [160, 220, 280, 340]:
            img[self.COUNT-20+self.bias:self.COUNT+20+self.bias, i-5:i+5, :] = (0, 0, 0)
            img[self.COUNT2 - 20 + self.bias:self.COUNT2 + 20 + self.bias, i - 5:i + 5, :] = (0, 0, 0)

        # draw myself
        draw_car_in_pos(img,self.car,self.x, 450 + self.bias)

        # draw_barrier
        for barrier in self.barrier_list:
            draw_car_in_pos(img, self.enemy, barrier[0], barrier[1]+self.bias)

        # draw time
        # self.now_time在update更新
        tmp_time = self.now_time - self.time
        hour = int(tmp_time/3600)
        minute = int((tmp_time - hour*3600)/60)
        second = int(tmp_time - hour*3600 - minute*60)
        self.show_time = "{}:{}:{}".format(hour,minute,second)
        cv2.putText(img, self.show_time, (5, 50+self.bias), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (128, 128, 128), 2)

        return img

def draw_car_in_pos(img,car_img,x,y,mask_id = 0):
    # img 画布
    # car_img 待贴合图片
    # x,y 绘制中心点
    h, w, _ = car_img.shape
    x1 = int(x-w/2)
    x2 = x1+w
    y1 = int(y-h/2)
    y2 = y1+h
    tmp = img[y1:y2,x1:x2]
    tmp[car_img!=[0,0,0]]=car_img[car_img!=[0,0,0]]
    img[y1:y2,x1:x2] = tmp